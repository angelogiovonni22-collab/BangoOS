import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { sendContractEmail } from "@/lib/estimates/contract-email";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");

async function context(token: string, request: Request) {
  const admin = createAdminClient();
  const workflow = createEstimateWorkflowService(admin);
  const validated = await workflow.validatePublicToken({ token, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") });
  if (!validated.isValid || !validated.companyId || !validated.estimateId) throw new Error(validated.failureReason || "invalid_contract_link");
  return { admin, workflow, validated: { ...validated, companyId: validated.companyId as string, estimateId: validated.estimateId as string } };
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const { admin, validated } = await context(token, request);
    const [{ data: estimate }, { data: items }, { data: company }] = await Promise.all([
      admin.from("estimates").select("id, title, estimate_number, description, total_amount, terms, payment_terms, scope_inclusions, scope_exclusions, version_number, status, customer_id, customers(first_name,last_name,email,address_line_1,address_line_2,city,state,postal_code)").eq("id", validated.estimateId).eq("company_id", validated.companyId).single(),
      admin.from("estimate_line_items").select("description, quantity, unit, unit_price, line_total, sort_order").eq("estimate_id", validated.estimateId).eq("company_id", validated.companyId).order("sort_order"),
      admin.from("companies").select("name").eq("id", validated.companyId).single(),
    ]);
    return NextResponse.json({ estimate, items: items || [], company, expiresAt: validated.expiresAt });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Invalid contract link." }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const body = await request.json() as { typedName?: string; consentAccepted?: boolean };
    if (!body.typedName?.trim() || body.consentAccepted !== true) return NextResponse.json({ error: "Your legal name and consent are required." }, { status: 400 });
    const { admin, workflow, validated } = await context(token, request);
    const { data: estimate } = await admin.from("estimates").select("version_number, customer_id, customers(email)").eq("id", validated.estimateId!).eq("company_id", validated.companyId!).single();
    if (!estimate) throw new Error("Estimate not found.");
    const agreement = await workflow.generateAgreementSnapshot({ companyId: validated.companyId!, estimateId: validated.estimateId!, actorProfileId: null, includeSourceFields: true });
    const idempotencyKey = `contract-signature:${validated.tokenId}:${agreement.agreementHash}:${body.typedName.trim().toLowerCase()}`;
    const signature = await workflow.storeSignature({ companyId: validated.companyId!, estimateId: validated.estimateId!, agreementVersionId: agreement.agreementVersionId, estimateVersionNumber: estimate.version_number, typedName: body.typedName, consentAccepted: true, verificationResult: "unverified", idempotencyKey, publicTokenId: validated.tokenId, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") });
    await workflow.storeAcceptance({ companyId: validated.companyId, estimateId: validated.estimateId, actorProfileId: null, eventType: "signed", actorType: "customer", signatureId: signature.signatureId, idempotencyKey: `${idempotencyKey}:signed` });
    const verificationToken = randomBytes(32).toString("base64url");
    await admin.from("estimate_contract_verifications" as never).upsert({ company_id: validated.companyId, estimate_id: validated.estimateId, signature_id: signature.signatureId, token_hash: hash(verificationToken), email: (Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers)?.email, expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), status: "pending" } as never, { onConflict: "signature_id" });
    await admin.from("estimates").update({ agreement_version_id: agreement.agreementVersionId, agreement_snapshot: agreement.snapshot, agreement_hash: agreement.agreementHash, approval_signature_id: signature.signatureId } as never).eq("id", validated.estimateId).eq("company_id", validated.companyId);
    const verifyUrl = new URL(`/api/contracts/verify?token=${encodeURIComponent(verificationToken)}`, request.url).toString();
    const email = (Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers)?.email;
    const delivery = email ? await sendContractEmail({ to: email, subject: "Verify your signed contract", html: `<p>Thank you for signing.</p><p><a href="${verifyUrl}">Verify your email and finalize the contract</a></p><p>This link expires in 24 hours.</p>` }) : { delivered: false, providerId: null, reason: "customer_email_missing" };
    await admin.from("estimate_contract_verifications" as never).update({ delivery_status: delivery.delivered ? "delivered" : "failed", provider_message_id: delivery.providerId, delivery_error: delivery.reason } as never).eq("signature_id", signature.signatureId);
    return NextResponse.json({ signed: true, verificationEmailSent: delivery.delivered, ...(process.env.NODE_ENV !== "production" ? { verifyUrl } : {}) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign contract." }, { status: 400 });
  }
}
