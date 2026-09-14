import assert from "node:assert/strict";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { summarizeRasterMinRunParitySimulation } from "./source-pair-raster-minrun-simulation";

function agreement(reasons: Array<[string, "unique_family_member_agreement" | "ambiguous_family_member_agreement" | "no_family_member_agreement"]>): BosSourcePairFamilyAgreementDiagnostic {
  return {
    retainedPairCount: reasons.length,
    uniqueAgreementCount: reasons.filter(([, reason]) => reason === "unique_family_member_agreement").length,
    ambiguousAgreementCount: reasons.filter(([, reason]) => reason === "ambiguous_family_member_agreement").length,
    noAgreementCount: reasons.filter(([, reason]) => reason === "no_family_member_agreement").length,
    missingFamilyCount: 0,
    agreements: reasons.map(([representativePairId, reason]) => ({
      representativePairId,
      memberCount: 1,
      passingMemberCount: reason === "no_family_member_agreement" ? 0 : 1,
      equivalentPassingGeometryCount: reason === "unique_family_member_agreement" ? 1 : 2,
      recommendedMemberPairId: reason === "unique_family_member_agreement" ? `${representativePairId}-member` : null,
      reason,
      members: [],
    })),
    diagnostics: [],
  };
}

function stage(extractionGap: number, consistencyGap = 0): BosRasterStageGapDiagnostic {
  return {
    familyCount: extractionGap + consistencyGap,
    memberCount: extractionGap + consistencyGap,
    reasonMemberCounts: {
      extraction_face_coverage_gap: extractionGap,
      annotation_filter_removed_face_evidence: 0,
      pair_builder_consistency_gap: consistencyGap,
    },
    reasonFamilyCounts: {
      extraction_face_coverage_gap: extractionGap,
      annotation_filter_removed_face_evidence: 0,
      pair_builder_consistency_gap: consistencyGap,
    },
    members: [],
    diagnostics: [],
  };
}

const improving = summarizeRasterMinRunParitySimulation({
  baselineMinRunPixels: 34,
  simulatedMinRunPixels: 24,
  baselineRasterSegmentCount: 100,
  simulatedRasterSegmentCount: 125,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(12),
  afterStageDiagnostic: stage(4),
});
assert.equal(improving.delta.uniqueAgreementCount, 1);
assert.equal(improving.delta.noAgreementCount, -1);
assert.deepEqual(improving.newlyUniqueFamilyIds, ["recover"]);
assert.deepEqual(improving.previouslyUniqueRegressionFamilyIds, []);
assert.equal(improving.safeToConsiderPromotion, true);
assert.equal(improving.noMatchStageBefore.extraction_face_coverage_gap, 12);
assert.equal(improving.noMatchStageAfter.extraction_face_coverage_gap, 4);

const regressive = summarizeRasterMinRunParitySimulation({
  baselineMinRunPixels: 34,
  simulatedMinRunPixels: 24,
  baselineRasterSegmentCount: 100,
  simulatedRasterSegmentCount: 140,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "ambiguous_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(12),
  afterStageDiagnostic: stage(3),
});
assert.deepEqual(regressive.previouslyUniqueRegressionFamilyIds, ["stable"]);
assert.equal(regressive.safeToConsiderPromotion, false, "a lower min-run cannot be considered when it regresses an already unique source family");

console.log("Blueprint raster min-run parity simulation summary contract passed.");
