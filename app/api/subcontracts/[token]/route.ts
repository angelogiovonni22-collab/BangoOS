import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type AuthorizationRecord = {
  id: string;
  company_id: string;
  project_id: string;
  assignment_id: string;
  vendor_id: string;
  master_agreement_id: string;
  status: string;
  authorization_version: string;
  authorization_snapshot: unknown;
  authorization_hash: string;
  token_expires_at: string | null;
  signed_at: string | null;
  signer_email: string | null;
};

type MasterRecord = {
  id: string;
  status: string;
  agreement_version: string;
  agreement_snapshot: unknown;
  agreement_hash: string;
  signed_at: string | null;
};

type VendorRecord = { display_name: string | null; company_name: string; email: string | null };
type CompanyRecord = { id: string; name: string };

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

async function loadContext(token: string) {
  const admin = createAdminClient();
  const hash = tokenHash(token);
  const { data: authorizationRaw } = await admin
    .from("project_subcontract_work_authorizations" as never)
    .select("*")
    .eq("public_token_hash", hash)
    .maybeSingle();
  const authorization = authorizationRaw as AuthorizationRecord | null;
  if (!authorization) throw new Error("This subcontract link is invalid or has expired.");
  if (!authorization.token_expires_at || new Date(authorization.token_expires_at) <= new Date()) throw new Error("This subcontract link has expired.");
  if (authorization.status === "void") throw new Error("This subcontract authorization has been voided.");

  const [masterResult, vendorResult, projectResult, companyResult, assignmentResult] = await Promise.all([
    admin.from("subcontractor_master_agreements" as never).select("*").eq("id", authorization.master_agreement_id).single(),
    admin.from("vendors").select("display_name,company_name,email").eq("id", authorization.vendor_id).eq("company_id", authorization.company_id).single(),
    admin.from("projects").select("id").eq("id", authorization.project_id).eq("company_id", authorization.company_id).single(),
    admin.from("companies").select("id,name").eq("id", authorization.company_id).single(),
    admin.from("trade_partner_assignments").select("id").eq("id", authorization.assignment_id).eq("company_id", authorization.company_id).single(),
  ]);
  const master = masterResult.data as MasterRecord | null;
  const vendor = vendorResult.data as VendorRecord | null;
  const company = companyResult.data as CompanyRecord | null;
  if (!master || !vendor || !projectResult.data || !company || !assignmentResult.data) throw new Error("Subcontract documents are incomplete.");
  return { admin, authorization, master, vendor, company };
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const context = await loadContext(token);
    if (context.authorization.status !== "signed") {
      await context.admin.from("subcontractor_signature_events" as never).insert({
        company_id: context.authorization.company_id,
        vendor_id: context.authorization.vendor_id,
        assignment_id: context.authorization.assignment_id,
        master_agreement_id: context.master.id,
        work_authorization_id: context.authorization.id,
        event_type: "viewed",
        document_hash: context.authorization.authorization_hash,
        ip_address: request.headers.get("x-forwarded-for"),
        user_agent: request.headers.get("user-agent"),
      } as never);
    }
    return NextResponse.json({
      company: context.company,
      vendor: { name: context.vendor.display_name || context.vendor.company_name, email: context.vendor.email },
      master: { status: context.master.status, version: context.master.agreement_version, snapshot: context.master.agreement_snapshot, hash: context.master.agreement_hash, signedAt: context.master.signed_at },
      authorization: { status: context.authorization.status, version: context.authorization.authorization_version, snapshot: context.authorization.authorization_snapshot, hash: context.authorization.authorization_hash, signedAt: context.authorization.signed_at },
      expiresAt: context.authorization.token_expires_at,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to open subcontract." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const body = await request.json() as { typedName?: string; title?: string; consentAccepted?: boolean };
    if (!body.typedName?.trim() || !body.title?.trim() || body.consentAccepted !== true) {
      return NextResponse.json({ error: "Full legal name, title, and electronic-signature consent are required." }, { status: 400 });
    }
    const { admin, authorization, master } = await loadContext(token);
    if (authorization.status === "signed") return NextResponse.json({ signed: true, alreadySigned: true, mobilizationStatus: "pending_compliance" });

    const signedAt = new Date().toISOString();
    const signerEmail = authorization.signer_email;
    if (master.status !== "signed") {
      const { error: masterError } = await admin.from("subcontractor_master_agreements" as never).update({
        status: "signed", signer_name: body.typedName.trim(), signer_title: body.title.trim(), signer_email: signerEmail,
        signed_at: signedAt, public_token_hash: null, token_expires_at: null, updated_at: signedAt,
      } as never).eq("id", master.id).eq("agreement_hash", master.agreement_hash);
      if (masterError) throw new Error(masterError.message || "Unable to sign the master subcontract agreement.");
      await admin.from("subcontractor_mobilization_requirements" as never).update({ status: "verified", verified_at: signedAt, evidence: { master_agreement_id: master.id, document_hash: master.agreement_hash } } as never).eq("company_id", authorization.company_id).eq("assignment_id", authorization.assignment_id).eq("requirement_type", "master_agreement");
    }

    const { error: authorizationError } = await admin.from("project_subcontract_work_authorizations" as never).update({
      status: "signed", signer_name: body.typedName.trim(), signer_title: body.title.trim(), signer_email: signerEmail,
      signed_at: signedAt, public_token_hash: null, token_expires_at: null, updated_at: signedAt,
    } as never).eq("id", authorization.id).eq("authorization_hash", authorization.authorization_hash);
    if (authorizationError) throw new Error(authorizationError.message || "Unable to sign the project work authorization.");

    await admin.from("subcontractor_signature_events" as never).insert({
      company_id: authorization.company_id, vendor_id: authorization.vendor_id, assignment_id: authorization.assignment_id,
      master_agreement_id: master.id, work_authorization_id: authorization.id, event_type: "signed",
      signer_name: body.typedName.trim(), signer_title: body.title.trim(), signer_email: signerEmail,
      ip_address: request.headers.get("x-forwarded-for"), user_agent: request.headers.get("user-agent"),
      document_hash: authorization.authorization_hash, metadata: { master_hash: master.agreement_hash, consent_accepted: true },
    } as never);
    await admin.from("subcontractor_mobilization_requirements" as never).update({ status: "verified", verified_at: signedAt, evidence: { work_authorization_id: authorization.id, document_hash: authorization.authorization_hash } } as never).eq("company_id", authorization.company_id).eq("assignment_id", authorization.assignment_id).eq("requirement_type", "work_authorization");
    await admin.from("subcontractor_mobilization_requirements" as never).update({ status: "verified", verified_at: signedAt, evidence: { signer_name: body.typedName.trim() } } as never).eq("company_id", authorization.company_id).eq("assignment_id", authorization.assignment_id).eq("requirement_type", "scope_confirmation");
    await admin.from("trade_partner_assignments").update({ contract_status: "signed" } as never).eq("company_id", authorization.company_id).eq("id", authorization.assignment_id);
    const { data: refreshed } = await admin.rpc("refresh_subcontractor_mobilization_status" as never, { p_company_id: authorization.company_id, p_assignment_id: authorization.assignment_id } as never) as { data: Array<{ mobilization_status: string; blockers: unknown }> | null };

    return NextResponse.json({ signed: true, signedAt, mobilizationStatus: refreshed?.[0]?.mobilization_status || "not_cleared", blockers: refreshed?.[0]?.blockers || [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign subcontract." }, { status: 400 });
  }
}
