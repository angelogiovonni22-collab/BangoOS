import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import { diagnoseSourcePairFamilyAgreement } from "./source-pair-family-agreement-diagnostic";
import type { BosRasterPairingConflictDiagnostic } from "./source-pair-raster-conflict-diagnostic";
import type { BosRasterPairingGapMember } from "./source-pair-raster-pairing-gap-diagnostic";
import { simulateIsolatedSourceBackedRasterPairReplacements } from "./source-pair-isolated-replacement-simulation";
import type { BosWallSystemCandidate } from "./wall-system-builder";

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
function wall(id: string, faceAId: string, faceBId: string, yA: number, yB: number, start = 1, end = 9): BosWallSystemCandidate {
  const center = (yA + yB) / 2;
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: start, y: center }, end: { x: end, y: center } },
    thickness: Math.abs(yB - yA),
    length: end - start,
    orientationRadians: 0,
    faceA: { id: faceAId, primitiveId: faceAId, sourcePage: 1, line: { start: { x: start, y: yA }, end: { x: end, y: yA } }, confidence: 0.62 },
    faceB: { id: faceBId, primitiveId: faceBId, sourcePage: 1, line: { start: { x: start, y: yB }, end: { x: end, y: yB } }, confidence: 0.62 },
    overlapRatio: 1,
    confidence: 0.8,
  };
}

const target = sourcePair("source-target", 4, 0.2);
const protectedPair = sourcePair("source-protected", 8, 0.2);
const clusters: BosSourceWallPairConsolidationCluster[] = [target, protectedPair].map((pair) => ({
  representativePairId: pair.id,
  memberPairIds: [pair.id],
  members: [pair],
}));
const rawSegments = [
  segment("target-a", 3.9),
  segment("target-b", 4.1),
  segment("target-competing", 3.75),
  segment("protected-a", 7.9),
  segment("protected-b", 8.1),
];
const claimant = wall(
  "raster-wall-system-target-a:face-0-target-competing:face-2",
  "target-a:face-0",
  "target-competing:face-2",
  3.9,
  3.75,
);
const protectedWall = wall(
  "protected-wall",
  "protected-a:face-3",
  "protected-b:face-4",
  7.9,
  8.1,
);
const familyAgreement = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [target, protectedPair],
  consolidationClusters: clusters,
  explicitWallSystems: [claimant, protectedWall],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(familyAgreement.noAgreementCount, 1);
assert.equal(familyAgreement.uniqueAgreementCount, 1);

const gapMembers: BosRasterPairingGapMember[] = [{
  representativePairId: target.id,
  memberPairId: target.id,
  reason: "greedy_face_claimed_candidate",
  matchingCandidateCount: 1,
  bestCandidateId: "raster-wall-system-target-a:face-0-target-b:face-1",
  bestCoordinateErrorMeters: 0,
  bestThicknessErrorMeters: 0,
  bestSourceSpanCoverageRatio: 1,
  bestCandidateFaceIds: ["target-a:face-0", "target-b:face-1"],
  claimedFaceIds: ["target-a:face-0"],
}];
const conflictProvenance: BosRasterPairingConflictDiagnostic = {
  familyCount: 1,
  memberCount: 1,
  memberReasonCounts: {
    isolated_unbacked_single_candidate: 1,
    unbacked_multi_candidate: 0,
    source_backed_claimant_conflict: 0,
    mixed_claimant_conflict: 0,
    missing_claimant_wall: 0,
  },
  familyReasonCounts: {
    isolated_unbacked_candidate: 1,
    unbacked_candidate_ambiguity: 0,
    source_backed_conflict: 0,
    mixed_claimant_conflict: 0,
    missing_claimant: 0,
  },
  members: [{
    representativePairId: target.id,
    memberPairId: target.id,
    bestCandidateId: "raster-wall-system-target-a:face-0-target-b:face-1",
    matchingCandidateCount: 1,
    claimantWallIds: [claimant.id],
    sourceBackedClaimantWallIds: [],
    uniqueSupportFamilyIds: [],
    ambiguousSupportFamilyIds: [],
    reason: "isolated_unbacked_single_candidate",
  }],
  families: [{
    representativePairId: target.id,
    greedyMemberCount: 1,
    distinctBestCandidateIds: ["raster-wall-system-target-a:face-0-target-b:face-1"],
    claimantWallIds: [claimant.id],
    sourceBackedClaimantWallIds: [],
    allClaimantsUnbacked: true,
    allMembersSingleCandidate: true,
    candidateConverged: true,
    reason: "isolated_unbacked_candidate",
  }],
  diagnostics: [],
};

const simulation = simulateIsolatedSourceBackedRasterPairReplacements({
  familyAgreement,
  consolidationClusters: clusters,
  conflictProvenance,
  gapMembers,
  annotationFilteredSegments: rawSegments,
  explicitWallSystems: [claimant, protectedWall],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});

assert.equal(simulation.eligibleFamilyCount, 1);
assert.equal(simulation.simulatedFamilyCount, 1);
assert.deepEqual(simulation.removedWallIds, [claimant.id]);
assert.deepEqual(simulation.addedCandidateIds, ["raster-wall-system-target-a:face-0-target-b:face-1"]);
assert.equal(simulation.before.uniqueAgreementCount, 1);
assert.equal(simulation.before.noAgreementCount, 1);
assert.equal(simulation.after.uniqueAgreementCount, 2);
assert.equal(simulation.after.noAgreementCount, 0);
assert.equal(simulation.delta.uniqueAgreementCount, 1);
assert.equal(simulation.delta.noAgreementCount, -1);
assert.deepEqual(simulation.previouslyUniqueRegressionFamilyIds, []);
assert.equal(simulation.familyOutcomes[0]?.recoveredUnique, true);
assert.equal(simulation.safeToConsiderPromotion, true);

console.log("Blueprint isolated raster pair replacement simulation contract passed.");
