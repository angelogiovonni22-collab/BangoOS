import assert from "node:assert/strict";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { summarizeRasterRunParitySimulation } from "./source-pair-raster-run-parity-simulation";

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

const result = summarizeRasterRunParitySimulation({
  baselineMinRunPixels: 34,
  simulatedMinRunPixels: 24,
  baselineGapPixels: 3,
  simulatedGapPixels: 0,
  baselineRasterSegmentCount: 100,
  simulatedRasterSegmentCount: 110,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(12, 2),
  afterStageDiagnostic: stage(4, 1),
});

assert.equal(result.mode, "read_only_raster_run_parity_simulation");
assert.equal(result.baselineGapPixels, 3);
assert.equal(result.simulatedGapPixels, 0);
assert.equal(result.safeToConsiderPromotion, true);
assert.deepEqual(result.previouslyUniqueRegressionFamilyIds, []);
assert.deepEqual(result.newlyUniqueFamilyIds, ["recover"]);
assert.equal(result.noMatchStageAfter.pair_builder_consistency_gap, 1);
console.log("Blueprint raster run parity simulation summary contract passed.");
