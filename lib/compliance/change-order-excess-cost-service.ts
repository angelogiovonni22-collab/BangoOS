import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEstimateCompliance } from "./estimate-contract-compliance-service";
import {
  evaluateOhioExcessCostCompliance,
  type OhioExcessCostComplianceResult,
  type OhioExcessCostEvidence,
  type OhioOwnerApprovalEvidence,
} from "./ohio-excess-cost-compliance";

// Phase 5 tables/RPCs are migration-backed and will be folded into generated types after schema regeneration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export class ChangeOrderExcessCostComplianceError extends Error {
  readonly code = "CHANGE_ORDER_EXCESS_COST_COMPLIANCE_BLOCKED";
  readonly evaluation: OhioExcessCostComplianceResult;

  constructor(evaluation: OhioExcessCostComplianceResult) {
    super(evaluation.reasons[0] || "Change-order excess-cost compliance requires attention.");
    this.name = "ChangeOrderExcessCostComplianceError";
    this.evaluation = evaluation;
  }
}

type EvidenceInput = {
  companyId: string;
  changeOrderId: string;
  actorProfileId: string | null;
  qualifiesAsReasonablyUnforeseenNecessary: boolean | null;
  estimateEvidence?: OhioExcessCostEvidence | null;
  ownerApprovalEvidence?: OhioOwnerApprovalEvidence | null;
  source?: string;
};

async function loadPriorQualifyingExcessAmount(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  currentChangeOrderId: string,
) {
  const [{ data: changeOrders, error: changeOrdersError }, { data: evidenceRows, error: evidenceError }] = await Promise.all([
    db.from("change_orders")
      .select("id,total_amount,status")
      .eq("company_id", companyId)
      .eq("estimate_id", estimateId)
      .neq("status", "void"),
    db.from("change_order_excess_cost_compliance_evaluations")
      .select("change_order_id,qualifies_as_unforeseen_necessary,created_at")
      .eq("company_id", companyId)
      .eq("estimate_id", estimateId)
      .order("created_at", { ascending: false }),
  ]);

  if (changeOrdersError) throw new Error(changeOrdersError.message || "Unable to load contract change orders.");
  if (evidenceError) throw new Error(evidenceError.message || "Unable to load excess-cost evidence.");

  const latestClassification = new Map<string, boolean | null>();
  for (const row of evidenceRows || []) {
    const id = String(row.change_order_id || "");
    if (id && !latestClassification.has(id)) {
      latestClassification.set(id, row.qualifies_as_unforeseen_necessary ?? null);
    }
  }

  return (changeOrders || []).reduce((sum: number, row: Record<string, unknown>) => {
    const id = String(row.id || "");
    if (!id || id === currentChangeOrderId || latestClassification.get(id) !== true) return sum;
    return sum + Math.max(0, Number(row.total_amount || 0));
  }, 0);
}

export async function recordChangeOrderExcessCostEvidence(
  db: AnySupabase,
  input: EvidenceInput,
) {
  const { data: changeOrder, error: changeOrderError } = await db.from("change_orders")
    .select("id,estimate_id,total_amount,status")
    .eq("company_id", input.companyId)
    .eq("id", input.changeOrderId)
    .maybeSingle();

  if (changeOrderError || !changeOrder) {
    throw new Error(changeOrderError?.message || "Change order not found.");
  }

  const estimateId = String(changeOrder.estimate_id || "");
  if (!estimateId) {
    throw new Error("Change order must be linked to its source contract estimate before statutory excess-cost evidence can be recorded.");
  }

  const [compliance, priorQualifyingExcessAmount] = await Promise.all([
    loadEstimateCompliance(db, input.companyId, estimateId),
    loadPriorQualifyingExcessAmount(db, input.companyId, estimateId, input.changeOrderId),
  ]);

  const currentAmount = Math.max(0, Number(changeOrder.total_amount || 0));
  const evaluation = evaluateOhioExcessCostCompliance({
    applicable: compliance.evaluation.applicable,
    pricingType: compliance.profile.pricingType,
    contractEstimateMethod: compliance.profile.excessCostMethod ?? null,
    qualifiesAsReasonablyUnforeseenNecessary: input.qualifiesAsReasonablyUnforeseenNecessary,
    currentExcessCostCents: Math.round(currentAmount * 100),
    priorQualifyingExcessCostCents: Math.round(priorQualifyingExcessAmount * 100),
    estimateEvidence: input.estimateEvidence ?? null,
    ownerApprovalEvidence: input.ownerApprovalEvidence ?? null,
  });

  const { error: insertError } = await db.from("change_order_excess_cost_compliance_evaluations").insert({
    company_id: input.companyId,
    change_order_id: input.changeOrderId,
    estimate_id: estimateId,
    ruleset_id: evaluation.rulesetId,
    ruleset_version: evaluation.rulesetVersion,
    jurisdiction: evaluation.jurisdiction,
    status: evaluation.status,
    applicable: evaluation.applicable,
    qualifies_as_unforeseen_necessary: input.qualifiesAsReasonablyUnforeseenNecessary,
    cumulative_qualifying_excess_amount: evaluation.cumulativeQualifyingExcessCostCents / 100,
    estimate_method: input.estimateEvidence?.method ?? null,
    estimate_provided_at: input.estimateEvidence?.providedAt ?? null,
    estimate_amount: input.estimateEvidence?.amountCents == null ? null : input.estimateEvidence.amountCents / 100,
    owner_approved: input.ownerApprovalEvidence?.approved === true,
    owner_approved_at: input.ownerApprovalEvidence?.approvedAt ?? null,
    owner_approval_method: input.ownerApprovalEvidence?.method ?? null,
    evidence: {
      evaluation,
      source: input.source || "change_order_compliance",
    },
    evaluated_by: input.actorProfileId,
  });

  if (insertError) {
    throw new Error(insertError.message || "Unable to preserve change-order excess-cost compliance evidence.");
  }

  return evaluation;
}

export async function authorizeChangeOrderWorkStart(db: AnySupabase, input: EvidenceInput) {
  const evaluation = await recordChangeOrderExcessCostEvidence(db, {
    ...input,
    source: input.source || "change_order_work_start",
  });

  if (!evaluation.workMayStart) {
    throw new ChangeOrderExcessCostComplianceError(evaluation);
  }

  return evaluation;
}

export async function authorizeChangeOrderCharge(db: AnySupabase, input: EvidenceInput) {
  const evaluation = await recordChangeOrderExcessCostEvidence(db, {
    ...input,
    source: input.source || "change_order_charge",
  });

  if (!evaluation.chargeMayProceed) {
    throw new ChangeOrderExcessCostComplianceError(evaluation);
  }

  return evaluation;
}
