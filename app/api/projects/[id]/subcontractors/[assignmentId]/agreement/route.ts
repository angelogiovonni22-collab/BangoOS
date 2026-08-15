import { randomBytes, createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import type { Database } from "@/types/database.types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { sendContractEmail } from "@/lib/estimates/contract-email";
import {
  MASTER_SUBCONTRACT_AGREEMENT_VERSION,
  PROJECT_WORK_AUTHORIZATION_VERSION,
  buildMasterSnapshot,
  buildWorkAuthorizationSnapshot,
  hashSnapshot,
} from "@/lib/subcontractors/agreement";

type MasterRecord = { id: string; status: string; agreement_hash: string };
type AuthorizationRecord = { id: string; authorization_hash: string };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const asText = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : null;
const asNumber = (value: unknown) => typeof value === "number" ? value : value == null ? null : Number(value);

function projectAddress(project: Record<string, unknown>) {
  const parts = [project.address_line_1, project.address_line_2, project.city, project.state, project.postal_code]
    .map(asText).filter(Boolean);
  return parts.length ? parts.join(", ") : asText(project.job_site_address) || null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const supabase = await createClient();
    if (!supabase) return NextResponse.json({ error: "B.O.S. database is unavailable." }, { status: 503 });
    const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
    if (!workspace.context) return NextResponse.json({ error: workspace.errorMessage || "Unauthorized." }, { status: 401 });
    const companyId = workspace.context.companyId;
    const admin = createAdminClient();

    const [{ data: assignment }, { data: project }, { data: company }] = await Promise.all([
      admin.from("trade_partner_assignments").select("*").eq("company_id", companyId).eq("project_id", projectId).eq("id", assignmentId).single(),
      admin.from("projects").select("*").eq("company_id", companyId).eq("id", projectId).single(),
      admin.from("companies").select("id,name").eq("id", companyId).single(),
    ]);
    if (!assignment || !project || !company) return NextResponse.json({ error: "Subcontractor assignment not found." }, { status: 404 });

    const { data: vendor } = await admin.from("vendors").select("*").eq("company_id", companyId).eq("id", assignment.vendor_id).single();
    if (!vendor) return NextResponse.json({ error: "Vendor not found." }, { status: 404 });
    const email = asText(assignment.primary_contact_email) || asText(vendor.email);
    if (!email) return NextResponse.json({ error: "A subcontractor email address is required before sending an agreement." }, { status: 400 });
    const personName = [asText(vendor.first_name), asText(vendor.last_name)].filter(Boolean).join(" ");
    const vendorName = asText(vendor.name) || asText(vendor.company_name) || personName || "Subcontractor";

    const { data: signedMasterRaw } = await admin.from("subcontractor_master_agreements" as never).select("*").eq("company_id", companyId).eq("vendor_id", assignment.vendor_id).eq("status", "signed").order("signed_at", { ascending: false }).limit(1).maybeSingle();
    let master = signedMasterRaw as MasterRecord | null;
    if (!master) {
      const { data: pendingMasterRaw } = await admin.from("subcontractor_master_agreements" as never).select("*").eq("company_id", companyId).eq("vendor_id", assignment.vendor_id).in("status", ["draft", "sent"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      master = pendingMasterRaw as MasterRecord | null;
    }
    if (!master) {
      const snapshot = buildMasterSnapshot({ companyName: company.name, vendorName, vendorEmail: email });
      const { data, error } = await admin.from("subcontractor_master_agreements" as never).insert({
        company_id: companyId, vendor_id: assignment.vendor_id, status: "draft",
        agreement_version: MASTER_SUBCONTRACT_AGREEMENT_VERSION, agreement_snapshot: snapshot,
        agreement_hash: hashSnapshot(snapshot), signer_email: email,
        created_by: workspace.context.userId, updated_by: workspace.context.userId,
      } as never).select("*").single();
      if (error || !data) throw new Error(error?.message || "Unable to create master subcontract agreement.");
      master = data as MasterRecord;
    }

    const waSnapshot = buildWorkAuthorizationSnapshot({
      companyName: company.name,
      vendorName,
      projectName: asText(project.name) || asText(project.project_name) || asText(project.job_site_name) || "Project",
      projectAddress: projectAddress(project as Record<string, unknown>),
      tradeName: assignment.trade_name,
      scopeOfWork: asText(assignment.scope_of_work),
      contractAmount: asNumber(assignment.contract_amount),
      paymentTerms: asText(assignment.payment_terms),
      retainagePercent: asNumber(assignment.retainage_percent),
      startDate: asText(assignment.start_date),
      targetCompletionDate: asText(assignment.target_completion_date),
    });
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: authorizationRaw, error: authError } = await admin.from("project_subcontract_work_authorizations" as never).upsert({
      company_id: companyId, project_id: projectId, assignment_id: assignmentId, vendor_id: assignment.vendor_id,
      master_agreement_id: master.id, status: "sent", authorization_version: PROJECT_WORK_AUTHORIZATION_VERSION,
      authorization_snapshot: waSnapshot, authorization_hash: hashSnapshot(waSnapshot),
      scope_of_work: assignment.scope_of_work, contract_amount: assignment.contract_amount, payment_terms: assignment.payment_terms,
      retainage_percent: assignment.retainage_percent, start_date: assignment.start_date, target_completion_date: assignment.target_completion_date,
      signer_email: email, public_token_hash: tokenHash(token), token_expires_at: expiresAt, sent_at: new Date().toISOString(),
      created_by: workspace.context.userId, updated_by: workspace.context.userId,
    } as never, { onConflict: "company_id,assignment_id" }).select("*").single();
    const authorization = authorizationRaw as AuthorizationRecord | null;
    if (authError || !authorization) throw new Error(authError?.message || "Unable to create project work authorization.");

    if (master.status !== "signed") {
      await admin.from("subcontractor_master_agreements" as never).update({ status: "sent", signer_email: email, public_token_hash: tokenHash(token), token_expires_at: expiresAt, sent_at: new Date().toISOString(), updated_by: workspace.context.userId } as never).eq("id", master.id);
    }

    const requirementRows = [
      ["master_agreement", master.status === "signed" ? "verified" : "pending"],
      ["work_authorization", "pending"], ["w9", "missing"], ["coi", "missing"], ["workers_comp", "missing"],
      ["licenses", "missing"], ["safety_acknowledgement", "missing"], ["scope_confirmation", "pending"],
    ].map(([requirement_type, status]) => ({ company_id: companyId, project_id: projectId, assignment_id: assignmentId, vendor_id: assignment.vendor_id, requirement_type, status, required: true }));
    await admin.from("subcontractor_mobilization_requirements" as never).upsert(requirementRows as never, { onConflict: "company_id,assignment_id,requirement_type", ignoreDuplicates: false });
    await admin.from("trade_partner_assignments").update({ contract_status: "pending_signature" } as never).eq("company_id", companyId).eq("id", assignmentId);
    await admin.rpc("refresh_subcontractor_mobilization_status" as never, { p_company_id: companyId, p_assignment_id: assignmentId } as never);

    const url = new URL(`/subcontracts/${encodeURIComponent(token)}`, request.url).toString();
    const delivery = await sendContractEmail({
      to: email,
      subject: `${company.name} subcontract agreement — ${waSnapshot.project}`,
      html: `<p>Hello ${asText(assignment.primary_contact_name) || asText(vendor.first_name) || "there"},</p><p>${company.name} has assigned your company to <strong>${waSnapshot.project}</strong> for <strong>${assignment.trade_name}</strong>.</p><p>Please review and sign the subcontract documents using the secure link below.</p><p><a href="${url}">Review &amp; Sign Subcontract</a></p><p>This link expires in 14 days.</p>`,
    });
    await admin.from("subcontractor_signature_events" as never).insert({ company_id: companyId, vendor_id: assignment.vendor_id, assignment_id: assignmentId, master_agreement_id: master.id, work_authorization_id: authorization.id, event_type: "sent", signer_email: email, document_hash: authorization.authorization_hash, metadata: { delivery } } as never);

    return NextResponse.json({ sent: true, url, expiresAt, delivery, workAuthorizationId: authorization.id, masterAgreementId: master.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to send subcontract agreement." }, { status: 400 });
  }
}
