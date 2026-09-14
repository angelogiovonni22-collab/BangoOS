import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosSourceWallPairConsolidationCluster } from "./source-wall-pair-consolidator";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseSourcePairFamilyAgreement } from "./source-pair-family-agreement-diagnostic";
import { diagnoseSourcePairCoordinateOffsets } from "./source-pair-coordinate-offset-diagnostic";

const scale = 100;
function pair(id: string, y: number, thickness: number, start = 1, end = 9): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((y - thickness / 2) * scale),
    faceBFixedPixel: Math.round((y + thickness / 2) * scale),
    centerFixedPixel: y * scale,
    startPixel: start * scale,
    endPixel: end * scale,
    lengthMeters: end - start,
    separationMeters: thickness,
  };
}

function wall(id: string, y: number, thickness: number, start = 1, end = 9): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: start, y }, end: { x: end, y } },
    thickness,
    length: end - start,
    orientationRadians: 0,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: { start: { x: start, y: y - thickness / 2 }, end: { x: end, y: y - thickness / 2 } }, confidence: 0.9 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: { start: { x: start, y: y + thickness / 2 }, end: { x: end, y: y + thickness / 2 } }, confidence: 0.9 },
    overlapRatio: 1,
    confidence: 0.9,
  };
}

const a = pair("a", 4, 0.20);
const b = pair("b", 7, 0.20);
const c = pair("c", 10, 0.20);
const clusters: BosSourceWallPairConsolidationCluster[] = [
  { representativePairId: a.id, memberPairIds: [a.id], members: [a] },
  { representativePairId: b.id, memberPairIds: [b.id], members: [b] },
  { representativePairId: c.id, memberPairIds: [c.id], members: [c] },
];
const walls = [wall("wa", 4.10, 0.205), wall("wb", 7.11, 0.195), wall("wc", 10.35, 0.20)];
const familyAgreement = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [a, b, c],
  consolidationClusters: clusters,
  explicitWallSystems: walls,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(familyAgreement.noAgreementCount, 3, "the unchanged 2 cm coordinate gate must reject the offset fixtures");

const diagnostic = diagnoseSourcePairCoordinateOffsets({
  familyAgreement,
  consolidationClusters: clusters,
  explicitWallSystems: walls,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(diagnostic.observationCount, 3);
assert.equal(diagnostic.familyCount, 3);
assert.equal(diagnostic.horizontalObservationCount, 3);
assert.equal(diagnostic.verticalObservationCount, 0);
assert.ok(Math.abs((diagnostic.medianSignedOffsetMeters.horizontal ?? 0) - 0.11) < 1e-9);
assert.equal(diagnostic.buckets[0]?.observationCount, 2, "nearby signed offsets across distinct families must cluster diagnostically");
assert.equal(diagnostic.buckets[0]?.familyCount, 2);
assert.equal(diagnostic.buckets[0]?.wallCount, 2);
assert.equal(diagnostic.observations.every((item) => item.thicknessErrorMeters <= 0.02), true);

const bestHorizontal = diagnostic.simulation.bestCandidateByOrientation.horizontal;
assert.ok(bestHorizontal, "a repeated multi-family, multi-wall offset bucket must be simulated");
assert.ok(Math.abs((bestHorizontal?.offsetMeters ?? 0) - 0.105) < 1e-9);
assert.equal(bestHorizontal?.sourceFamilyCount, 2);
assert.equal(bestHorizontal?.sourceWallCount, 2);
assert.equal(bestHorizontal?.recoveredFamilyCount, 2, "the repeated offset must recover only the two aligned families under the unchanged coordinate gate");
assert.equal(bestHorizontal?.uniquelySupportedRecoveredFamilyCount, 2, "recovery must remain tied to one existing explicit wall per family");
assert.equal(bestHorizontal?.ambiguousSupportRecoveredFamilyCount, 0);
assert.equal(bestHorizontal?.recoveredWallCount, 2);
assert.equal(bestHorizontal?.coordinateRejectedObservationCount, 1, "the distant third offset must stay rejected instead of being pulled into the candidate");
assert.ok((bestHorizontal?.maximumRecoveredCoordinateResidualMeters ?? 1) <= 0.02);
assert.equal(diagnostic.simulation.bestCandidateByOrientation.vertical, null);
assert.match(diagnostic.simulation.diagnostics.join(" "), /never applied/i);

const lowCoverageA = pair("low-coverage-a", 13, 0.20, 1, 9);
const lowCoverageB = pair("low-coverage-b", 16, 0.20, 1, 9);
const lowCoverageClusters: BosSourceWallPairConsolidationCluster[] = [
  { representativePairId: lowCoverageA.id, memberPairIds: [lowCoverageA.id], members: [lowCoverageA] },
  { representativePairId: lowCoverageB.id, memberPairIds: [lowCoverageB.id], members: [lowCoverageB] },
];
const lowCoverageWalls = [wall("low-a", 13.10, 0.20, 1, 5.8), wall("low-b", 16.11, 0.20, 1, 5.8)];
const lowCoverageAgreement = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [lowCoverageA, lowCoverageB],
  consolidationClusters: lowCoverageClusters,
  explicitWallSystems: lowCoverageWalls,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
const lowCoverageDiagnostic = diagnoseSourcePairCoordinateOffsets({
  familyAgreement: lowCoverageAgreement,
  consolidationClusters: lowCoverageClusters,
  explicitWallSystems: lowCoverageWalls,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(lowCoverageDiagnostic.simulation.bestCandidateByOrientation.horizontal?.recoveredFamilyCount, 0, "coordinate correction must not bypass the existing 90% source-span coverage requirement");
assert.equal(lowCoverageDiagnostic.simulation.bestCandidateByOrientation.horizontal?.coverageRejectedObservationCount, 2);

const thicknessMismatch = [wall("bad-thickness", 4.10, 0.30)];
const mismatchAgreement = diagnoseSourcePairFamilyAgreement({
  retainedSourcePairs: [a],
  consolidationClusters: [clusters[0]],
  explicitWallSystems: thicknessMismatch,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
const mismatchDiagnostic = diagnoseSourcePairCoordinateOffsets({
  familyAgreement: mismatchAgreement,
  consolidationClusters: [clusters[0]],
  explicitWallSystems: thicknessMismatch,
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(mismatchDiagnostic.observationCount, 0, "coordinate-offset evidence must not use walls that fail the unchanged thickness gate");
assert.equal(mismatchDiagnostic.simulation.candidates.length, 0);

console.log("Blueprint source pair coordinate offset diagnostic contract passed.");
