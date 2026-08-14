import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateOhioHomeSolicitationDeadline, evaluateOhioHomeSolicitation, type HomeSolicitationEvaluation, type HomeSolicitationInput } from "./ohio-home-solicitation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export type HomeSolicitationProfile = Omit<HomeSolicitationInput, "purchasePrice"> & {
  id?: string;
  transactionSignedAt?: string | null;
  cancellationDeadlineDate?: string | null;
  cancelledAt?: string | null;
  workReleasedAt?: string | null;
};

function rowToProfile(row: Record<string, unknown> | null): HomeSolicitationProfile {
  return {
    id: (row?.id as string | undefined) || undefined,
    consumerPurpose: (row?.consumer_purpose as HomeSolicitationProfile["consumerPurpose"]) || "unknown",
    solicitationLocation: (row?.solicitation_location as HomeSolicitationProfile["solicitationLocation"]) || "unknown",
    buyerInitiatedContact: row?.buyer_initiated_contact == null ? null : Boolean(row.buyer_initiated_contact),
    sellerHasFixedOhioBusiness: row?.seller_has_fixed_ohio_business == null ? null : Boolean(row.seller_has_fixed_ohio_business),
    entirelyMailOrPhoneBuyerInitiatedNoPriorContact: Boolean(row?.entirely_mail_phone_buyer_initiated_no_prior_contact),
    finalAgreementAfterPriorNegotiationsAtSellerBusiness: Boolean(row?.final_agreement_after_prior_negotiations_at_seller_business),
    emergencyHandwrittenWaiver: Boolean(row?.emergency_handwritten_waiver),
    federalRescissionRightApplies: row?.federal_rescission_right_applies == null ? null : Boolean(row.federal_rescission_right_applies),
    sellerName: (row?.seller_name as string | null) || null,
    sellerAddress: (row?.seller_address as string | null) || null,
    cancellationEmail: (row?.cancellation_email as string | null) || null,
    cancellationFax: (row?.cancellation_fax as string | null) || null,
    noticeTemplateReady: Boolean(row?.notice_template_ready),
    duplicateNoticeConfigured: Boolean(row?.duplicate_notice_configured),
    signedSellerCopyConfigured: Boolean(row?.signed_seller_copy_configured),
    assistedLiveSigning: Boolean(row?.assisted_live_signing),
    oralDisclosureWorkflowConfirmed: Boolean(row?.oral_disclosure_workflow_confirmed),
    workStartHoldConfigured: Boolean(row?.work_start_hold_configured),
    transactionSignedAt: (row?.transaction_signed_at as string | null) || null,
    cancellationDeadlineDate: (row?.cancellation_deadline_date as string | null) || null,
    cancelledAt: (row?.cancelled_at as string | null) || null,
    workReleasedAt: (row?.work_released_at as string | null) || null,
  };
}

export async function loadHomeSolicitationCompliance(db: AnySupabase, companyId: string, estimateId: string) {
  const [{ data: estimate, error: estimateError }, { data: row, error: profileError }] = await Promise.all([
    db.from("estimates").select("id,total_amount").eq("company_id", companyId).eq("id", estimateId).maybeSingle(),
    db.from("estimate_home_solicitation_profiles").select("*").eq("company_id", companyId).eq("estimate_id", estimateId).maybeSingle(),
  ]);
  if (estimateError || !estimate) throw new Error(estimateError?.message || "Estimate not found.");
  if (profileError) throw new Error(profileError.message || "Unable to load home-solicitation compliance details.");

  const purchasePrice = Number(estimate.total_amount || 0);
  const profile = rowToProfile((row as Record<string, unknown> | null) || null);
  const evaluation = evaluateOhioHomeSolicitation({ ...profile, purchasePrice });
  return { profile, evaluation, purchasePrice };
}

export async function recordHomeSolicitationEvaluation(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  actorProfileId: string,
  evaluation: HomeSolicitationEvaluation,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await db.from("estimate_contract_compliance_evaluations").insert({
    company_id: companyId,
    estimate_id: estimateId,
    ruleset_id: evaluation.rulesetId,
    ruleset_version: evaluation.rulesetVersion,
    jurisdiction: evaluation.jurisdiction,
    status: evaluation.status,
    applicable: evaluation.applicable,
    evaluation: { ...evaluation, metadata },
    evaluated_by: actorProfileId,
  });
  if (error) throw new Error(error.message || "Unable to preserve home-solicitation evaluation.");
}

export async function saveHomeSolicitationCompliance(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  actorProfileId: string,
  profile: HomeSolicitationProfile,
) {
  const { error } = await db.from("estimate_home_solicitation_profiles").upsert({
    company_id: companyId,
    estimate_id: estimateId,
    consumer_purpose: profile.consumerPurpose,
    solicitation_location: profile.solicitationLocation,
    buyer_initiated_contact: profile.buyerInitiatedContact,
    seller_has_fixed_ohio_business: profile.sellerHasFixedOhioBusiness,
    entirely_mail_phone_buyer_initiated_no_prior_contact: profile.entirelyMailOrPhoneBuyerInitiatedNoPriorContact,
    final_agreement_after_prior_negotiations_at_seller_business: profile.finalAgreementAfterPriorNegotiationsAtSellerBusiness,
    emergency_handwritten_waiver: profile.emergencyHandwrittenWaiver,
    federal_rescission_right_applies: profile.federalRescissionRightApplies,
    seller_name: profile.sellerName || null,
    seller_address: profile.sellerAddress || null,
    cancellation_email: profile.cancellationEmail || null,
    cancellation_fax: profile.cancellationFax || null,
    notice_template_ready: profile.noticeTemplateReady === true,
    duplicate_notice_configured: profile.duplicateNoticeConfigured === true,
    signed_seller_copy_configured: profile.signedSellerCopyConfigured === true,
    assisted_live_signing: profile.assistedLiveSigning === true,
    oral_disclosure_workflow_confirmed: profile.oralDisclosureWorkflowConfirmed === true,
    work_start_hold_configured: profile.workStartHoldConfigured === true,
    updated_by: actorProfileId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id,estimate_id" });
  if (error) throw new Error(error.message || "Unable to save home-solicitation compliance details.");

  const result = await loadHomeSolicitationCompliance(db, companyId, estimateId);
  await recordHomeSolicitationEvaluation(db, companyId, estimateId, actorProfileId, result.evaluation, { source: "manual_check" });
  return result;
}

export async function recordHomeSolicitationSignature(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  signedAt: string,
) {
  const result = await loadHomeSolicitationCompliance(db, companyId, estimateId);
  if (result.evaluation.applicable !== true) return { ...result, cancellationDeadlineDate: null };
  if (result.evaluation.status !== "COMPLIANT") throw new Error("Home-solicitation compliance is not cleared for signature finalization.");

  const cancellationDeadlineDate = calculateOhioHomeSolicitationDeadline(signedAt.slice(0, 10));
  const { error } = await db.from("estimate_home_solicitation_profiles").update({
    transaction_signed_at: signedAt,
    cancellation_deadline_date: cancellationDeadlineDate,
    updated_at: new Date().toISOString(),
  }).eq("company_id", companyId).eq("estimate_id", estimateId);
  if (error) throw new Error(error.message || "Unable to establish cancellation deadline.");

  return { ...result, cancellationDeadlineDate };
}
