import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosSourcePairFamilyAgreementDiagnostic } from "./source-pair-family-agreement-diagnostic";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseSourcePairRasterPairingGaps } from "./source-pair-raster-pairing-gap-diagnostic";

const pxPerMeter = 100;
function sourcePair(id: string, y: number, thickness: number, start = 1, end = 9): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((y - thickness / 2) * pxPerMeter),
    faceBFixedPixel: Math.round((y + thickness / 2) * pxPerMeter),
    centerFixedPixel: Math.round(y * pxPerMeter),
    startPixel: Math.round(start * pxPerMeter),
    endPixel: Math.round(end * pxPerMeter),
    lengthMeters: end - start,
    separationMeters: thickness,
  };
}
function segment(id: string, y: number, start = 1, end = 9): BosRawSegment {
  return { sourcePage: 1, sourceObjectId: id, start: { x: start, y }, end: { x: end, y }, confidence: 0.62 };
}
function wall(id: string, faceAId: string, faceBId: string, yA: number, yB: number): BosWallSystemCandidate {
  const center = (yA + yB) / 2;
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: 1, y: center }, end: { x: 9, y: center } },
    thickness: Math.abs(yB - yA),
    length: 8,
    orientationRadians: 0,
    faceA: { id: faceAId, primitiveId: faceAId, sourcePage: 1, line: { start: { x: 1, y: yA }, end: { x: 9, y: yA } }, confidence: 0.62 },
    faceB: { id: faceBId, primitiveId: faceBId, sourcePage: 1, line: { start: { x: 1, y: yB }, end: { x: 9, y: yB } }, confidence: 0.62 },
    overlapRatio: 1,
    confidence: 0.8,
  };
}

const pair = sourcePair("source", 4, 0.2);
const clusters: BosSourceWallPairConsolidationCluster[] = [{ representativePairId: pair.id, memberPairIds: [pair.id], members: [pair] }];
const familyAgreement: BosSourcePairFamilyAgreementDiagnostic = {
  retainedPairCount: 1,
  uniqueAgreementCount: 0,
  ambiguousAgreementCount: 0,
  noAgreementCount: 1,
  missingFamilyCount: 0,
  agreements: [{
    representativePairId: pair.id,
    memberCount: 1,
    passingMemberCount: 0,
    equivalentPassingGeometryCount: 0,
    recommendedMemberPairId: null,
    reason: "no_family_member_agreement",
    members: [{
      memberPairId: pair.id,
      sourceCoordinateMeters: 4,
      sourceThicknessMeters: 0.2,
      sourceLengthMeters: 8,
      coordinateErrorMeters: null,
      thicknessErrorMeters: null,
      sourceSpanCoverageRatio: 0,
      supportingWallIds: [],
      passed: false,
    }],
  }],
  diagnostics: [],
};

const raw = [
  segment("face-a", 3.9),
  segment("face-b", 4.1),
  segment("competing", 3.75),
];
const greedySelected = wall(
  "raster-wall-system-face-a:face-0-competing:face-2",
  "face-a:face-0",
  "competing:face-2",
  3.9,
  3.75,
);
const greedyGap = diagnoseSourcePairRasterPairingGaps({
  familyAgreement,
  consolidationClusters: clusters,
  annotationFilteredSegments: raw,
  explicitWallSystems: [greedySelected],
  sheetFrameWallSystems: [greedySelected],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(greedyGap.memberCount, 1);
assert.equal(greedyGap.reasonMemberCounts.greedy_face_claimed_candidate, 1, "source-supported raw pair must be identified when one of its faces was consumed by another greedy wall pairing");
assert.equal(greedyGap.members[0]?.matchingCandidateCount, 1);
assert.equal(greedyGap.members[0]?.bestCandidateId, "raster-wall-system-face-a:face-0-face-b:face-1");
assert.deepEqual(greedyGap.members[0]?.claimedFaceIds, ["face-a:face-0"]);
assert.ok((greedyGap.members[0]?.bestCoordinateErrorMeters ?? 1) <= 0.02);
assert.ok((greedyGap.members[0]?.bestThicknessErrorMeters ?? 1) <= 0.02);
assert.equal(greedyGap.members[0]?.bestSourceSpanCoverageRatio, 1);

const actualSelected = wall(
  "raster-wall-system-face-a:face-0-face-b:face-1",
  "face-a:face-0",
  "face-b:face-1",
  3.9,
  4.1,
);
const unexpected = diagnoseSourcePairRasterPairingGaps({
  familyAgreement,
  consolidationClusters: clusters,
  annotationFilteredSegments: raw,
  explicitWallSystems: [actualSelected],
  sheetFrameWallSystems: [actualSelected],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(unexpected.reasonMemberCounts.unexpected_selected_support, 1, "a matching selected wall in a no-agreement family must be surfaced as a consistency failure rather than hidden");

const sheetFrameExcluded = diagnoseSourcePairRasterPairingGaps({
  familyAgreement,
  consolidationClusters: clusters,
  annotationFilteredSegments: raw,
  explicitWallSystems: [actualSelected],
  sheetFrameWallSystems: [],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(sheetFrameExcluded.reasonMemberCounts.sheet_frame_excluded_candidate, 1);

const noRawPair = diagnoseSourcePairRasterPairingGaps({
  familyAgreement,
  consolidationClusters: clusters,
  annotationFilteredSegments: [segment("far-a", 5.0), segment("far-b", 5.2)],
  explicitWallSystems: [],
  sheetFrameWallSystems: [],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(noRawPair.reasonMemberCounts.no_matching_raw_pair, 1);
assert.equal(noRawPair.members[0]?.matchingCandidateCount, 0);

console.log("Blueprint raster pairing gap diagnostic contract passed.");
