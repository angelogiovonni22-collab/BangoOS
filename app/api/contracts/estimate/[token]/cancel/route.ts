import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { loadHomeSolicitationCompliance } from "@/lib/compliance/home-solicitation-service";
import { recordHomeSolicitationEvent } from "@/lib/compliance/home-solicitation-events-service";

// These Phase 2 tables are created by migrations in this branch and will be folded into the generated
// Database types after schema type regeneration. Keep the compatibility escape hatch local to them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MigrationTableClient = SupabaseClient<any>;

function ohioDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const admin = createAdminClient();
    const migrationTables = admin as unknown as MigrationTableClient;
    const workflow = createEstimateWorkflowService(admin);
    const validated = await workflow.validatePublicToken({ token, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") });
    if (!validated.isValid || !validated.companyId || !validated.estimateId) throw new Error(validated.failureReason || "invalid_contract_link");

    const body = await request.json() as { confirmation?: boolean; notice?: string };
    if (body.confirmation !== true) return NextResponse.json({ error: "Cancellation confirmation is required." }, { status: 400 });

    const compliance = await loadHomeSolicitationCompliance(admin, validated.companyId, validated.estimateId);
    if (compliance.evaluation.applicable !== true) return NextResponse.json({ error: "This transaction does not have an active B.O.S. home-solicitation cancellation workflow." }, { status: 400 });
    if (!compliance.profile.transactionSignedAt || !compliance.profile.cancellationDeadlineDate) return NextResponse.json({ error: "The signed transaction record is not complete." }, { status: 409 });

    if (compliance.profile.cancelledAt) {
      return NextResponse.json({ cancelled: true, timely: true, receivedAt: compliance.profile.cancelledAt, alreadyRecorded: true });
    }

    const receivedAt = new Date().toISOString();
    const effectiveDate = ohioDateKey(new Date(receivedAt));
    const deadlineDate = compliance.profile.cancellationDeadlineDate;
    const timely = effectiveDate <= deadlineDate;
    const noticeText = body.notice?.trim() || "I hereby cancel this transaction.";

    const { error: eventError } = await migrationTables.from("estimate_home_solicitation_cancellations").insert({
      company_id: validated.companyId,
      estimate_id: validated.estimateId,
      public_token_id: validated.tokenId || null,
      received_at: receivedAt,
      effective_date: effectiveDate,
      deadline_date: deadlineDate,
      timely,
      notice_text: noticeText,
      ip_address: request.headers.get("x-forwarded-for"),
      user_agent: request.headers.get("user-agent"),
      metadata: { channel: "bos_secure_contract_link" },
    });
    if (eventError) throw new Error(eventError.message || "Unable to preserve the cancellation notice.");

    await recordHomeSolicitationEvent(admin, {
      companyId: validated.companyId,
      estimateId: validated.estimateId,
      eventType: "cancellation_received",
      actorType: "customer",
      metadata: { receivedAt, effectiveDate, deadlineDate, timely, publicTokenId: validated.tokenId || null },
    });

    if (!timely) {
      return NextResponse.json({ cancelled: false, timely: false, reviewRequired: true, receivedAt, deadlineDate, message: "Your cancellation request has been recorded for review." });
    }

    const { error: profileError } = await migrationTables.from("estimate_home_solicitation_profiles").update({
      cancelled_at: receivedAt,
      updated_at: receivedAt,
    }).eq("company_id", validated.companyId).eq("estimate_id", validated.estimateId);
    if (profileError) throw new Error(profileError.message || "Unable to update the cancellation record.");

    const { data: estimate, error: estimateReadError } = await admin.from("estimates").select("project_id").eq("company_id", validated.companyId).eq("id", validated.estimateId).maybeSingle();
    if (estimateReadError) throw new Error(estimateReadError.message || "Unable to locate the related project.");

    const { error: estimateError } = await admin.from("estimates").update({ status: "void" }).eq("company_id", validated.companyId).eq("id", validated.estimateId);
    if (estimateError) throw new Error(estimateError.message || "Unable to mark the estimate cancelled.");

    if (estimate?.project_id) {
      const { error: projectError } = await admin.from("projects").update({
        contract_compliance_hold_active: true,
        contract_compliance_hold_until: null,
        contract_compliance_hold_reason: "Customer cancelled Ohio home-solicitation transaction",
      } as never).eq("company_id", validated.companyId).eq("id", estimate.project_id);
      if (projectError) throw new Error(projectError.message || "Unable to hold the related project.");
    }

    return NextResponse.json({ cancelled: true, timely: true, receivedAt, deadlineDate });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record cancellation." }, { status: 400 });
  }
}
