import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { calculateOhioHomeSolicitationDeadline } from "@/lib/compliance/ohio-home-solicitation";
import { loadHomeSolicitationCompliance, recordHomeSolicitationEvaluation, recordHomeSolicitationSignature } from "@/lib/compliance/home-solicitation-service";

async function context(token: string, request: Request) {
  const admin = createAdminClient();
  const workflow = createEstimateWorkflowService(admin);
  const validated = await workflow.validatePublicToken({ token, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent") });
  if (!validated.isValid || !validated.companyId || !validated.estimateId) throw new Error(validated.failureReason || "invalid_contract_link");
  return { admin, workflow, validated: { ...validated, companyId: validated.companyId as string, estimateId: validated.estimateId as string } };
}

function conservativeOhioHoldUntil(deadlineDate: string) {
  const nextDay = new Date(`${deadlineDate}T12:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  return `${nextDay.toISOString().slice(0, 10)}T05:00:00Z`;
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const { admin, validated } = await context(token, request);
    const [{ data: estimate }, { data: items }, { data: company }] = await Promise.all([
      admin.from("estimates").select("id, title, estimate_number, description, total_amount, terms, payment_terms, scope_inclusions, scope_exclusions, version_number, status, customer_id, customers(first_name,last_name,email,address_line_1,address_line_2,city,state,postal_code,customer_type)").eq("id", validated.estimateId).eq("company_id", validated.companyId).single(),
      admin.from("estimate_line_items").select("description, quantity, unit, unit_price, line_total, sort_order").eq("estimate_id", validated.estimateId).eq("company_id", validated.companyId).order("sort_order"),
      admin.from("companies").select("name").eq("id", validated.companyId).single(),
    ]);

    let homeSolicitation = null;
    if (estimate) {
      const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
      const isOhioResidential = customer?.customer_type === "residential" && ["OH", "OHIO"].includes((customer.state || "").trim().toUpperCase());
      if (isOhioResidential) {
        const result = await loadHomeSolicitationCompliance(admin, validated.companyId, validated.estimateId);
        if (result.evaluation.applicable === true) {
          if (result.evaluation.status !== "COMPLIANT" && !result.profile.cancelledAt) throw new Error("Home-solicitation compliance is not cleared for signing.");
          const transactionDate = result.profile.transactionSignedAt?.slice(0, 10) || new Date().toISOString().slice(0, 10);
          homeSolicitation = {
            applicable: true,
            rulesetVersion: result.evaluation.rulesetVersion,
            sellerName: result.profile.sellerName,
            sellerAddress: result.profile.sellerAddress,
            sellerSignerName: result.profile.sellerSignerName,
            sellerSignedAt: result.profile.sellerSignedAt,
            cancellationEmail: result.profile.cancellationEmail,
            cancellationFax: result.profile.cancellationFax,
            transactionDate,
            cancellationDeadlineDate: result.profile.cancellationDeadlineDate || calculateOhioHomeSolicitationDeadline(transactionDate),
            cancelledAt: result.profile.cancelledAt,
          };
        }
      }
    }

    return NextResponse.json({ estimate, items: items || [], company, expiresAt: validated.expiresAt, homeSolicitation });
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
    const { data: estimate } = await admin.from("estimates").select("version_number, status, customer_id, customers(email,customer_type,state)").eq("id", validated.estimateId!).eq("company_id", validated.companyId!).single();
    if (!estimate) throw new Error("Estimate not found.");
    if (estimate.status === "approved") return NextResponse.json({ error: "This agreement has already been signed." }, { status: 409 });
    if (estimate.status === "void") return NextResponse.json({ error: "This transaction has been cancelled." }, { status: 409 });

    const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
    const isOhioResidential = customer?.customer_type === "residential" && ["OH", "OHIO"].includes((customer.state || "").trim().toUpperCase());
    let homeSolicitationResult = null;
    if (isOhioResidential) {
      homeSolicitationResult = await loadHomeSolicitationCompliance(admin, validated.companyId, validated.estimateId);
      await recordHomeSolicitationEvaluation(admin, validated.companyId, validated.estimateId, null, homeSolicitationResult.evaluation, { source: "signature_gate" });
      if (homeSolicitationResult.evaluation.status !== "COMPLIANT") throw new Error("Home-solicitation compliance requires attention before signing can be finalized.");
    }

    const signedAt = new Date().toISOString();
    const agreement = await workflow.generateAgreementSnapshot({ companyId: validated.companyId!, estimateId: validated.estimateId!, actorProfileId: null, includeSourceFields: true });
    const idempotencyKey = `contract-signature:${validated.tokenId}:${agreement.agreementHash}:${body.typedName.trim().toLowerCase()}`;
    const signature = await workflow.storeSignature({ companyId: validated.companyId!, estimateId: validated.estimateId!, agreementVersionId: agreement.agreementVersionId, estimateVersionNumber: estimate.version_number, typedName: body.typedName, consentAccepted: true, verificationResult: "unverified", idempotencyKey, publicTokenId: validated.tokenId, ipAddress: request.headers.get("x-forwarded-for"), userAgent: request.headers.get("user-agent"), metadata: homeSolicitationResult?.evaluation.applicable === true ? { home_solicitation_ruleset_version: homeSolicitationResult.evaluation.rulesetVersion, home_solicitation_applicable: true, seller_signer_name: homeSolicitationResult.profile.sellerSignerName, seller_signed_at: homeSolicitationResult.profile.sellerSignedAt } : undefined });
    await workflow.storeAcceptance({ companyId: validated.companyId, estimateId: validated.estimateId, actorProfileId: null, eventType: "signed", actorType: "customer", signatureId: signature.signatureId, idempotencyKey: `${idempotencyKey}:signed` });
    const { data: actor, error: actorError } = await admin.from("profiles").select("id").eq("company_id", validated.companyId).order("created_at").limit(1).maybeSingle();
    if (actorError || !actor?.id) throw new Error(actorError?.message || "A company owner is required to finalize this estimate.");

    const { error: signatureError } = await admin.from("estimate_signatures").update({ verification_result: "verified", metadata: { verification_method: "secure_email_link", public_token_id: validated.tokenId, finalized_at: signedAt, ...(homeSolicitationResult?.evaluation.applicable === true ? { home_solicitation_ruleset_version: homeSolicitationResult.evaluation.rulesetVersion, home_solicitation_applicable: true, seller_signer_name: homeSolicitationResult.profile.sellerSignerName, seller_signed_at: homeSolicitationResult.profile.sellerSignedAt } : {}) } }).eq("id", signature.signatureId).eq("company_id", validated.companyId);
    if (signatureError) throw new Error(signatureError.message || "Unable to finalize the signature.");

    const { error: estimateError } = await admin.from("estimates").update({ agreement_version_id: agreement.agreementVersionId, agreement_snapshot: agreement.snapshot, agreement_hash: agreement.agreementHash, approval_signature_id: signature.signatureId, status: "approved", approved_at: signedAt } as never).eq("id", validated.estimateId).eq("company_id", validated.companyId);
    if (estimateError) throw new Error(estimateError.message || "Unable to approve the estimate.");

    let cancellationDeadlineDate: string | null = null;
    if (homeSolicitationResult?.evaluation.applicable === true) {
      const signedCompliance = await recordHomeSolicitationSignature(admin, validated.companyId, validated.estimateId, signedAt);
      cancellationDeadlineDate = signedCompliance.cancellationDeadlineDate;
    }

    const { data: conversion, error: conversionError } = await admin.rpc("convert_verified_estimate_contract" as never, { p_company_id: validated.companyId, p_estimate_id: validated.estimateId, p_signature_id: signature.signatureId, p_actor_profile_id: actor.id } as never) as { data: Array<{ project_id: string }> | null; error: { message: string } | null };
    if (conversionError) throw new Error(conversionError.message || "Unable to create the project.");

    const projectId = conversion?.[0]?.project_id || null;
    if (projectId && cancellationDeadlineDate) {
      const { error: holdError } = await admin.from("projects").update({ contract_compliance_hold_active: true, contract_compliance_hold_until: conservativeOhioHoldUntil(cancellationDeadlineDate), contract_compliance_hold_reason: "Ohio home-solicitation cancellation period" } as never).eq("company_id", validated.companyId).eq("id", projectId);
      if (holdError) throw new Error(holdError.message || "Unable to apply the project compliance hold.");
    }

    return NextResponse.json({ signed: true, finalized: true, projectId, cancellationDeadlineDate, workStartHoldActive: Boolean(cancellationDeadlineDate) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to sign contract." }, { status: 400 });
  }
}
