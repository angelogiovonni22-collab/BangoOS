import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import { diagnoseRasterDedupeGaps } from "./source-pair-raster-dedupe-gap-diagnostic";

const passed = { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 1, passed: true };
const failed = { segmentCount: 0, minimumCoordinateErrorMeters: null, sourceSpanCoverageRatio: 0, passed: false };

const stageDiagnostic: BosRasterStageGapDiagnostic = {
  familyCount: 3,
  memberCount: 3,
  reasonMemberCounts: {
    extraction_face_coverage_gap: 3,
    annotation_filter_removed_face_evidence: 0,
    pair_builder_consistency_gap: 0,
  },
  reasonFamilyCounts: {
    extraction_face_coverage_gap: 3,
    annotation_filter_removed_face_evidence: 0,
    pair_builder_consistency_gap: 0,
  },
  members: [
    { representativePairId: "collision", memberPairId: "collision-member", reason: "extraction_face_coverage_gap", rawFaceA: failed, rawFaceB: passed, filteredFaceA: failed, filteredFaceB: passed },
    { representativePairId: "short", memberPairId: "short-member", reason: "extraction_face_coverage_gap", rawFaceA: failed, rawFaceB: passed, filteredFaceA: failed, filteredFaceB: passed },
    { representativePairId: "unexpected", memberPairId: "unexpected-member", reason: "extraction_face_coverage_gap", rawFaceA: failed, rawFaceB: passed, filteredFaceA: failed, filteredFaceB: passed },
  ],
  diagnostics: [],
};

const consolidationClusters: BosSourceWallPairConsolidationCluster[] = [
  {
    representativePairId: "collision",
    memberPairIds: ["collision-member"],
    members: [{ id: "collision-member", orientation: "horizontal", faceAFixedPixel: 100, faceBFixedPixel: 112, startPixel: 101, endPixel: 136, centerFixedPixel: 106, lengthMeters: 0.36, separationMeters: 0.12 }],
  },
  {
    representativePairId: "short",
    memberPairIds: ["short-member"],
    members: [{ id: "short-member", orientation: "horizontal", faceAFixedPixel: 150, faceBFixedPixel: 162, startPixel: 200, endPixel: 224, centerFixedPixel: 156, lengthMeters: 0.25, separationMeters: 0.12 }],
  },
  {
    representativePairId: "unexpected",
    memberPairIds: ["unexpected-member"],
    members: [{ id: "unexpected-member", orientation: "vertical", faceAFixedPixel: 220, faceBFixedPixel: 232, startPixel: 40, endPixel: 79, centerFixedPixel: 226, lengthMeters: 0.4, separationMeters: 0.12 }],
  },
];

const rawSegments: BosRawSegment[] = [
  {
    sourcePage: 1,
    start: { x: 1.03, y: 1 },
    end: { x: 1.34, y: 1 },
    sourceObjectId: "retained-collision",
    confidence: 0.62,
  },
];

const result = diagnoseRasterDedupeGaps({
  stageDiagnostic,
  consolidationClusters,
  rawSegments,
  sourcePixelWidth: 300,
  sourcePixelHeight: 300,
  sourceWidthMeters: 3,
  sourceHeightMeters: 3,
  rasterMinRunPixels: 34,
  mergeBandPixels: 3,
});

assert.equal(result.memberCount, 3);
assert.equal(result.reasonMemberCounts.dedupe_band_collision, 1);
assert.equal(result.reasonMemberCounts.below_raster_min_run, 1);
assert.equal(result.reasonMemberCounts.unexpected_post_run_gap, 1);
assert.equal(result.reasonFaceCounts.dedupe_band_collision, 1);
assert.equal(result.members.find((member) => member.representativePairId === "collision")?.failedFaces[0].collidingSegmentIds[0], "retained-collision");
console.log("Blueprint raster de-duplication gap diagnostic contract passed.");
