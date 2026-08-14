import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateOhioHomeSolicitationDeadline, evaluateOhioHomeSolicitation, type HomeSolicitationEvaluation, type HomeSolicitationInput } from "./ohio-home-solicitation";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;
const ORAL_DISCLOSURE_WINDOW_MS = 30 * 60 * 1000;

export type HomeSolicitationProfile = Omit<HomeSolicitationInput, "purchasePrice"> & {
  id?: string;
  sellerSignerName?: string | null;
  sellerSignedAt?: string | null;
  sellerSignedBy?: string | null;
  oralDisclosureConfirmedAt?: string | null;
  oralDisclosureConfirmedBy?: string | null;
  transactionSignedAt?: string | null;
  cancellationDeadlineDate?: string | null;
  cancelledAt?: string | null;
  workReleasedAt?: string | null;
};

function freshOralDisclosure(value: string | null) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && Date.now() - timestamp >= 0 && Date.now() - timestamp <= ORAL_DISCLOSURE_WINDOW_MS;
}

function rowToProfile(row: Record<string, unknown> | null): HomeSolicitationProfile {
  const sellerSignedAt = (row?.seller_signed_at as string | null) || null;
  const oralDisclosureConfirmedAt = (row?.oral_disclosure_confirmed_at as string | null) || null;
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
    signedSellerCopyConfigured: Boolean(sellerSignedAt),
    sellerSignerName: (row?.seller_signer_name as string | null) || null,
    sellerSignedAt,
    sellerSignedBy: (row?.seller_signed_by as string | null) || null,
    assistedLiveSigning: Boolean(row?.assisted_live_signing),
    oralDisclosureWorkflowConfirmed: freshOralDisclosure(oralDisclosureConfirmedAt),
    oralDisclosureConfirmedAt,
    oralDisclosureConfirmedBy: (row?.oral_disclosure_confirmed_by as string | null) || null,
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

export async function recordHomeSolicitationEvaluation(db: AnySupabase, companyId: string, estimateId: string, actorProfileId: string | null, evaluation: HomeSolicitationEvaluation, metadata: Record<string, unknown> = {}) {
  const { error } = await db.from("estimate_contract_compliance_evaluations").insert({ company_id: companyId, estimate_id: estimateId, ruleset_id: evaluation.rulesetId, ruleset_version: evaluation.rulesetVersion, jurisdiction: evaluation.jurisdiction, status: evaluation.status, applicable: evaluation.applicable, evaluation: { ...evaluation, metadata }, evaluated_by: actorProfileId });
  if (error) throw new Error(error.message || "Unable to preserve home-solicitation evaluation.");
}

export async function saveHomeSolicitationCompliance(db: AnySupabase, companyId: string, estimateId: string, actorProfileId: string, profile: HomeSolicitationProfile) {
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
    assisted_live_signing: profile.assistedLiveSigning === true,
    work_start_hold_configured: profile.workStartHoldConfigured === true,
    updated_by: actorProfileId,
    updated_at: new Date().toISOString(),
  }, { onConflict: "company_id,estimate_id" });
  if (error) throw new Error(error.message || "Unable to save home-solicitation compliance details.");
  const result = await loadHomeSolicitationCompliance(db, companyId, estimateId);
  await recordHomeSolicitationEvaluation(db, companyId, estimateId, actorProfileId, result.evaluation, { source: "manual_check" });
  return result;
}

export async function recordHomeSolicitationSellerSignature(db: AnySupabase, companyId: string, estimateId: string, actorProfileId: string, signerName: string) {
  const normalizedName = signerName.trim();
  if (!normalizedName) throw new Error("Authorized seller signer name is required.");
  const signedAt = new Date().toISOString();
  const { error } = await db.from("estimate_home_solicitation_profiles").upsert({ company_id: companyId, estimate_id: estimateId, seller_signer_name: normalizedName, seller_signed_at: signedAt, seller_signed_by: actorProfileId, signed_seller_copy_configured: true, updated_by: actorProfileId, updated_at: signedAt }, { onConflict: "company_id,estimate_id" });
  if (error) throw new Error(error.message || "Unable to record seller signature.");
  return loadHomeSolicitationCompliance(db, companyId, estimateId);
}

export async function recordHomeSolicitationOralDisclosure(db: AnySupabase, companyId: string, estimateId: string, actorProfileId: string) {
  const confirmedAt = new Date().toISOString();
  const { error } = await db.from("estimate_home_solicitation_profiles").upsert({ company_id: companyId, estimate_id: estimateId, assisted_live_signing: true, oral_disclosure_workflow_confirmed: true, oral_disclosure_confirmed_at: confirmedAt, oral_disclosure_confirmed_by: actorProfileId, updated_by: actorProfileId, updated_at: confirmedAt }, { onConflict: "company_id,estimate_id" });
  if (error) throw new Error(error.message || "Unable to record oral cancellation-right disclosure.");
  return loadHomeSolicitationCompliance(db, companyId, estimateId);
}

export async function recordHomeSolicitationSignature(db: AnySupabase, companyId: string, estimateId: string, signedAt: string) {
  const result = await loadHomeSolicitationCompliance(db, companyId, estimateId);
  if (result.evaluation.applicable !== true) return { ...result, cancellationDeadlineDate: null };
  if (result.evaluation.status !== "COMPLIANT") throw new Error("Home-solicitation compliance is not cleared for signature finalization.");
  const cancellationDeadlineDate = calculateOhioHomeSolicitationDeadline(signedAt.slice(0, 10));
  const { error } = await db.from("estimate_home_solicitation_profiles").update({ transaction_signed_at: signedAt, cancellation_deadline_date: cancellationDeadlineDate, updated_at: new Date().toISOString() }).eq("company_id", companyId).eq("estimate_id", estimateId);
  if (error) throw new Error(error.message || "Unable to establish cancellation deadline.");
  return { ...result, cancellationDeadlineDate };
}
