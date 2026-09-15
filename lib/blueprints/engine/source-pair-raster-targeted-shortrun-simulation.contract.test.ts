import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterDedupeGapDiagnostic } from "./source-pair-raster-dedupe-gap-diagnostic";
import type { BosRasterStageGapDiagnostic } from "./source-pair-raster-stage-gap-diagnostic";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import { selectSourceBackedShortRunSegments, summarizeSourceBackedShortRunSimulation } from "./source-pair-raster-targeted-shortrun-simulation";

function segment(id: string, y: number, start: number, end: number): BosRawSegment {
  return { sourcePage: 1, start: { x: start, y }, end: { x: end, y }, sourceObjectId: id, confidence: 0.62 };
}

const baseline = [segment("baseline", 1, 0, 0.4)];
const sourceBacked = segment("short-source-backed", 1, 0.4, 1);
const unrelated = segment("short-unrelated", 2, 0, 1);
const clusters: BosSourceWallPairConsolidationCluster[] = [{
  representativePairId: "family",
  memberPairIds: ["member"],
  members: [{ id: "member", orientation: "horizontal", faceAFixedPixel: 100, faceBFixedPixel: 112, startPixel: 0, endPixel: 99, centerFixedPixel: 106, lengthMeters: 1, separationMeters: 0.12 }],
}];
const failed = { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 0.4, passed: false };
const passed = { segmentCount: 1, minimumCoordinateErrorMeters: 0, sourceSpanCoverageRatio: 1, passed: true };
const stage: BosRasterStageGapDiagnostic = {
  familyCount: 1,
  memberCount: 1,
  reasonMemberCounts: { extraction_face_coverage_gap: 1, annotation_filter_removed_face_evidence: 0, pair_builder_consistency_gap: 0 },
  reasonFamilyCounts: { extraction_face_coverage_gap: 1, annotation_filter_removed_face_evidence: 0, pair_builder_consistency_gap: 0 },
  members: [{ representativePairId: "family", memberPairId: "member", reason: "extraction_face_coverage_gap", rawFaceA: failed, rawFaceB: passed, filteredFaceA: failed, filteredFaceB: passed }],
  diagnostics: [],
};
const dedupe: BosRasterDedupeGapDiagnostic = {
  familyCount: 1,
  memberCount: 1,
  failedFaceCount: 1,
  reasonMemberCounts: { below_raster_min_run: 1, dedupe_band_collision: 0, unexpected_post_run_gap: 0 },
  reasonFaceCounts: { below_raster_min_run: 1, dedupe_band_collision: 0, unexpected_post_run_gap: 0 },
  reasonFamilyCounts: { below_raster_min_run: 1, dedupe_band_collision: 0, unexpected_post_run_gap: 0 },
  members: [{ representativePairId: "family", memberPairId: "member", reason: "below_raster_min_run", failedFaces: [{ face: "a", sourceRunPixels: 100, rasterRunPixels: 92.6, reason: "below_raster_min_run", expectedBandKey: null, collidingSegmentIds: [] }] }],
  diagnostics: [],
};

const selected = selectSourceBackedShortRunSegments({
  baselineSegments: baseline,
  paritySegments: [...baseline, sourceBacked, unrelated],
  dedupeGapDiagnostic: dedupe,
  consolidationClusters: clusters,
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 1,
  sourceHeightMeters: 1,
});
assert.deepEqual(selected.addedSegmentIds, ["short-source-backed"]);
assert.equal(selected.recoverableFaceCount, 1);
assert.equal(selected.segments.some((entry) => entry.sourceObjectId === "short-unrelated"), false);

function agreement(reason: "unique_family_member_agreement" | "ambiguous_family_member_agreement" | "no_family_member_agreement"): BosSourcePairFamilyAgreementDiagnostic {
  return {
    retainedPairCount: 1,
    uniqueAgreementCount: reason === "unique_family_member_agreement" ? 1 : 0,
    ambiguousAgreementCount: reason === "ambiguous_family_member_agreement" ? 1 : 0,
    noAgreementCount: reason === "no_family_member_agreement" ? 1 : 0,
    missingFamilyCount: 0,
    agreements: [{ representativePairId: "family", memberCount: 1, passingMemberCount: reason === "no_family_member_agreement" ? 0 : 1, equivalentPassingGeometryCount: reason === "ambiguous_family_member_agreement" ? 2 : reason === "unique_family_member_agreement" ? 1 : 0, recommendedMemberPairId: reason === "unique_family_member_agreement" ? "member" : null, reason, members: [] }],
    diagnostics: [],
  };
}

const summary = summarizeSourceBackedShortRunSimulation({
  baselineMinRunPixels: 34,
  sourceEquivalentMinRunPixels: 23,
  baselineRasterSegmentCount: 1,
  parityRasterSegmentCount: 2,
  simulatedRasterSegmentCount: 2,
  targetFamilyIds: ["family"],
  targetFaceCount: 1,
  recoverableFaceCount: 1,
  addedSegmentIds: ["short-source-backed"],
  beforeAgreement: agreement("no_family_member_agreement"),
  afterAgreement: agreement("unique_family_member_agreement"),
  beforeStageDiagnostic: stage,
  afterStageDiagnostic: { ...stage, familyCount: 0, memberCount: 0, reasonMemberCounts: { extraction_face_coverage_gap: 0, annotation_filter_removed_face_evidence: 0, pair_builder_consistency_gap: 0 }, members: [] },
});
assert.equal(summary.safeToConsiderPromotion, true);
assert.deepEqual(summary.newlyUniqueFamilyIds, ["family"]);
console.log("Blueprint source-backed raster short-run simulation contract passed.");
