import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

async function workspaceContext(projectId: string, assignmentId: string) {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. database is unavailable.");
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) throw new Error(workspace.errorMessage || "Unauthorized.");
  const admin = createAdminClient();
  const { data: assignment } = await admin.from("trade_partner_assignments").select("id,company_id,project_id,vendor_id,contract_status").eq("company_id", workspace.context.companyId).eq("project_id", projectId).eq("id", assignmentId).single();
  if (!assignment) throw new Error("Subcontractor assignment not found.");
  return { admin, workspace: workspace.context, assignment };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const { admin, workspace, assignment } = await workspaceContext(projectId, assignmentId);
    const [{ data: authorization }, { data: master }, { data: requirements }, { data: refreshed }] = await Promise.all([
      admin.from("project_subcontract_work_authorizations" as never).select("id,status,signed_at,sent_at,authorization_hash").eq("company_id", workspace.companyId).eq("assignment_id", assignmentId).maybeSingle(),
      admin.from("subcontractor_master_agreements" as never).select("id,status,signed_at,agreement_hash").eq("company_id", workspace.companyId).eq("vendor_id", assignment.vendor_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("subcontractor_mobilization_requirements" as never).select("requirement_type,required,status,verified_at,expires_at,evidence").eq("company_id", workspace.companyId).eq("assignment_id", assignmentId).order("requirement_type"),
      admin.rpc("refresh_subcontractor_mobilization_status" as never, { p_company_id: workspace.companyId, p_assignment_id: assignmentId } as never),
    ]);
    const row = Array.isArray(refreshed) ? refreshed[0] : null;
    return NextResponse.json({ assignmentContractStatus: assignment.contract_status, authorization, master, requirements: requirements || [], mobilizationStatus: row?.mobilization_status || "not_cleared", blockers: row?.blockers || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load mobilization status." }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  try {
    const { id: projectId, assignmentId } = await params;
    const body = await request.json() as { requirementType?: string; status?: string; expiresAt?: string | null; note?: string | null };
    const allowedTypes = new Set(["w9","coi","workers_comp","licenses","safety_acknowledgement"]);
    const allowedStatuses = new Set(["missing","pending","verified","waived","expired"]);
    if (!body.requirementType || !allowedTypes.has(body.requirementType)) return NextResponse.json({ error: "This requirement cannot be changed manually." }, { status: 400 });
    if (!body.status || !allowedStatuses.has(body.status)) return NextResponse.json({ error: "Invalid requirement status." }, { status: 400 });
    const { admin, workspace } = await workspaceContext(projectId, assignmentId);
    const verifiedAt = body.status === "verified" || body.status === "waived" ? new Date().toISOString() : null;
    const { error } = await admin.from("subcontractor_mobilization_requirements" as never).update({ status: body.status, verified_at: verifiedAt, verified_by: verifiedAt ? workspace.userId : null, expires_at: body.expiresAt || null, evidence: { note: body.note || null, reviewed_by: workspace.userId } } as never).eq("company_id", workspace.companyId).eq("assignment_id", assignmentId).eq("requirement_type", body.requirementType);
    if (error) throw new Error(error.message || "Unable to update requirement.");
    const { data: refreshed } = await admin.rpc("refresh_subcontractor_mobilization_status" as never, { p_company_id: workspace.companyId, p_assignment_id: assignmentId } as never) as { data: Array<{ mobilization_status: string; blockers: unknown }> | null };
    return NextResponse.json({ updated: true, mobilizationStatus: refreshed?.[0]?.mobilization_status || "not_cleared", blockers: refreshed?.[0]?.blockers || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update mobilization requirement." }, { status: 400 });
  }
}
