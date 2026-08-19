import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { loadHomeSolicitationCompliance } from "@/lib/compliance/home-solicitation-service";

const SECURE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

function secureJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: SECURE_HEADERS });
}

function ohioDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

type CancellationResult = {
  cancelled: boolean;
  timely: boolean;
  already_recorded: boolean;
  received_at: string;
  deadline_date: string;
  project_id: string | null;
};

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const admin = createAdminClient();
    const workflow = createEstimateWorkflowService(admin);
    const validated = await workflow.validatePublicToken({ token, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") });
    if (!validated.isValid || !validated.companyId || !validated.estimateId) throw new Error(validated.failureReason || "invalid_contract_link");

    const body = await request.json() as { confirmation?: boolean; notice?: string };
    if (body.confirmation !== true) return secureJson({ error: "Cancellation confirmation is required." }, 400);
    const noticeText = body.notice?.trim() || "I hereby cancel this transaction.";
    if (!noticeText || noticeText.length > 4000) return secureJson({ error: "Cancellation notice must contain between 1 and 4,000 characters." }, 400);

    const compliance = await loadHomeSolicitationCompliance(admin, validated.companyId, validated.estimateId);
    if (compliance.evaluation.applicable !== true) return secureJson({ error: "This transaction does not have an active B.O.S. home-solicitation cancellation workflow." }, 400);
    if (!compliance.profile.transactionSignedAt || !compliance.profile.cancellationDeadlineDate) return secureJson({ error: "The signed transaction record is not complete." }, 409);

    const receivedAt = new Date().toISOString();
    const effectiveDate = ohioDateKey(new Date(receivedAt));
    const { data, error } = await admin.rpc("record_verified_home_solicitation_cancellation" as never, {
      p_company_id: validated.companyId,
      p_estimate_id: validated.estimateId,
      p_public_token_id: validated.tokenId || null,
      p_received_at: receivedAt,
      p_effective_date: effectiveDate,
      p_notice_text: noticeText,
      p_ip_address: request.headers.get("x-forwarded-for"),
      p_user_agent: request.headers.get("user-agent"),
    } as never) as { data: CancellationResult[] | null; error: { message?: string } | null };
    if (error) throw new Error(error.message || "Unable to preserve the cancellation notice.");

    const result = data?.[0];
    if (!result) throw new Error("Cancellation workflow returned no result.");

    if (result.already_recorded) {
      return secureJson({
        cancelled: result.cancelled,
        timely: result.timely,
        reviewRequired: !result.timely,
        receivedAt: result.received_at,
        deadlineDate: result.deadline_date,
        alreadyRecorded: true,
        message: result.timely ? "Your cancellation notice has already been recorded." : "Your cancellation request has already been recorded for review.",
      });
    }
    if (!result.timely) {
      return secureJson({ cancelled: false, timely: false, reviewRequired: true, receivedAt: result.received_at, deadlineDate: result.deadline_date, message: "Your cancellation request has been recorded for review." });
    }

    return secureJson({ cancelled: result.cancelled, timely: true, receivedAt: result.received_at, deadlineDate: result.deadline_date });
  } catch (error) {
    return secureJson({ error: error instanceof Error ? error.message : "Unable to record cancellation." }, 400);
  }
}
