import { createHash, randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createWorkflowEngine } from "@/lib/workflows";
import type {
  CreateDepositInvoiceInput,
  EstimateApprovalInput,
  EstimateConversionResult,
  EstimateWorkflowService,
  GenerateAgreementSnapshotInput,
  GeneratePublicTokenInput,
  StoreAcceptanceInput,
  StoreSignatureInput,
  ValidatePublicTokenInput,
} from "./workflow-types";
import { BOS_ELECTRONIC_TERMS_VERSION, CONSTRUCTION_AGREEMENT_VERSION, constructionAgreementSections } from "./construction-agreement";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

type EstimateRow = {
  id: string;
  company_id: string;
  customer_id: string | null;
  project_id: string | null;
  title: string;
  description: string | null;
  total_amount: number;
  direct_cost_subtotal: number;
  version_number: number;
  terms: string | null;
  payment_terms: string | null;
  status: string;
  deposit_type: string;
  deposit_value: number;
};

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function computeDepositAmount(depositType: string, depositValue: number, totalAmount: number) {
  if (depositType === "percentage") {
    return Number(Math.max(0, (totalAmount * depositValue) / 100).toFixed(2));
  }

  if (depositType === "fixed") {
    return Number(Math.min(Math.max(0, depositValue), Math.max(0, totalAmount)).toFixed(2));
  }

  return 0;
}

async function loadEstimate(db: AnySupabase, companyId: string, estimateId: string) {
  const { data, error } = await db
    .from("estimates")
    .select("id, company_id, customer_id, project_id, title, description, total_amount, direct_cost_subtotal, version_number, terms, payment_terms, status, deposit_type, deposit_value")
    .eq("company_id", companyId)
    .eq("id", estimateId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Unable to load estimate.");
  }

  if (!data) {
    throw new Error("Estimate not found.");
  }

  return data as EstimateRow;
}

function normalizeTtlHours(ttlHours: number | undefined) {
  if (!ttlHours) {
    return 72;
  }

  if (ttlHours < 1) {
    return 1;
  }

  if (ttlHours > 24 * 30) {
    return 24 * 30;
  }

  return Math.floor(ttlHours);
}

export function createEstimateWorkflowService(supabase: SupabaseClient<Database>): EstimateWorkflowService {
  const db = supabase as unknown as AnySupabase;
  const workflow = createWorkflowEngine(supabase);

  async function validatePublicToken(input: ValidatePublicTokenInput) {
    const { data, error } = await db.rpc("validate_estimate_public_token", {
      p_token: input.token,
      p_ip_address: input.ipAddress || null,
      p_user_agent: input.userAgent || null,
    });

    if (error) {
      throw new Error(error.message || "Unable to validate public token.");
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      isValid: Boolean(row?.is_valid),
      tokenId: (row?.token_id as string | null) || null,
      companyId: (row?.company_id as string | null) || null,
      estimateId: (row?.estimate_id as string | null) || null,
      expiresAt: (row?.expires_at as string | null) || null,
      failureReason: (row?.failure_reason as string | null) || null,
    };
  }

  async function generateAgreementSnapshot(input: GenerateAgreementSnapshotInput) {
    const estimate = await loadEstimate(db, input.companyId, input.estimateId);

    const { data: existingVersions, error: existingVersionsError } = await db
      .from("estimate_agreement_versions")
      .select("version_number")
      .eq("company_id", input.companyId)
      .eq("estimate_id", input.estimateId)
      .order("version_number", { ascending: false })
      .limit(1);

    if (existingVersionsError) {
      throw new Error(existingVersionsError.message || "Unable to load agreement versions.");
    }

    const nextVersion = ((existingVersions?.[0]?.version_number as number | undefined) || 0) + 1;

    const snapshot = {
      estimateId: estimate.id,
      estimateVersion: estimate.version_number,
      title: estimate.title,
      terms: estimate.terms,
      paymentTerms: estimate.payment_terms,
      constructionAgreement: {
        version: CONSTRUCTION_AGREEMENT_VERSION,
        sections: constructionAgreementSections,
      },
      electronicSignaturePlatformTermsVersion: BOS_ELECTRONIC_TERMS_VERSION,
      generatedAt: new Date().toISOString(),
      includeSourceFields: Boolean(input.includeSourceFields),
    };

    const agreementHash = sha256(JSON.stringify(snapshot));

    const { data: inserted, error: insertError } = await db
      .from("estimate_agreement_versions")
      .insert({
        company_id: input.companyId,
        estimate_id: input.estimateId,
        version_number: nextVersion,
        agreement_snapshot: snapshot,
        agreement_hash: agreementHash,
        source_terms: input.includeSourceFields ? estimate.terms : null,
        source_payment_terms: input.includeSourceFields ? estimate.payment_terms : null,
        created_by: input.actorProfileId,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message || "Unable to create agreement snapshot.");
    }

    return {
      agreementVersionId: inserted.id as string,
      versionNumber: nextVersion,
      agreementHash,
      snapshot,
    };
  }

  async function storeSignature(input: StoreSignatureInput) {
    const signatureHash = sha256([
      input.companyId,
      input.estimateId,
      input.agreementVersionId,
      input.estimateVersionNumber,
      input.typedName.trim().toLowerCase(),
      input.consentAccepted ? "1" : "0",
      input.idempotencyKey,
    ].join("|"));

    const { data: existingByKey, error: existingByKeyError } = await db
      .from("estimate_signatures")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("estimate_id", input.estimateId)
      .eq("idempotency_key", input.idempotencyKey)
      .maybeSingle();

    if (existingByKeyError) {
      throw new Error(existingByKeyError.message || "Unable to verify existing signatures.");
    }

    if (existingByKey?.id) {
      return { signatureId: existingByKey.id as string };
    }

    const { data: existingByHash, error: existingByHashError } = await db
      .from("estimate_signatures")
      .select("id")
      .eq("company_id", input.companyId)
      .eq("estimate_id", input.estimateId)
      .eq("signature_hash", signatureHash)
      .maybeSingle();

    if (existingByHashError) {
      throw new Error(existingByHashError.message || "Unable to verify signature hash.");
    }

    if (existingByHash?.id) {
      return { signatureId: existingByHash.id as string };
    }

    const { data: inserted, error: insertError } = await db
      .from("estimate_signatures")
      .insert({
        company_id: input.companyId,
        estimate_id: input.estimateId,
        agreement_version_id: input.agreementVersionId,
        estimate_version_number: input.estimateVersionNumber,
        typed_name: input.typedName.trim(),
        consent_accepted: input.consentAccepted,
        ip_address: input.ipAddress || null,
        user_agent: input.userAgent || null,
        verification_result: input.verificationResult,
        signature_hash: signatureHash,
        idempotency_key: input.idempotencyKey,
        public_token_id: input.publicTokenId || null,
        metadata: input.metadata || {},
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message || "Unable to store signature.");
    }

    return { signatureId: inserted.id as string };
  }

  async function storeAcceptance(input: StoreAcceptanceInput) {
    if (input.idempotencyKey) {
      const { data: existing, error: existingError } = await db
        .from("estimate_acceptance_events")
        .select("id")
        .eq("company_id", input.companyId)
        .eq("estimate_id", input.estimateId)
        .eq("idempotency_key", input.idempotencyKey)
        .maybeSingle();

      if (existingError) {
        throw new Error(existingError.message || "Unable to verify acceptance idempotency.");
      }

      if (existing?.id) {
        return { acceptanceEventId: existing.id as string };
      }
    }

    const { data: inserted, error: insertError } = await db
      .from("estimate_acceptance_events")
      .insert({
        company_id: input.companyId,
        estimate_id: input.estimateId,
        signature_id: input.signatureId || null,
        event_type: input.eventType,
        actor_type: input.actorType,
        actor_profile_id: input.actorProfileId,
        reason: input.reason || null,
        idempotency_key: input.idempotencyKey || null,
        metadata: input.metadata || {},
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message || "Unable to store acceptance event.");
    }

    return { acceptanceEventId: inserted.id as string };
  }

  async function generatePublicToken(input: GeneratePublicTokenInput) {
    const estimate = await loadEstimate(db, input.companyId, input.estimateId);
    const ttlHours = normalizeTtlHours(input.ttlHours);
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

    const rawToken = `${randomBytes(24).toString("hex")}.${randomBytes(24).toString("base64url")}`;
    const tokenHash = sha256(rawToken);

    const { data: inserted, error: insertError } = await db
      .from("estimate_public_tokens")
      .insert({
        company_id: input.companyId,
        estimate_id: input.estimateId,
        token_hash: tokenHash,
        expires_at: expiresAt,
        issued_by: input.actorProfileId,
        metadata: {
          ...(input.metadata || {}),
          estimate_status: estimate.status,
          estimate_version: estimate.version_number,
        },
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      throw new Error(insertError?.message || "Unable to generate public token.");
    }

    await db
      .from("estimates")
      .update({
        public_token_last_issued_at: new Date().toISOString(),
        updated_by: input.actorProfileId,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.estimateId);

    return {
      token: rawToken,
      tokenId: inserted.id as string,
      expiresAt,
    };
  }

  async function approveEstimate(input: EstimateApprovalInput) {
    if (!input.consentAccepted) {
      throw new Error("Consent is required to approve an estimate.");
    }

    const estimate = await loadEstimate(db, input.companyId, input.estimateId);

    let tokenId: string | null = null;
    if (input.publicToken) {
      const tokenValidation = await validatePublicToken({
        token: input.publicToken,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      });

      if (!tokenValidation.isValid) {
        throw new Error(`Token validation failed: ${tokenValidation.failureReason || "unknown_error"}`);
      }

      if (tokenValidation.companyId !== input.companyId || tokenValidation.estimateId !== input.estimateId) {
        throw new Error("Public token does not match target estimate.");
      }

      tokenId = tokenValidation.tokenId;
    }

    const agreement = await generateAgreementSnapshot({
      companyId: input.companyId,
      estimateId: input.estimateId,
      actorProfileId: input.actorProfileId,
      includeSourceFields: true,
    });

    const signature = await storeSignature({
      companyId: input.companyId,
      estimateId: input.estimateId,
      agreementVersionId: agreement.agreementVersionId,
      estimateVersionNumber: estimate.version_number,
      typedName: input.typedName,
      consentAccepted: input.consentAccepted,
      verificationResult: input.verificationResult || "not_available",
      idempotencyKey: input.idempotencyKey,
      publicTokenId: tokenId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: input.metadata,
    });

    const acceptance = await storeAcceptance({
      companyId: input.companyId,
      estimateId: input.estimateId,
      actorProfileId: input.actorProfileId,
      eventType: "approved",
      actorType: input.publicToken ? "customer" : "internal",
      signatureId: signature.signatureId,
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    const depositAmount = computeDepositAmount(estimate.deposit_type, estimate.deposit_value, estimate.total_amount);

    const { error: updateError } = await db
      .from("estimates")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        agreement_version_id: agreement.agreementVersionId,
        agreement_snapshot: agreement.snapshot,
        agreement_hash: agreement.agreementHash,
        approval_signature_id: signature.signatureId,
        deposit_amount: depositAmount,
        updated_by: input.actorProfileId,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.estimateId);

    if (updateError) {
      throw new Error(updateError.message || "Unable to update estimate status.");
    }

    await workflow.recordTransition({
      companyId: input.companyId,
      workflowName: "estimate_lifecycle",
      eventType: "estimate.approved",
      currentState: estimate.status,
      nextState: "approved",
      actorProfileId: input.actorProfileId,
      referenceEntity: "estimate",
      referenceId: input.estimateId,
      metadata: {
        signatureId: signature.signatureId,
        agreementVersionId: agreement.agreementVersionId,
      },
    });

    return {
      signatureId: signature.signatureId,
      acceptanceEventId: acceptance.acceptanceEventId,
      agreementVersionId: agreement.agreementVersionId,
    };
  }

  async function declineEstimate(input: {
    companyId: string;
    estimateId: string;
    actorProfileId: string | null;
    idempotencyKey: string;
    reason: string;
    publicToken?: string;
    metadata?: Record<string, unknown>;
  }) {
    const estimate = await loadEstimate(db, input.companyId, input.estimateId);

    if (input.publicToken) {
      const tokenValidation = await validatePublicToken({ token: input.publicToken });
      if (!tokenValidation.isValid) {
        throw new Error(`Token validation failed: ${tokenValidation.failureReason || "unknown_error"}`);
      }
      if (tokenValidation.companyId !== input.companyId || tokenValidation.estimateId !== input.estimateId) {
        throw new Error("Public token does not match target estimate.");
      }
    }

    const acceptance = await storeAcceptance({
      companyId: input.companyId,
      estimateId: input.estimateId,
      actorProfileId: input.actorProfileId,
      eventType: "declined",
      actorType: input.publicToken ? "customer" : "internal",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      metadata: input.metadata,
    });

    const { error: updateError } = await db
      .from("estimates")
      .update({
        status: "rejected",
        declined_at: new Date().toISOString(),
        decline_reason: input.reason,
        updated_by: input.actorProfileId,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.estimateId);

    if (updateError) {
      throw new Error(updateError.message || "Unable to update estimate status.");
    }

    await workflow.recordTransition({
      companyId: input.companyId,
      workflowName: "estimate_lifecycle",
      eventType: "estimate.declined",
      currentState: estimate.status,
      nextState: "rejected",
      actorProfileId: input.actorProfileId,
      referenceEntity: "estimate",
      referenceId: input.estimateId,
      metadata: { reason: input.reason },
    });

    return { acceptanceEventId: acceptance.acceptanceEventId };
  }

  async function requestChanges(input: {
    companyId: string;
    estimateId: string;
    actorProfileId: string | null;
    idempotencyKey: string;
    reason: string;
    publicToken?: string;
    metadata?: Record<string, unknown>;
  }) {
    const estimate = await loadEstimate(db, input.companyId, input.estimateId);

    if (input.publicToken) {
      const tokenValidation = await validatePublicToken({ token: input.publicToken });
      if (!tokenValidation.isValid) {
        throw new Error(`Token validation failed: ${tokenValidation.failureReason || "unknown_error"}`);
      }
      if (tokenValidation.companyId !== input.companyId || tokenValidation.estimateId !== input.estimateId) {
        throw new Error("Public token does not match target estimate.");
      }
    }

    const acceptance = await storeAcceptance({
      companyId: input.companyId,
      estimateId: input.estimateId,
      actorProfileId: input.actorProfileId,
      eventType: "request_changes",
      actorType: input.publicToken ? "customer" : "internal",
      idempotencyKey: input.idempotencyKey,
      reason: input.reason,
      metadata: input.metadata,
    });

    const { error: updateError } = await db
      .from("estimates")
      .update({
        status: "revision_requested",
        revision_requested_at: new Date().toISOString(),
        revision_request_notes: input.reason,
        updated_by: input.actorProfileId,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.estimateId);

    if (updateError) {
      throw new Error(updateError.message || "Unable to update estimate status.");
    }

    await workflow.recordTransition({
      companyId: input.companyId,
      workflowName: "estimate_lifecycle",
      eventType: "estimate.request_changes",
      currentState: estimate.status,
      nextState: "revision_requested",
      actorProfileId: input.actorProfileId,
      referenceEntity: "estimate",
      referenceId: input.estimateId,
      metadata: { reason: input.reason },
    });

    return { acceptanceEventId: acceptance.acceptanceEventId };
  }

  async function calculateDeposit(companyId: string, estimateId: string) {
    const { data, error } = await db.rpc("calculate_estimate_deposit", {
      p_company_id: companyId,
      p_estimate_id: estimateId,
    });

    if (error) {
      throw new Error(error.message || "Unable to calculate deposit.");
    }

    if (typeof data === "number") {
      return data;
    }

    return Number(data || 0);
  }

  async function getConversionResult(companyId: string, estimateId: string, idempotencyKey?: string): Promise<EstimateConversionResult | null> {
    let query = db
      .from("estimate_project_conversions")
      .select("id, project_id, deposit_invoice_id, status, idempotency_key")
      .eq("company_id", companyId)
      .eq("estimate_id", estimateId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (idempotencyKey) {
      query = query.eq("idempotency_key", idempotencyKey);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || "Unable to load conversion result.");
    }

    const row = data?.[0];
    if (!row) {
      return null;
    }

    let projectNumber: string | null = null;

    if (row.project_id) {
      const { data: project, error: projectError } = await db
        .from("projects")
        .select("project_number")
        .eq("company_id", companyId)
        .eq("id", row.project_id)
        .maybeSingle();

      if (!projectError) {
        projectNumber = (project?.project_number as string | null) || null;
      }
    }

    return {
      conversionId: row.id as string,
      projectId: (row.project_id as string | null) || null,
      projectNumber,
      depositInvoiceId: (row.deposit_invoice_id as string | null) || null,
      status: (row.status as string) || "started",
      idempotent: Boolean(idempotencyKey) && row.idempotency_key === idempotencyKey,
    };
  }

  async function createDepositInvoice(input: CreateDepositInvoiceInput) {
    const estimate = await loadEstimate(db, input.companyId, input.estimateId);

    const depositAmount = await calculateDeposit(input.companyId, input.estimateId);

    if (depositAmount <= 0) {
      throw new Error("Deposit amount must be greater than zero.");
    }

    const existingConversion = await getConversionResult(input.companyId, input.estimateId, input.idempotencyKey);

    if (existingConversion?.depositInvoiceId) {
      return {
        invoiceId: existingConversion.depositInvoiceId,
        amount: depositAmount,
        created: false,
      };
    }

    const { data: existingDepositLink, error: existingDepositLinkError } = await db
      .from("invoice_estimate_links")
      .select("invoice_id")
      .eq("company_id", input.companyId)
      .eq("estimate_id", input.estimateId)
      .eq("link_type", "converted")
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingDepositLinkError) {
      throw new Error(existingDepositLinkError.message || "Unable to verify existing deposit invoices.");
    }

    const existingInvoiceId = (existingDepositLink?.[0]?.invoice_id as string | undefined) || null;

    if (existingInvoiceId) {
      return { invoiceId: existingInvoiceId, amount: depositAmount, created: false };
    }

    const { data: invoice, error: invoiceError } = await db
      .from("invoices")
      .insert({
        company_id: input.companyId,
        title: `Deposit - ${estimate.title}`,
        customer_id: estimate.customer_id,
        project_id: estimate.project_id,
        estimate_id: estimate.id,
        issue_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        status: "draft",
        description: "Deposit invoice generated by estimate workflow.",
        subtotal: depositAmount,
        discount_type: "none",
        discount_value: 0,
        discount_total: 0,
        tax_rate: 0,
        tax_amount: 0,
        additional_fee: 0,
        total_amount: depositAmount,
        amount_paid: 0,
        notes: "Deposit invoice",
        payment_terms: estimate.payment_terms,
        created_by: input.actorProfileId,
        updated_by: input.actorProfileId,
      })
      .select("id")
      .single();

    if (invoiceError || !invoice?.id) {
      throw new Error(invoiceError?.message || "Unable to create deposit invoice.");
    }

    await db
      .from("invoice_estimate_links")
      .upsert({
        company_id: input.companyId,
        invoice_id: invoice.id,
        estimate_id: estimate.id,
        link_type: "converted",
        created_by: input.actorProfileId,
        metadata: {
          kind: "deposit",
          idempotency_key: input.idempotencyKey,
        },
      }, { onConflict: "invoice_id,estimate_id" });

    await db
      .from("estimates")
      .update({
        deposit_amount: depositAmount,
        deposit_invoice_id: invoice.id,
        updated_by: input.actorProfileId,
      })
      .eq("company_id", input.companyId)
      .eq("id", input.estimateId);

    await workflow.recordTransition({
      companyId: input.companyId,
      workflowName: "deposit_lifecycle",
      eventType: "deposit.created",
      currentState: null,
      nextState: "draft",
      actorProfileId: input.actorProfileId,
      referenceEntity: "invoice",
      referenceId: invoice.id as string,
      metadata: {
        estimateId: input.estimateId,
        amount: depositAmount,
      },
    });

    const orion = createSupabaseOrionEventPublisher(db as unknown as SupabaseClient<Database>);
    await orion.publishEvent({
      company_id: input.companyId,
      actor_profile_id: input.actorProfileId,
      event_type: "estimate.deposit_requested",
      aggregate_type: "estimate",
      aggregate_id: input.estimateId,
      source_module: "estimates",
      payload: {
        estimate_id: input.estimateId,
        invoice_id: invoice.id,
        amount: depositAmount,
        deep_link: `/estimates/${input.estimateId}`,
      },
      metadata: {
        workflow_name: "estimate_lifecycle",
        event_category: "sales",
        event_severity: "attention",
        deep_link: `/estimates/${input.estimateId}`,
      },
    });

    return {
      invoiceId: invoice.id as string,
      amount: depositAmount,
      created: true,
    };
  }

  async function convertEstimateToProject(input: {
    companyId: string;
    estimateId: string;
    actorProfileId: string;
    idempotencyKey: string;
    createDepositInvoice?: boolean;
  }) {
    const { data, error } = await db.rpc("convert_estimate_to_project", {
      p_company_id: input.companyId,
      p_estimate_id: input.estimateId,
      p_actor_profile_id: input.actorProfileId,
      p_idempotency_key: input.idempotencyKey,
      p_create_deposit_invoice: input.createDepositInvoice ?? true,
    });

    if (error) {
      throw new Error(error.message || "Unable to convert estimate to project.");
    }

    const row = Array.isArray(data) ? data[0] : data;

    if (!row?.conversion_id) {
      throw new Error("Conversion returned no result.");
    }

    const orion = createSupabaseOrionEventPublisher(db as unknown as SupabaseClient<Database>);
    await orion.publishEvent({
      company_id: input.companyId,
      actor_profile_id: input.actorProfileId,
      event_type: "estimate.converted",
      aggregate_type: "estimate",
      aggregate_id: input.estimateId,
      source_module: "estimates",
      payload: {
        estimate_id: input.estimateId,
        project_id: (row.project_id as string | null) || null,
        project_number: (row.project_number as string | null) || null,
        deposit_invoice_id: (row.deposit_invoice_id as string | null) || null,
        deep_link: (row.project_id as string | null) ? `/projects/${row.project_id as string}` : `/estimates/${input.estimateId}`,
      },
      metadata: {
        workflow_name: "estimate_lifecycle",
        event_category: "sales",
        event_severity: "success",
        deep_link: `/estimates/${input.estimateId}`,
      },
    });

    return {
      conversionId: row.conversion_id as string,
      projectId: (row.project_id as string | null) || null,
      projectNumber: (row.project_number as string | null) || null,
      depositInvoiceId: (row.deposit_invoice_id as string | null) || null,
      status: (row.conversion_status as string) || "completed",
      idempotent: Boolean(row.idempotent),
    };
  }

  return {
    approveEstimate,
    declineEstimate,
    requestChanges,
    generatePublicToken,
    validatePublicToken,
    generateAgreementSnapshot,
    storeSignature,
    storeAcceptance,
    convertEstimateToProject,
    calculateDeposit,
    createDepositInvoice,
    getConversionResult,
  };
}

export type { EstimateWorkflowService } from "./workflow-types";
