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

type VendorRecord = {
  company_name: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};
type CompanyRecord = { id: string; name: string };
type SignResult = { signed_at: string; mobilization_status: string; blockers: unknown };

const SECURE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const secureJson = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: SECURE_HEADERS });
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function requireBearerToken(raw: string) {
  const token = raw.trim();
  if (!token || token.length > 512) throw new Error("This subcontract link is invalid or has expired.");
  return token;
}

function vendorDisplayName(vendor: VendorRecord) {
  const personName = [vendor.first_name, vendor.last_name]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ");
  return vendor.display_name?.trim() || vendor.company_name?.trim() || personName || "Subcontractor";
}

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
  if (!new Set(["draft", "sent"]).has(authorization.status)) throw new Error("This subcontract authorization can no longer be signed.");
  if (!authorization.master_agreement_id) throw new Error("Subcontract documents are incomplete.");

  const [masterResult, vendorResult, projectResult, companyResult, assignmentResult] = await Promise.all([
    admin.from("subcontractor_master_agreements" as never).select("*").eq("id", authorization.master_agreement_id).eq("company_id", authorization.company_id).eq("vendor_id", authorization.vendor_id).single(),
    admin.from("vendors").select("display_name,company_name,first_name,last_name,email").eq("id", authorization.vendor_id).eq("company_id", authorization.company_id).single(),
    admin.from("projects").select("id").eq("id", authorization.project_id).eq("company_id", authorization.company_id).single(),
    admin.from("companies").select("id,name").eq("id", authorization.company_id).single(),
    admin.from("trade_partner_assignments").select("id,vendor_id,project_id").eq("id", authorization.assignment_id).eq("company_id", authorization.company_id).eq("vendor_id", authorization.vendor_id).eq("project_id", authorization.project_id).single(),
  ]);
  const master = masterResult.data as MasterRecord | null;
  const vendor = vendorResult.data as VendorRecord | null;
  const company = companyResult.data as CompanyRecord | null;
  if (!master || !vendor || !projectResult.data || !company || !assignmentResult.data) throw new Error("Subcontract documents are incomplete.");
  if (!new Set(["draft", "sent", "signed"]).has(master.status)) throw new Error("The master subcontract agreement can no longer be signed.");
  return { admin, hash, authorization, master, vendor, company };
}

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = requireBearerToken(decodeURIComponent((await params).token));
    const context = await loadContext(token);

    // GET is deliberately read-only. Mail security scanners and link-preview bots
    // routinely pre-open URLs; a read must never create signature/audit evidence.
    return secureJson({
      company: context.company,
      vendor: { name: vendorDisplayName(context.vendor), email: context.vendor.email },
      master: { status: context.master.status, version: context.master.agreement_version, snapshot: context.master.agreement_snapshot, hash: context.master.agreement_hash, signedAt: context.master.signed_at },
      authorization: { status: context.authorization.status, version: context.authorization.authorization_version, snapshot: context.authorization.authorization_snapshot, hash: context.authorization.authorization_hash, signedAt: context.authorization.signed_at },
      expiresAt: context.authorization.token_expires_at,
    });
  } catch (error) {
    return secureJson({ error: error instanceof Error ? error.message : "Unable to open subcontract." }, 400);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = requireBearerToken(decodeURIComponent((await params).token));
    const body = await request.json() as { typedName?: string; title?: string; consentAccepted?: boolean };
    const typedName = body.typedName?.trim() || "";
    const title = body.title?.trim() || "";
    if (!typedName || !title || body.consentAccepted !== true) {
      return secureJson({ error: "Full legal name, title, and electronic-signature consent are required." }, 400);
    }
    if (typedName.length > 200 || title.length > 200) {
      return secureJson({ error: "Signer name and title must be 200 characters or fewer." }, 400);
    }

    // Resolve only the bounded token digest here. The service-role-only RPC obtains
    // the row lock and re-validates status/expiry before performing all signature,
    // evidence, assignment and mobilization writes in one transaction.
    const admin = createAdminClient();
    const hash = tokenHash(token);
    const { data, error } = await admin.rpc("sign_public_subcontract_authorization" as never, {
      p_token_hash: hash,
      p_signer_name: typedName,
      p_signer_title: title,
      p_ip_address: request.headers.get("x-forwarded-for"),
      p_user_agent: request.headers.get("user-agent"),
    } as never) as { data: SignResult[] | null; error: { message?: string } | null };
    if (error) throw new Error(error.message || "Unable to sign subcontract.");
    const result = data?.[0];
    if (!result) throw new Error("Subcontract signing returned no result.");

    return secureJson({
      signed: true,
      signedAt: result.signed_at,
      mobilizationStatus: result.mobilization_status || "not_cleared",
      blockers: result.blockers || [],
    });
  } catch (error) {
    return secureJson({ error: error instanceof Error ? error.message : "Unable to sign subcontract." }, 400);
  }
}
