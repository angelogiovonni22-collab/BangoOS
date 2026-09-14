import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosRasterPairingGapDiagnostic } from "./source-pair-raster-pairing-gap-diagnostic";
import { diagnoseNoMatchingRasterStages } from "./source-pair-raster-stage-gap-diagnostic";

const pxPerMeter = 100;
function pair(id: string, y: number): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((y - 0.1) * pxPerMeter),
    faceBFixedPixel: Math.round((y + 0.1) * pxPerMeter),
    centerFixedPixel: Math.round(y * pxPerMeter),
    startPixel: 100,
    endPixel: 900,
    lengthMeters: 8,
    separationMeters: 0.2,
  };
}
function segment(id: string, y: number, start = 1, end = 9): BosRawSegment {
  return { sourcePage: 1, sourceObjectId: id, start: { x: start, y }, end: { x: end, y }, confidence: 0.62 };
}
function clusters(...pairs: BosSourceWallFacePair[]): BosSourceWallPairConsolidationCluster[] {
  return pairs.map((item) => ({ representativePairId: item.id, memberPairIds: [item.id], members: [item] }));
}
function gapDiagnostic(...pairs: BosSourceWallFacePair[]): BosRasterPairingGapDiagnostic {
  return {
    familyCount: pairs.length,
    memberCount: pairs.length,
    reasonMemberCounts: {
      no_matching_raw_pair: pairs.length,
      greedy_face_claimed_candidate: 0,
      sheet_frame_excluded_candidate: 0,
      unexpected_selected_support: 0,
      unselected_valid_candidate: 0,
    },
    reasonFamilyCounts: {
      no_matching_raw_pair: pairs.length,
      greedy_face_claimed_candidate: 0,
      sheet_frame_excluded_candidate: 0,
      unexpected_selected_support: 0,
      unselected_valid_candidate: 0,
    },
    members: pairs.map((item) => ({
      representativePairId: item.id,
      memberPairId: item.id,
      reason: "no_matching_raw_pair",
      matchingCandidateCount: 0,
      bestCandidateId: null,
      bestCoordinateErrorMeters: null,
      bestThicknessErrorMeters: null,
      bestSourceSpanCoverageRatio: 0,
      bestCandidateFaceIds: [],
      claimedFaceIds: [],
    })),
    diagnostics: [],
  };
}

const extractionGap = pair("source-extraction-gap", 4);
const annotationGap = pair("source-annotation-gap", 8);
const consistencyGap = pair("source-consistency-gap", 12);
const allPairs = [extractionGap, annotationGap, consistencyGap];
const rawSegments = [
  segment("extract-a", 3.9),
  segment("extract-b-short", 4.1, 1, 5),
  segment("annotation-a", 7.9),
  segment("annotation-b", 8.1),
  segment("consistency-a", 11.9),
  segment("consistency-b", 12.1),
];
const filteredSegments = [
  segment("extract-a", 3.9),
  segment("extract-b-short", 4.1, 1, 5),
  segment("annotation-a", 7.9),
  segment("consistency-a", 11.9),
  segment("consistency-b", 12.1),
];

const diagnostic = diagnoseNoMatchingRasterStages({
  consolidationClusters: clusters(...allPairs),
  rasterPairingGapDiagnostic: gapDiagnostic(...allPairs),
  rawSegments,
  annotationFilteredSegments: filteredSegments,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});

assert.equal(diagnostic.memberCount, 3);
assert.equal(diagnostic.familyCount, 3);
assert.equal(diagnostic.reasonMemberCounts.extraction_face_coverage_gap, 1);
assert.equal(diagnostic.reasonMemberCounts.annotation_filter_removed_face_evidence, 1);
assert.equal(diagnostic.reasonMemberCounts.pair_builder_consistency_gap, 1);
assert.equal(diagnostic.reasonFamilyCounts.extraction_face_coverage_gap, 1);
assert.equal(diagnostic.reasonFamilyCounts.annotation_filter_removed_face_evidence, 1);
assert.equal(diagnostic.reasonFamilyCounts.pair_builder_consistency_gap, 1);

const extraction = diagnostic.members.find((member) => member.memberPairId === extractionGap.id);
assert.equal(extraction?.rawFaceA.passed, true);
assert.equal(extraction?.rawFaceB.passed, false);
assert.equal(extraction?.reason, "extraction_face_coverage_gap");

const annotation = diagnostic.members.find((member) => member.memberPairId === annotationGap.id);
assert.equal(annotation?.rawFaceA.passed, true);
assert.equal(annotation?.rawFaceB.passed, true);
assert.equal(annotation?.filteredFaceA.passed, true);
assert.equal(annotation?.filteredFaceB.passed, false);
assert.equal(annotation?.reason, "annotation_filter_removed_face_evidence");

const consistency = diagnostic.members.find((member) => member.memberPairId === consistencyGap.id);
assert.equal(consistency?.filteredFaceA.passed, true);
assert.equal(consistency?.filteredFaceB.passed, true);
assert.equal(consistency?.reason, "pair_builder_consistency_gap");

console.log("Blueprint no-match raster stage diagnostic contract passed.");
