import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEstimateCompliance } from "./estimate-contract-compliance-service";
import { evaluateOhioDepositCompliance, type OhioDepositComplianceEvaluation } from "./ohio-deposit-compliance";

// The Phase 4 evidence table is migration-backed and will be folded into generated types after schema regeneration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export class DepositPaymentComplianceError extends Error {
  readonly code = "DEPOSIT_PAYMENT_COMPLIANCE_BLOCKED";
  readonly evaluation: OhioDepositComplianceEvaluation;

  constructor(evaluation: OhioDepositComplianceEvaluation) {
    super(evaluation.reason || "Deposit payment compliance requires attention.");
    this.name = "DepositPaymentComplianceError";
    this.evaluation = evaluation;
  }
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function recordDepositPaymentEvaluation(
  db: AnySupabase,
  input: {
    companyId: string;
    invoiceId: string;
    estimateId: string;
    actorProfileId: string | null;
    evaluation: OhioDepositComplianceEvaluation;
    source: string;
  },
) {
  const { error } = await db.from("invoice_payment_compliance_evaluations").insert({
    company_id: input.companyId,
    invoice_id: input.invoiceId,
    estimate_id: input.estimateId,
    ruleset_id: input.evaluation.rulesetId,
    ruleset_version: input.evaluation.rulesetVersion,
    jurisdiction: input.evaluation.jurisdiction,
    status: input.evaluation.status,
    applicable: input.evaluation.applicable,
    requested_amount: input.evaluation.requestedDepositAmount,
    prospective_preperformance_payments: input.evaluation.prospectivePrePerformancePayments,
    maximum_preperformance_payment: input.evaluation.conservativeMaximumPrePerformancePayment,
    evaluation: { ...input.evaluation, source: input.source },
    evaluated_by: input.actorProfileId,
  });
  if (error) throw new Error(error.message || "Unable to preserve deposit payment compliance evidence.");
}

export async function authorizeInvoicePaymentCollection(
  db: AnySupabase,
  input: {
    companyId: string;
    invoiceId: string;
    actorProfileId: string | null;
    requestedAmount: number;
    source?: string;
  },
) {
  const [{ data: invoice, error: invoiceError }, { data: links, error: linkError }] = await Promise.all([
    db.from("invoices")
      .select("id,estimate_id,total_amount,amount_paid,status")
      .eq("company_id", input.companyId)
      .eq("id", input.invoiceId)
      .maybeSingle(),
    db.from("invoice_estimate_links")
      .select("estimate_id,link_type,metadata")
      .eq("company_id", input.companyId)
      .eq("invoice_id", input.invoiceId),
  ]);
  if (invoiceError || !invoice) throw new Error(invoiceError?.message || "Invoice not found.");
  if (linkError) throw new Error(linkError.message || "Unable to classify the invoice payment.");

  const depositLink = (links || []).find((link: Record<string, unknown>) => {
    const metadata = metadataObject(link.metadata);
    return metadata.kind === "deposit";
  }) as Record<string, unknown> | undefined;

  // Phase 4 governs explicit workflow deposit invoices. Progress/final invoices are not silently treated as down payments.
  if (!depositLink) {
    return { deposit: false, evaluation: null as OhioDepositComplianceEvaluation | null };
  }

  const estimateId = String(depositLink.estimate_id || invoice.estimate_id || "");
  if (!estimateId) throw new Error("Deposit invoice is missing its source estimate.");

  const compliance = await loadEstimateCompliance(db, input.companyId, estimateId);
  const linkMetadata = metadataObject(depositLink.metadata);
  const evaluation = evaluateOhioDepositCompliance({
    contractAmount: compliance.totalAmount,
    requestedDepositAmount: input.requestedAmount,
    priorPrePerformancePayments: Number(invoice.amount_paid || 0),
    homeConstructionApplicable: compliance.evaluation.applicable,
    pricingType: compliance.profile.pricingType,
    specialOrderAmount: compliance.profile.specialOrderAmount,
    specialOrderNonreturnable: compliance.profile.specialOrderNonreturnable,
    constructionLoanPayment: linkMetadata.payment_source === "construction_loan",
    // A workflow-created deposit invoice is explicitly a pre-performance payment request.
    prePerformance: true,
  });

  await recordDepositPaymentEvaluation(db, {
    companyId: input.companyId,
    invoiceId: input.invoiceId,
    estimateId,
    actorProfileId: input.actorProfileId,
    evaluation,
    source: input.source || "invoice_payment_collection",
  });

  if (evaluation.status === "ACTION_REQUIRED" || evaluation.status === "REVIEW_REQUIRED") {
    throw new DepositPaymentComplianceError(evaluation);
  }

  return { deposit: true, evaluation };
}
