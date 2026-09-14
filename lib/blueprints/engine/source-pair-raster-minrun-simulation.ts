import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";

export type BosRasterMinRunParitySimulation = {
  mode: "read_only_raster_min_run_parity_simulation";
  baselineMinRunPixels: number;
  simulatedMinRunPixels: number;
  baselineRasterSegmentCount: number;
  simulatedRasterSegmentCount: number;
  before: {
    uniqueAgreementCount: number;
    ambiguousAgreementCount: number;
    noAgreementCount: number;
    missingFamilyCount: number;
  };
  after: {
    uniqueAgreementCount: number;
    ambiguousAgreementCount: number;
    noAgreementCount: number;
    missingFamilyCount: number;
  };
  delta: {
    uniqueAgreementCount: number;
    ambiguousAgreementCount: number;
    noAgreementCount: number;
    missingFamilyCount: number;
  };
  previouslyUniqueRegressionFamilyIds: string[];
  newlyUniqueFamilyIds: string[];
  noMatchStageBefore: BosRasterStageGapDiagnostic["reasonMemberCounts"];
  noMatchStageAfter: BosRasterStageGapDiagnostic["reasonMemberCounts"];
  safeToConsiderPromotion: boolean;
  diagnostics: string[];
};

function counts(report: BosSourcePairFamilyAgreementDiagnostic) {
  return {
    uniqueAgreementCount: report.uniqueAgreementCount,
    ambiguousAgreementCount: report.ambiguousAgreementCount,
    noAgreementCount: report.noAgreementCount,
    missingFamilyCount: report.missingFamilyCount,
  };
}

function reasonByFamily(report: BosSourcePairFamilyAgreementDiagnostic) {
  return new Map(report.agreements.map((agreement) => [agreement.representativePairId, agreement.reason]));
}

/**
 * Summarizes a read-only extraction parity simulation. The simulation may change only the raster
 * detector's minimum contiguous run length; source-family coordinate/thickness/coverage gates remain
 * unchanged. Promotion is not authorized here: this only rejects simulations that regress an already
 * unique source family or fail to improve source-family agreement.
 */
export function summarizeRasterMinRunParitySimulation(input: {
  baselineMinRunPixels: number;
  simulatedMinRunPixels: number;
  baselineRasterSegmentCount: number;
  simulatedRasterSegmentCount: number;
  beforeAgreement: BosSourcePairFamilyAgreementDiagnostic;
  afterAgreement: BosSourcePairFamilyAgreementDiagnostic;
  beforeStageDiagnostic: BosRasterStageGapDiagnostic;
  afterStageDiagnostic: BosRasterStageGapDiagnostic;
}): BosRasterMinRunParitySimulation {
  const before = counts(input.beforeAgreement);
  const after = counts(input.afterAgreement);
  const beforeReasons = reasonByFamily(input.beforeAgreement);
  const afterReasons = reasonByFamily(input.afterAgreement);
  const previouslyUniqueRegressionFamilyIds = [...beforeReasons.entries()]
    .filter(([familyId, reason]) => reason === "unique_family_member_agreement" && afterReasons.get(familyId) !== "unique_family_member_agreement")
    .map(([familyId]) => familyId)
    .sort();
  const newlyUniqueFamilyIds = [...afterReasons.entries()]
    .filter(([familyId, reason]) => reason === "unique_family_member_agreement" && beforeReasons.get(familyId) !== "unique_family_member_agreement")
    .map(([familyId]) => familyId)
    .sort();
  const delta = {
    uniqueAgreementCount: after.uniqueAgreementCount - before.uniqueAgreementCount,
    ambiguousAgreementCount: after.ambiguousAgreementCount - before.ambiguousAgreementCount,
    noAgreementCount: after.noAgreementCount - before.noAgreementCount,
    missingFamilyCount: after.missingFamilyCount - before.missingFamilyCount,
  };
  const safeToConsiderPromotion = previouslyUniqueRegressionFamilyIds.length === 0
    && delta.uniqueAgreementCount > 0
    && delta.noAgreementCount < 0
    && delta.ambiguousAgreementCount <= 0
    && delta.missingFamilyCount <= 0;
  return {
    mode: "read_only_raster_min_run_parity_simulation",
    baselineMinRunPixels: input.baselineMinRunPixels,
    simulatedMinRunPixels: input.simulatedMinRunPixels,
    baselineRasterSegmentCount: input.baselineRasterSegmentCount,
    simulatedRasterSegmentCount: input.simulatedRasterSegmentCount,
    before,
    after,
    delta,
    previouslyUniqueRegressionFamilyIds,
    newlyUniqueFamilyIds,
    noMatchStageBefore: input.beforeStageDiagnostic.reasonMemberCounts,
    noMatchStageAfter: input.afterStageDiagnostic.reasonMemberCounts,
    safeToConsiderPromotion,
    diagnostics: [
      `Raster minimum-run simulation changed only the extraction minimum from ${input.baselineMinRunPixels} to ${input.simulatedMinRunPixels} pixels; all hard source-family coordinate, thickness, and span gates remained unchanged.`,
      `Raster segment count changed from ${input.baselineRasterSegmentCount} to ${input.simulatedRasterSegmentCount}; ${newlyUniqueFamilyIds.length} family/families became uniquely supported and ${previouslyUniqueRegressionFamilyIds.length} previously unique family/families regressed.`,
      `No-matching extraction-face gaps changed from ${input.beforeStageDiagnostic.reasonMemberCounts.extraction_face_coverage_gap} to ${input.afterStageDiagnostic.reasonMemberCounts.extraction_face_coverage_gap} member(s).`,
      safeToConsiderPromotion
        ? "The parity simulation is non-regressive at the source-family layer; independent source-overlay, topology, dimension, and full fidelity gates are still required before production extraction behavior may change."
        : "The parity simulation is not sufficient for promotion and production extraction must remain unchanged.",
      "Read-only simulation: no production extraction setting, wall, topology, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
