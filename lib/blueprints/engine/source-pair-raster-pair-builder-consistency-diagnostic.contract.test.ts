import assert from "node:assert/strict";
import { diagnosePairBuilderConsistencyGaps } from "./source-pair-raster-pair-builder-consistency-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

const stage: BosRasterStageGapDiagnostic = {
  familyCount: 1,
  memberCount: 1,
  reasonMemberCounts: {
    extraction_face_coverage_gap: 0,
    annotation_filter_removed_face_evidence: 0,
    pair_builder_consistency_gap: 1,
  },
  reasonFamilyCounts: {
    extraction_face_coverage_gap: 0,
    annotation_filter_removed_face_evidence: 0,
    pair_builder_consistency_gap: 1,
  },
  members: [{
    representativePairId: "family-a",
    memberPairId: "member-a",
    reason: "pair_builder_consistency_gap",
    rawFaceA: { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 1, passed: true },
    rawFaceB: { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 1, passed: true },
    filteredFaceA: { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 1, passed: true },
    filteredFaceB: { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 1, passed: true },
  }],
  diagnostics: [],
};

const clusters: BosSourceWallPairConsolidationCluster[] = [{
  representativePairId: "family-a",
  memberPairIds: ["member-a"],
  members: [{
    id: "member-a",
    orientation: "horizontal",
    faceAFixedPixel: 100,
    faceBFixedPixel: 115,
    startPixel: 100,
    endPixel: 500,
    centerFixedPixel: 107.5,
    lengthMeters: 4,
    separationMeters: 0.15,
  }],
}];

const segments = [
  { sourcePage: 1, sourceObjectId: "face-a", start: { x: 1, y: 1 }, end: { x: 5, y: 1 }, confidence: 1 },
  { sourcePage: 1, sourceObjectId: "face-b", start: { x: 1, y: 1.15 }, end: { x: 5, y: 1.15 }, confidence: 1 },
];

const claimingSystem: BosWallSystemCandidate = {
  id: "other-system",
  sourcePage: 1,
  centerline: { start: { x: 1, y: 1.075 }, end: { x: 5, y: 1.075 } },
  thickness: 0.15,
  length: 4,
  orientationRadians: 0,
  faceA: { id: "claim-a", primitiveId: "face-a", sourcePage: 1, line: segments[0], confidence: 1 },
  faceB: { id: "claim-other", primitiveId: "other", sourcePage: 1, line: { start: { x: 1, y: 1.3 }, end: { x: 5, y: 1.3 } }, confidence: 1 },
  overlapRatio: 1,
  confidence: 0.9,
};

const conflict = diagnosePairBuilderConsistencyGaps({
  stageDiagnostic: stage,
  consolidationClusters: clusters,
  annotationFilteredSegments: segments,
  explicitWallSystems: [claimingSystem],
  sourcePixelWidth: 1000,
  sourcePixelHeight: 1000,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(conflict.memberCount, 1);
assert.equal(conflict.members[0]?.eligiblePairCount, 1);
assert.equal(conflict.members[0]?.reason, "greedy_face_claim_conflict");
assert.deepEqual(conflict.members[0]?.claimedCandidateIds, ["face-a"]);
assert.equal(conflict.safeToConsiderPromotion, false);

const omission = diagnosePairBuilderConsistencyGaps({
  stageDiagnostic: stage,
  consolidationClusters: clusters,
  annotationFilteredSegments: segments,
  explicitWallSystems: [],
  sourcePixelWidth: 1000,
  sourcePixelHeight: 1000,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(omission.members[0]?.reason, "unexpected_builder_omission");


const alternateSegments = [
  ...segments,
  { sourcePage: 1, sourceObjectId: "face-a-alt", start: { x: 1, y: 1 }, end: { x: 5, y: 1 }, confidence: 1 },
];
const unclaimedAlternative = diagnosePairBuilderConsistencyGaps({
  stageDiagnostic: stage,
  consolidationClusters: clusters,
  annotationFilteredSegments: alternateSegments,
  explicitWallSystems: [claimingSystem],
  sourcePixelWidth: 1000,
  sourcePixelHeight: 1000,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(unclaimedAlternative.members[0]?.reason, "unexpected_builder_omission");

const shortOverlapSegments = [
  { sourcePage: 1, sourceObjectId: "short-a", start: { x: 1, y: 1 }, end: { x: 1.6, y: 1 }, confidence: 1 },
  { sourcePage: 1, sourceObjectId: "short-b", start: { x: 1.3, y: 1.15 }, end: { x: 1.9, y: 1.15 }, confidence: 1 },
];
const shortOverlap = diagnosePairBuilderConsistencyGaps({
  stageDiagnostic: stage,
  consolidationClusters: clusters,
  annotationFilteredSegments: shortOverlapSegments,
  explicitWallSystems: [],
  sourcePixelWidth: 1000,
  sourcePixelHeight: 1000,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(shortOverlap.members[0]?.reason, "centerline_length_gate");

console.log("Blueprint raster pair-builder consistency diagnostic contract passed.");
