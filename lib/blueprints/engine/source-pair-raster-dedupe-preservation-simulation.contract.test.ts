import assert from "node:assert/strict";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { summarizeRasterDedupePreservationSimulation } from "./source-pair-raster-dedupe-preservation-simulation";

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

function stage(extractionGap: number): BosRasterStageGapDiagnostic {
  return {
    familyCount: extractionGap,
    memberCount: extractionGap,
    reasonMemberCounts: {
      extraction_face_coverage_gap: extractionGap,
      annotation_filter_removed_face_evidence: 0,
      pair_builder_consistency_gap: 0,
    },
    reasonFamilyCounts: {
      extraction_face_coverage_gap: extractionGap,
      annotation_filter_removed_face_evidence: 0,
      pair_builder_consistency_gap: 0,
    },
    members: [],
    diagnostics: [],
  };
}

const recovering = summarizeRasterDedupePreservationSimulation({
  rasterMinRunPixels: 34,
  baselineRasterSegmentCount: 100,
  simulatedRasterSegmentCount: 118,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(12),
  afterStageDiagnostic: stage(5),
});
assert.equal(recovering.mode, "read_only_raster_dedupe_preservation_simulation");
assert.equal(recovering.baselineDedupeMode, "longest_per_band");
assert.equal(recovering.simulatedDedupeMode, "keep_all");
assert.deepEqual(recovering.newlyUniqueFamilyIds, ["recover"]);
assert.deepEqual(recovering.previouslyUniqueRegressionFamilyIds, []);
assert.equal(recovering.safeToConsiderPromotion, true);

const regressive = summarizeRasterDedupePreservationSimulation({
  rasterMinRunPixels: 34,
  baselineRasterSegmentCount: 100,
  simulatedRasterSegmentCount: 130,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "ambiguous_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(12),
  afterStageDiagnostic: stage(3),
});
assert.deepEqual(regressive.previouslyUniqueRegressionFamilyIds, ["stable"]);
assert.equal(regressive.safeToConsiderPromotion, false, "keep-all cannot be considered when it regresses an already unique family");

console.log("Blueprint raster de-duplication preservation simulation contract passed.");
