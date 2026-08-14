import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";

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
    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("id")
      .eq("company_id", validated.companyId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (actorError || !actor?.id) throw new Error(actorError?.message || "A company owner is required to finalize this estimate.");

    const { error: signatureError } = await admin
      .from("estimate_signatures")
      .update({
        verification_result: "verified",
        metadata: {
          verification_method: "secure_email_link",
          public_token_id: validated.tokenId,
          finalized_at: new Date().toISOString(),
        },
      })
      .eq("id", signature.signatureId)
      .eq("company_id", validated.companyId);
    if (signatureError) throw new Error(signatureError.message || "Unable to finalize the signature.");

    const { error: estimateError } = await admin
      .from("estimates")
      .update({
        agreement_version_id: agreement.agreementVersionId,
        agreement_snapshot: agreement.snapshot,
        agreement_hash: agreement.agreementHash,
        approval_signature_id: signature.signatureId,
        status: "approved",
        approved_at: new Date().toISOString(),
      } as never)
      .eq("id", validated.estimateId)
      .eq("company_id", validated.companyId);
    if (estimateError) throw new Error(estimateError.message || "Unable to approve the estimate.");

    const { data: conversion, error: conversionError } = await admin.rpc(
      "convert_verified_estimate_contract" as never,
      {
        p_company_id: validated.companyId,
        p_estimate_id: validated.estimateId,
        p_signature_id: signature.signatureId,
        p_actor_profile_id: actor.id,
      } as never,
    ) as { data: Array<{ project_id: string }> | null; error: { message: string } | null };
    if (conversionError) throw new Error(conversionError.message || "Unable to create the project.");

    return NextResponse.json({
      signed: true,
      finalized: true,
      projectId: conversion?.[0]?.project_id || null,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign contract." }, { status: 400 });
  }
}
