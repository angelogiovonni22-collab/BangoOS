import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { rasterBandKey, selectTargetedDedupeCollisionSegments, summarizeTargetedDedupeCollisionSimulation } from "./source-pair-raster-targeted-dedupe-simulation";

function segment(id: string, y: number, startX: number, endX: number): BosRawSegment {
  return { sourcePage: 1, start: { x: startX, y }, end: { x: endX, y }, sourceObjectId: id, confidence: 0.62 };
}

const baseline = [segment("baseline-target", 1, 0, 10), segment("baseline-other", 2, 0, 8)];
const lostSameBand = segment("lost-target", 1.004, 0, 10);
const unrelatedExtra = segment("unrelated-extra", 3, 0, 10);
const key = rasterBandKey({
  segment: baseline[0],
  sourcePixelWidth: 1000,
  sourcePixelHeight: 1000,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  mergeBandPixels: 3,
});
const selected = selectTargetedDedupeCollisionSegments({
  baselineSegments: baseline,
  keepAllSegments: [...baseline, lostSameBand, unrelatedExtra],
  collisionBandKeys: [key],
  sourcePixelWidth: 1000,
  sourcePixelHeight: 1000,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  mergeBandPixels: 3,
});
assert.deepEqual(selected.addedSegmentIds, ["lost-target"]);
assert.equal(selected.segments.length, 3);
assert.equal(selected.segments.some((entry) => entry.sourceObjectId === "unrelated-extra"), false);

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

const improving = summarizeTargetedDedupeCollisionSimulation({
  collisionBandKeys: [key],
  addedSegmentIds: ["lost-target"],
  baselineRasterSegmentCount: 2,
  simulatedRasterSegmentCount: 3,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(1),
  afterStageDiagnostic: stage(0),
});
assert.equal(improving.safeToConsiderPromotion, true);
assert.deepEqual(improving.newlyUniqueFamilyIds, ["recover"]);
assert.deepEqual(improving.previouslyUniqueRegressionFamilyIds, []);

const regressive = summarizeTargetedDedupeCollisionSimulation({
  collisionBandKeys: [key],
  addedSegmentIds: ["lost-target"],
  baselineRasterSegmentCount: 2,
  simulatedRasterSegmentCount: 3,
  beforeAgreement: agreement([["stable", "unique_family_member_agreement"], ["recover", "no_family_member_agreement"]]),
  afterAgreement: agreement([["stable", "ambiguous_family_member_agreement"], ["recover", "unique_family_member_agreement"]]),
  beforeStageDiagnostic: stage(1),
  afterStageDiagnostic: stage(0),
});
assert.equal(regressive.safeToConsiderPromotion, false);
assert.deepEqual(regressive.previouslyUniqueRegressionFamilyIds, ["stable"]);

console.log("Blueprint targeted raster de-duplication collision simulation contract passed.");
