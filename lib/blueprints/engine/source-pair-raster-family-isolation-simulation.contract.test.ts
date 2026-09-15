import assert from "node:assert/strict";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import { summarizeSourceBackedFamilyIsolationSimulation } from "./source-pair-raster-family-isolation-simulation";
import { summarizeSourceBackedShortRunSimulation } from "./source-pair-raster-targeted-shortrun-simulation";

const emptyStage: BosRasterStageGapDiagnostic = {
  familyCount: 0,
  memberCount: 0,
  reasonMemberCounts: { extraction_face_coverage_gap: 0, annotation_filter_removed_face_evidence: 0, pair_builder_consistency_gap: 0 },
  reasonFamilyCounts: { extraction_face_coverage_gap: 0, annotation_filter_removed_face_evidence: 0, pair_builder_consistency_gap: 0 },
  members: [],
  diagnostics: [],
};

function agreement(reason: "unique_family_member_agreement" | "ambiguous_family_member_agreement" | "no_family_member_agreement"): BosSourcePairFamilyAgreementDiagnostic {
  return {
    retainedPairCount: 1,
    uniqueAgreementCount: reason === "unique_family_member_agreement" ? 1 : 0,
    ambiguousAgreementCount: reason === "ambiguous_family_member_agreement" ? 1 : 0,
    noAgreementCount: reason === "no_family_member_agreement" ? 1 : 0,
    missingFamilyCount: 0,
    agreements: [{
      representativePairId: "family",
      memberCount: 1,
      passingMemberCount: reason === "no_family_member_agreement" ? 0 : 1,
      equivalentPassingGeometryCount: reason === "ambiguous_family_member_agreement" ? 2 : reason === "unique_family_member_agreement" ? 1 : 0,
      recommendedMemberPairId: reason === "unique_family_member_agreement" ? "member" : null,
      reason,
      members: [],
    }],
    diagnostics: [],
  };
}

function summary(after: "unique_family_member_agreement" | "ambiguous_family_member_agreement") {
  return summarizeSourceBackedShortRunSimulation({
    baselineMinRunPixels: 34,
    sourceEquivalentMinRunPixels: 23,
    baselineRasterSegmentCount: 10,
    parityRasterSegmentCount: 11,
    simulatedRasterSegmentCount: 11,
    targetFamilyIds: ["family"],
    targetFaceCount: 1,
    recoverableFaceCount: 1,
    addedSegmentIds: ["segment"],
    beforeAgreement: agreement("no_family_member_agreement"),
    afterAgreement: agreement(after),
    beforeStageDiagnostic: emptyStage,
    afterStageDiagnostic: emptyStage,
  });
}

const report = summarizeSourceBackedFamilyIsolationSimulation({
  results: [
    { representativePairId: "safe", summary: summary("unique_family_member_agreement") },
    { representativePairId: "ambiguous", summary: summary("ambiguous_family_member_agreement") },
  ],
});
assert.deepEqual(report.safeFamilyIds, ["safe"]);
assert.deepEqual(report.safeAddedSegmentIds, ["segment"]);
assert.deepEqual(report.ambiguityGrowthFamilyIds, ["ambiguous"]);
assert.equal(report.safeFamilyCount, 1);
console.log("Blueprint source-backed short-run family isolation contract passed.");
