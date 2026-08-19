import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEstimateWorkflowService } from "@/lib/estimates/workflow-service";
import { calculateOhioHomeSolicitationDeadline } from "@/lib/compliance/ohio-home-solicitation";
import { loadHomeSolicitationCompliance, recordHomeSolicitationEvaluation } from "@/lib/compliance/home-solicitation-service";
import { finalizeAgreementContractPackage } from "@/lib/compliance/contract-package";

const SECURE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const PUBLIC_ESTIMATE_SELECT = "id,title,estimate_number,description,total_amount,terms,payment_terms,scope_inclusions,scope_exclusions,version_number,status,customer_id,agreement_snapshot,customers(first_name,last_name,email,address_line_1,address_line_2,city,state,postal_code,customer_type)";
const PUBLIC_ITEM_SELECT = "description,quantity,unit,unit_price,line_total,sort_order";

function secureJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: SECURE_HEADERS });
}

async function context(token: string, request: Request) {
  const admin = createAdminClient();
  const workflow = createEstimateWorkflowService(admin);
  const validated = await workflow.validatePublicToken({
    token,
    ipAddress: request.headers.get("x-forwarded-for"),
    userAgent: request.headers.get("user-agent"),
  });
  if (!validated.isValid || !validated.companyId || !validated.estimateId) {
    throw new Error(validated.failureReason || "invalid_contract_link");
  }
  return {
    admin,
    workflow,
    validated: {
      ...validated,
      companyId: validated.companyId as string,
      estimateId: validated.estimateId as string,
    },
  };
}

async function loadPublicContract(admin: ReturnType<typeof createAdminClient>, companyId: string, estimateId: string) {
  const [{ data: estimate, error: estimateError }, { data: items, error: itemsError }, { data: company, error: companyError }] = await Promise.all([
    admin.from("estimates").select(PUBLIC_ESTIMATE_SELECT).eq("id", estimateId).eq("company_id", companyId).single(),
    admin.from("estimate_line_items").select(PUBLIC_ITEM_SELECT).eq("estimate_id", estimateId).eq("company_id", companyId).order("sort_order"),
    admin.from("companies").select("name").eq("id", companyId).single(),
  ]);
  if (estimateError || !estimate) throw new Error(estimateError?.message || "Estimate not found.");
  if (itemsError) throw new Error(itemsError.message || "Unable to load estimate items.");
  if (companyError || !company) throw new Error(companyError?.message || "Company identity is unavailable.");

  const { agreement_snapshot: agreementSnapshot, ...publicEstimate } = estimate;
  return {
    estimate,
    publicEstimate,
    agreementSnapshot,
    items: items || [],
    company,
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const { admin, validated } = await context(token, request);
    const contract = await loadPublicContract(admin, validated.companyId, validated.estimateId);

    let homeSolicitation = null;
    const customer = Array.isArray(contract.estimate.customers) ? contract.estimate.customers[0] : contract.estimate.customers;
    const isOhioResidential = customer?.customer_type === "residential" && ["OH", "OHIO"].includes((customer.state || "").trim().toUpperCase());
    if (isOhioResidential) {
      const result = await loadHomeSolicitationCompliance(admin, validated.companyId, validated.estimateId);
      if (result.evaluation.applicable === true) {
        if (result.evaluation.status !== "COMPLIANT" && !result.profile.cancelledAt) {
          throw new Error("Home-solicitation compliance is not cleared for signing.");
        }
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

    const signedDocument = contract.estimate.status === "approved"
      ? (contract.agreementSnapshot as { contractDocument?: { estimate?: unknown; items?: unknown[]; company?: unknown } } | null)?.contractDocument
      : null;

    return secureJson({
      estimate: signedDocument?.estimate || contract.publicEstimate,
      items: signedDocument?.items || contract.items,
      company: signedDocument?.company || contract.company,
      expiresAt: validated.expiresAt,
      homeSolicitation,
    });
  } catch (error) {
    return secureJson({ error: error instanceof Error ? error.message : "Invalid contract link." }, 400);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const token = decodeURIComponent((await params).token);
    const body = await request.json() as { typedName?: string; consentAccepted?: boolean };
    const typedName = body.typedName?.trim() || "";
    if (!typedName || body.consentAccepted !== true) {
      return secureJson({ error: "Your legal name and consent are required." }, 400);
    }
    if (typedName.length > 200) {
      return secureJson({ error: "Your legal name must be 200 characters or fewer." }, 400);
    }

    const { admin, workflow, validated } = await context(token, request);
    if (!validated.tokenId) throw new Error("Contract token identity is unavailable.");

    const contract = await loadPublicContract(admin, validated.companyId, validated.estimateId);
    const estimate = contract.estimate;
    if (estimate.status === "approved") return secureJson({ error: "This agreement has already been signed." }, 409);
    if (estimate.status === "void") return secureJson({ error: "This transaction has been cancelled." }, 409);

    const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
    const isOhioResidential = customer?.customer_type === "residential" && ["OH", "OHIO"].includes((customer.state || "").trim().toUpperCase());
    let homeSolicitationResult = null;
    if (isOhioResidential) {
      homeSolicitationResult = await loadHomeSolicitationCompliance(admin, validated.companyId, validated.estimateId);
      await recordHomeSolicitationEvaluation(
        admin,
        validated.companyId,
        validated.estimateId,
        null,
        homeSolicitationResult.evaluation,
        { source: "signature_gate" },
      );
      if (homeSolicitationResult.evaluation.status !== "COMPLIANT") {
        throw new Error("Home-solicitation compliance requires attention before signing can be finalized.");
      }
    }

    const signedAt = new Date().toISOString();
    const contractDocument = {
      capturedAt: signedAt,
      company: contract.company,
      estimate: contract.publicEstimate,
      items: contract.items,
    };
    const agreement = await workflow.generateAgreementSnapshot({
      companyId: validated.companyId,
      estimateId: validated.estimateId,
      actorProfileId: null,
      includeSourceFields: true,
    });
    const finalizedAgreement = await finalizeAgreementContractPackage(admin, {
      companyId: validated.companyId,
      estimateId: validated.estimateId,
      agreementVersionId: agreement.agreementVersionId,
      baseSnapshot: agreement.snapshot,
      baseAgreementHash: agreement.agreementHash,
      signingAt: signedAt,
      contractDocument,
    });
    const contractPackageMetadata = {
      contract_package_version: finalizedAgreement.compliancePackage.packageVersion,
      contract_package_hash: finalizedAgreement.compliancePackage.packageHash,
      agreement_hash: finalizedAgreement.agreementHash,
    };
    const idempotencyKey = `contract-signature:${validated.tokenId}:${finalizedAgreement.agreementHash}:${typedName.toLowerCase()}`;
    const signatureMetadata = {
      verification_method: "secure_contract_link",
      public_token_id: validated.tokenId,
      finalized_at: signedAt,
      ...contractPackageMetadata,
      ...(homeSolicitationResult?.evaluation.applicable === true ? {
        home_solicitation_ruleset_version: homeSolicitationResult.evaluation.rulesetVersion,
        home_solicitation_applicable: true,
        seller_signer_name: homeSolicitationResult.profile.sellerSignerName,
        seller_signed_at: homeSolicitationResult.profile.sellerSignedAt,
      } : {}),
    };
    const signature = await workflow.storeSignature({
      companyId: validated.companyId,
      estimateId: validated.estimateId,
      agreementVersionId: agreement.agreementVersionId,
      estimateVersionNumber: estimate.version_number,
      typedName,
      consentAccepted: true,
      verificationResult: "unverified",
      idempotencyKey,
      publicTokenId: validated.tokenId,
      ipAddress: request.headers.get("x-forwarded-for"),
      userAgent: request.headers.get("user-agent"),
      metadata: signatureMetadata,
    });

    const { data: company, error: companyError } = await admin
      .from("companies")
      .select("owner_id")
      .eq("id", validated.companyId)
      .single();
    if (companyError || !company?.owner_id) {
      throw new Error(companyError?.message || "A company owner is required to finalize this estimate.");
    }
    const { data: actor, error: actorError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", company.owner_id)
      .eq("company_id", validated.companyId)
      .maybeSingle();
    if (actorError || !actor?.id) {
      throw new Error(actorError?.message || "The company owner profile is required to finalize this estimate.");
    }

    const homeSolicitationApplicable = homeSolicitationResult?.evaluation.applicable === true;
    const cancellationDeadlineDate = homeSolicitationApplicable
      ? calculateOhioHomeSolicitationDeadline(signedAt.slice(0, 10))
      : null;

    const { data: finalization, error: finalizationError } = await admin.rpc(
      "finalize_verified_estimate_contract_signature" as never,
      {
        p_company_id: validated.companyId,
        p_estimate_id: validated.estimateId,
        p_public_token_id: validated.tokenId,
        p_signature_id: signature.signatureId,
        p_agreement_version_id: agreement.agreementVersionId,
        p_agreement_snapshot: finalizedAgreement.snapshot,
        p_agreement_hash: finalizedAgreement.agreementHash,
        p_signed_at: signedAt,
        p_actor_profile_id: actor.id,
        p_signature_metadata: signatureMetadata,
        p_acceptance_idempotency_key: `${idempotencyKey}:signed`,
        p_home_solicitation_applicable: homeSolicitationApplicable,
        p_cancellation_deadline_date: cancellationDeadlineDate,
      } as never,
    ) as { data: Array<{ project_id: string | null; cancellation_deadline_date: string | null; idempotent: boolean }> | null; error: { message?: string } | null };
    if (finalizationError) {
      throw new Error(finalizationError.message || "Unable to finalize the signed agreement atomically.");
    }
    const finalized = finalization?.[0];
    if (!finalized) throw new Error("Contract finalization returned no result.");

    return secureJson({
      signed: true,
      finalized: true,
      projectId: finalized.project_id || null,
      cancellationDeadlineDate: finalized.cancellation_deadline_date || cancellationDeadlineDate,
      workStartHoldActive: Boolean(finalized.cancellation_deadline_date || cancellationDeadlineDate),
      contractPackageVersion: finalizedAgreement.compliancePackage.packageVersion,
      contractPackageHash: finalizedAgreement.compliancePackage.packageHash,
      agreementHash: finalizedAgreement.agreementHash,
      idempotent: Boolean(finalized.idempotent),
    });
  } catch (error) {
    return secureJson({ error: error instanceof Error ? error.message : "Unable to sign contract." }, 400);
  }
}
