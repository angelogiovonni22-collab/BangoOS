import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEstimateCompliance } from "./estimate-contract-compliance-service";
import { loadHomeSolicitationCompliance } from "./home-solicitation-service";
import { calculateOhioHomeSolicitationDeadline } from "./ohio-home-solicitation";

// Compliance tables are migration-backed and intentionally localized behind this compatibility type
// until generated Supabase types are regenerated from the deployed schema.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = SupabaseClient<any>;

export const CONTRACT_PACKAGE_VERSION = "2026-08-14.1" as const;

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type ContractCompliancePackage = {
  packageVersion: typeof CONTRACT_PACKAGE_VERSION;
  generatedAt: string;
  signingAt: string | null;
  ohioHomeConstruction: {
    rulesetId: string;
    rulesetVersion: string;
    status: string;
    applicable: boolean | null;
    checks: unknown[];
    facts: {
      propertyState: string | null | undefined;
      propertyClass: string;
      pricingType: string;
      supplierName: string | null | undefined;
      supplierPhysicalAddress: string | null | undefined;
      supplierPhone: string | null | undefined;
      supplierTaxpayerIdRecorded: boolean;
      ownerName: string | null | undefined;
      ownerAddress: string | null | undefined;
      ownerPhone: string | null | undefined;
      projectAddress: string | null | undefined;
      anticipatedStart: string | null | undefined;
      anticipatedCompletion: string | null | undefined;
      excludedCostsDisclosed: boolean;
      liabilityInsuranceDocumented: boolean;
      liabilityCoverageAmount: number | null | undefined;
      insuranceDocumentReference: string | null | undefined;
      excessCostMethod: string | null | undefined;
    };
  };
  ohioHomeSolicitation: {
    rulesetId: string;
    rulesetVersion: string;
    status: string;
    applicable: boolean | null;
    checks: unknown[];
    notice: null | {
      sellerName: string | null | undefined;
      sellerAddress: string | null | undefined;
      cancellationEmail: string | null | undefined;
      cancellationFax: string | null | undefined;
      sellerSignerName: string | null | undefined;
      sellerSignedAt: string | null | undefined;
      oralDisclosureConfirmedAt: string | null | undefined;
      transactionDate: string;
      cancellationDeadlineDate: string;
      requiredNoticeCopies: 2;
      workStartHoldRequired: true;
    };
  };
  packageHash: string;
};

export async function buildContractCompliancePackage(
  db: AnySupabase,
  companyId: string,
  estimateId: string,
  options: { generatedAt?: string; signingAt?: string | null } = {},
): Promise<ContractCompliancePackage> {
  const generatedAt = options.generatedAt || new Date().toISOString();
  const signingAt = options.signingAt || null;
  const [contract, solicitation] = await Promise.all([
    loadEstimateCompliance(db, companyId, estimateId),
    loadHomeSolicitationCompliance(db, companyId, estimateId),
  ]);

  const homeSolicitationNotice = solicitation.evaluation.applicable === true
    ? (() => {
        const transactionDate = (signingAt || solicitation.profile.transactionSignedAt || generatedAt).slice(0, 10);
        return {
          sellerName: solicitation.profile.sellerName,
          sellerAddress: solicitation.profile.sellerAddress,
          cancellationEmail: solicitation.profile.cancellationEmail,
          cancellationFax: solicitation.profile.cancellationFax,
          sellerSignerName: solicitation.profile.sellerSignerName,
          sellerSignedAt: solicitation.profile.sellerSignedAt,
          oralDisclosureConfirmedAt: solicitation.profile.oralDisclosureConfirmedAt,
          transactionDate,
          cancellationDeadlineDate: solicitation.profile.cancellationDeadlineDate || calculateOhioHomeSolicitationDeadline(transactionDate),
          requiredNoticeCopies: 2 as const,
          workStartHoldRequired: true as const,
        };
      })()
    : null;

  const payload = {
    packageVersion: CONTRACT_PACKAGE_VERSION,
    generatedAt,
    signingAt,
    ohioHomeConstruction: {
      rulesetId: contract.evaluation.rulesetId,
      rulesetVersion: contract.evaluation.rulesetVersion,
      status: contract.evaluation.status,
      applicable: contract.evaluation.applicable,
      checks: contract.evaluation.checks,
      facts: {
        propertyState: contract.profile.propertyState,
        propertyClass: contract.profile.propertyClass,
        pricingType: contract.profile.pricingType,
        supplierName: contract.profile.supplierName,
        supplierPhysicalAddress: contract.profile.supplierPhysicalAddress,
        supplierPhone: contract.profile.supplierPhone,
        supplierTaxpayerIdRecorded: contract.profile.supplierTaxpayerIdPresent === true,
        ownerName: contract.profile.ownerName,
        ownerAddress: contract.profile.ownerAddress,
        ownerPhone: contract.profile.ownerPhone,
        projectAddress: contract.profile.projectAddress,
        anticipatedStart: contract.profile.anticipatedStart,
        anticipatedCompletion: contract.profile.anticipatedCompletion,
        excludedCostsDisclosed: contract.profile.excludedInstallationOrDeliveryCostsDisclosed === true,
        liabilityInsuranceDocumented: contract.profile.liabilityInsuranceDocumented === true,
        liabilityCoverageAmount: contract.profile.liabilityCoverageAmount,
        insuranceDocumentReference: contract.profile.insuranceDocumentReference,
        excessCostMethod: contract.profile.excessCostMethod,
      },
    },
    ohioHomeSolicitation: {
      rulesetId: solicitation.evaluation.rulesetId,
      rulesetVersion: solicitation.evaluation.rulesetVersion,
      status: solicitation.evaluation.status,
      applicable: solicitation.evaluation.applicable,
      checks: solicitation.evaluation.checks,
      notice: homeSolicitationNotice,
    },
  };

  return {
    ...payload,
    packageHash: sha256(JSON.stringify(payload)),
  };
}

export async function finalizeAgreementContractPackage(
  db: AnySupabase,
  input: {
    companyId: string;
    estimateId: string;
    agreementVersionId: string;
    baseSnapshot: Record<string, unknown>;
    baseAgreementHash: string;
    signingAt: string;
  },
) {
  const compliancePackage = await buildContractCompliancePackage(db, input.companyId, input.estimateId, {
    signingAt: input.signingAt,
  });
  const snapshot = {
    ...input.baseSnapshot,
    compliancePackage,
  };
  const agreementHash = sha256(JSON.stringify(snapshot));

  const { data, error } = await db
    .from("estimate_agreement_versions")
    .update({ agreement_snapshot: snapshot, agreement_hash: agreementHash })
    .eq("company_id", input.companyId)
    .eq("estimate_id", input.estimateId)
    .eq("id", input.agreementVersionId)
    .eq("agreement_hash", input.baseAgreementHash)
    .select("id")
    .maybeSingle();

  if (error) throw new Error(error.message || "Unable to finalize the immutable contract package.");
  if (!data?.id) throw new Error("Agreement package changed before finalization. Regenerate the agreement before signing.");

  return { snapshot, agreementHash, compliancePackage };
}
