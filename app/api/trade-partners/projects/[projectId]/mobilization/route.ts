import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const COMPANY_REQUIREMENTS = new Set(["w9", "coi", "workers_comp", "licenses"]);
const PARTNER_ACTIONS = new Set(["safety_acknowledgement", "scope_confirmation"]);

type PartnerContext = {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  vendorId: string;
  userId: string;
  assignmentId: string;
};

async function getContext(projectId: string): Promise<PartnerContext> {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. authentication is unavailable.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to continue.");

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("company_memberships" as never)
    .select("company_id,vendor_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "subcontractor")
    .not("vendor_id", "is", null)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  const row = membership as unknown as { company_id: string; vendor_id: string | null } | null;
  if (!row?.vendor_id) throw new Error("This Trade Partner login is not linked to a company profile.");

  const { data: assignment } = await admin
    .from("trade_partner_assignments")
    .select("id")
    .eq("company_id", row.company_id)
    .eq("vendor_id", row.vendor_id)
    .eq("project_id", projectId)
    .neq("assignment_status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!assignment) throw new Error("This project is not assigned to your Trade Partner company.");

  return {
    admin,
    companyId: row.company_id,
    vendorId: row.vendor_id,
    userId: user.id,
    assignmentId: String((assignment as { id: string }).id),
  };
}

async function payload(context: PartnerContext, projectId: string) {
  const { admin, companyId, vendorId, assignmentId } = context;
  const [{ data: requirements }, { data: documents }, { data: assignment }] = await Promise.all([
    admin
      .from("subcontractor_mobilization_requirements" as never)
      .select("id,requirement_type,required,status,verified_at,expires_at,evidence")
      .eq("company_id", companyId)
      .eq("assignment_id", assignmentId)
      .order("requirement_type"),
    admin
      .from("trade_partner_onboarding_documents" as never)
      .select("id,requirement_type,original_filename,expires_at,review_status,review_note,storage_path,created_at")
      .eq("company_id", companyId)
      .eq("vendor_id", vendorId)
      .eq("status", "active")
      .order("created_at", { ascending: false }),
    admin
      .from("trade_partner_assignments")
      .select("mobilization_status,mobilization_blockers,contract_status,assignment_status")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("id", assignmentId)
      .single(),
  ]);

  const latestByType = new Map<string, Record<string, unknown>>();
  for (const raw of (documents || []) as Array<Record<string, unknown>>) {
    const type = String(raw.requirement_type || "");
    if (!latestByType.has(type)) latestByType.set(type, raw);
  }

  const companyDocuments = await Promise.all(Array.from(latestByType.values()).map(async (row) => {
    const { data: signed } = await admin.storage.from("subcontractor-compliance").createSignedUrl(String(row.storage_path), 60 * 10);
    return {
      id: row.id,
      requirementType: row.requirement_type,
      originalFilename: row.original_filename,
      expiresAt: row.expires_at,
      reviewStatus: row.review_status,
      reviewNote: row.review_note,
      createdAt: row.created_at,
      viewUrl: signed?.signedUrl || null,
    };
  }));

  return {
    assignmentId,
    assignment,
    requirements: requirements || [],
    companyDocuments,
    companyRequirementTypes: Array.from(COMPANY_REQUIREMENTS),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const context = await getContext(projectId);
    return NextResponse.json(await payload(context, projectId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load mobilization requirements." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await params;
    const context = await getContext(projectId);
    const body = await request.json() as { action?: string; accepted?: boolean };
    const action = String(body.action || "");

    if (!PARTNER_ACTIONS.has(action)) {
      return NextResponse.json({ error: "This mobilization action is not available to Trade Partners." }, { status: 400 });
    }
    if (body.accepted !== true) {
      return NextResponse.json({ error: "Confirm the acknowledgement before continuing." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await context.admin
      .from("subcontractor_mobilization_requirements" as never)
      .update({
        status: "verified",
        verified_at: now,
        verified_by: context.userId,
        evidence: {
          source: "trade_partner_self_attestation",
          actor_user_id: context.userId,
          acknowledged_at: now,
        },
        updated_at: now,
      } as never)
      .eq("company_id", context.companyId)
      .eq("assignment_id", context.assignmentId)
      .eq("requirement_type", action);

    if (error) throw new Error(error.message || "Unable to save mobilization acknowledgement.");

    await context.admin.rpc("refresh_subcontractor_mobilization_status" as never, {
      p_company_id: context.companyId,
      p_assignment_id: context.assignmentId,
    } as never);

    return NextResponse.json({ updated: true, ...(await payload(context, projectId)) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update mobilization requirements." }, { status: 400 });
  }
}
