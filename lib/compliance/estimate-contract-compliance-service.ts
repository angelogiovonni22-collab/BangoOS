import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateOhioResidentialContract, type ContractComplianceEvaluation, type OhioResidentialContractInput } from "./contract-compliance";

// The compliance tables are introduced by the same migration as this service and will be folded into
// generated Database types after migration/type regeneration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type EstimateComplianceProfile = Omit<OhioResidentialContractInput,
  "totalAmount" | "scopeDescription" | "totalEstimatedCostPresent"
> & {
  id?: string;
  insuranceDocumentReference?: string | null;
  depositAmount?: number | null;
  specialOrderAmount?: number | null;
  specialOrderNonreturnable?: boolean;
};

function profileFromRow(row: Record<string, unknown> | null): EstimateComplianceProfile {
  return {
    id: (row?.id as string | undefined) || undefined,
    propertyState: (row?.property_state as string | null) || null,
    propertyClass: (row?.property_class as EstimateComplianceProfile["propertyClass"]) || "unknown",
    pricingType: (row?.pricing_type as EstimateComplianceProfile["pricingType"]) || "unknown",
    supplierName: (row?.supplier_legal_name as string | null) || null,
    supplierPhysicalAddress: (row?.supplier_physical_address as string | null) || null,
    supplierPhone: (row?.supplier_phone as string | null) || null,
    supplierTaxpayerIdPresent: Boolean(row?.supplier_taxpayer_id_present),
    ownerName: (row?.owner_name as string | null) || null,
    ownerAddress: (row?.owner_address as string | null) || null,
    ownerPhone: (row?.owner_phone as string | null) || null,
    projectAddress: (row?.project_address as string | null) || null,
    anticipatedStart: (row?.anticipated_start as string | null) || null,
    anticipatedCompletion: (row?.anticipated_completion as string | null) || null,
    excludedInstallationOrDeliveryCostsDisclosed: Boolean(row?.excluded_costs_disclosed),
    liabilityInsuranceDocumented: Boolean(row?.liability_insurance_documented),
    liabilityCoverageAmount: row?.liability_coverage_amount == null ? null : Number(row.liability_coverage_amount),
    insuranceDocumentReference: (row?.insurance_document_reference as string | null) || null,
    excessCostMethod: (row?.excess_cost_method as EstimateComplianceProfile["excessCostMethod"]) || null,
    depositAmount: row?.deposit_amount == null ? null : Number(row.deposit_amount),
    specialOrderAmount: row?.special_order_amount == null ? null : Number(row.special_order_amount),
    specialOrderNonreturnable: Boolean(row?.special_order_nonreturnable),
  };
}

export async function loadEstimateCompliance(db: AnySupabase, companyId: string, estimateId: string) {
  const { data: estimate, error: estimateError } = await db
    .from("estimates")
    .select("id, total_amount, description, customer_id")
    .eq("company_id", companyId)
    .eq("id", estimateId)
    .maybeSingle();
  if (estimateError || !estimate) throw new Error(estimateError?.message || "Estimate not found.");

  const { data: row, error: profileError } = await db
    .from("estimate_contract_compliance_profiles")
    .select("*")
    .eq("company_id", companyId)
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (profileError) throw new Error(profileError.message || "Unable to load contract compliance details.");

  const totalAmount = Number(estimate.total_amount || 0);
  const profile = profileFromRow((row as Record<string, unknown> | null) || null);
  const evaluation = evaluateOhioResidentialContract({
    ...profile,
    totalAmount,
    scopeDescription: estimate.description,
    totalEstimatedCostPresent: estimate.total_amount != null,
  });

  return { profile, evaluation, totalAmount };
}

export async function recordEstimateComplianceEvaluation(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  actorProfileId: string,
  evaluation: ContractComplianceEvaluation,
  profileId?: string | null,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await db.from("estimate_contract_compliance_evaluations").insert({
    company_id: companyId,
    estimate_id: estimateId,
    profile_id: profileId || null,
    ruleset_id: evaluation.rulesetId,
    ruleset_version: evaluation.rulesetVersion,
    jurisdiction: evaluation.jurisdiction,
    status: evaluation.status,
    applicable: evaluation.applicable,
    evaluation: { ...evaluation, metadata },
    evaluated_by: actorProfileId,
  });
  if (error) throw new Error(error.message || "Unable to preserve contract compliance evaluation.");
}

export async function saveEstimateCompliance(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  actorProfileId: string,
  profile: EstimateComplianceProfile,
) {
  const payload = {
    company_id: companyId,
    estimate_id: estimateId,
    property_state: profile.propertyState || null,
    property_class: profile.propertyClass,
    pricing_type: profile.pricingType,
    supplier_legal_name: profile.supplierName || null,
    supplier_physical_address: profile.supplierPhysicalAddress || null,
    supplier_phone: profile.supplierPhone || null,
    supplier_taxpayer_id_present: profile.supplierTaxpayerIdPresent === true,
    owner_name: profile.ownerName || null,
    owner_address: profile.ownerAddress || null,
    owner_phone: profile.ownerPhone || null,
    project_address: profile.projectAddress || null,
    anticipated_start: profile.anticipatedStart || null,
    anticipated_completion: profile.anticipatedCompletion || null,
    excluded_costs_disclosed: profile.excludedInstallationOrDeliveryCostsDisclosed === true,
    liability_insurance_documented: profile.liabilityInsuranceDocumented === true,
    liability_coverage_amount: profile.liabilityCoverageAmount ?? null,
    insurance_document_reference: profile.insuranceDocumentReference || null,
    excess_cost_method: profile.excessCostMethod || null,
    deposit_amount: profile.depositAmount ?? null,
    special_order_amount: profile.specialOrderAmount ?? null,
    special_order_nonreturnable: profile.specialOrderNonreturnable === true,
    updated_by: actorProfileId,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await db
    .from("estimate_contract_compliance_profiles")
    .upsert(payload, { onConflict: "company_id,estimate_id" })
    .select("id")
    .single();
  if (error) throw new Error(error.message || "Unable to save contract compliance details.");

  const result = await loadEstimateCompliance(db, companyId, estimateId);
  await recordEstimateComplianceEvaluation(
    db,
    companyId,
    estimateId,
    actorProfileId,
    result.evaluation,
    (saved?.id as string | undefined) || result.profile.id || null,
    { source: "manual_check" },
  );

  return result;
}
