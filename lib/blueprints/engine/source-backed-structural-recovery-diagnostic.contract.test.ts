import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseSourceBackedStructuralRecovery } from "./source-backed-structural-recovery-diagnostic";

function wall(id: string, y: number, thickness = 0.2): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: 1, y }, end: { x: 5, y } },
    thickness,
    length: 4,
    orientationRadians: 0,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: { start: { x: 1, y: y - thickness / 2 }, end: { x: 5, y: y - thickness / 2 } }, confidence: 0.9 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: { start: { x: 1, y: y + thickness / 2 }, end: { x: 5, y: y + thickness / 2 } }, confidence: 0.9 },
    overlapRatio: 1,
    confidence: 0.9,
  };
}

function pair(id: string, centerY: number, separationMeters = 0.2): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((centerY - separationMeters / 2) * 10),
    faceBFixedPixel: Math.round((centerY + separationMeters / 2) * 10),
    startPixel: 10,
    endPixel: 50,
    centerFixedPixel: centerY * 10,
    lengthMeters: 4,
    separationMeters,
  };
}

const selected = wall("selected", 2);
const recoverable = wall("recoverable", 4, 0.2);
const unsupported = wall("unsupported", 6, 0.2);
const report = diagnoseSourceBackedStructuralRecovery({
  preselectionWallSystems: [selected, recoverable, unsupported],
  selectedWallSystems: [selected],
  retainedSourcePairs: [pair("source-recoverable", 4, 0.2), pair("source-unsupported", 6, 0.2)],
  directSourceSupportByWallId: new Map([["recoverable", 0.99], ["unsupported", 0.8]]),
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(report.rejectedWallCount, 2);
assert.equal(report.strictlyMatchedRejectedWallCount, 1);
assert.equal(report.uniquelyRecoverableWallCount, 1);
assert.deepEqual(report.uniquelyRecoverableWallIds, ["recoverable"]);

const thicknessMismatch = diagnoseSourceBackedStructuralRecovery({
  preselectionWallSystems: [wall("mismatch", 4, 0.3)],
  selectedWallSystems: [],
  retainedSourcePairs: [pair("thin-source", 4, 0.2)],
  directSourceSupportByWallId: new Map([["mismatch", 1]]),
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(thicknessMismatch.uniquelyRecoverableWallCount, 0, "thickness mismatch above 2 cm must fail closed");

const ambiguous = diagnoseSourceBackedStructuralRecovery({
  preselectionWallSystems: [wall("ambiguous", 4, 0.2)],
  selectedWallSystems: [],
  retainedSourcePairs: [pair("source-a", 4, 0.2), pair("source-b", 4.001, 0.2)],
  directSourceSupportByWallId: new Map([["ambiguous", 1]]),
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(ambiguous.strictlyMatchedRejectedWallCount, 1);
assert.equal(ambiguous.uniquelyRecoverableWallCount, 0, "multiple eligible source pairs must remain ambiguous");
assert.equal(ambiguous.ambiguousRejectedWallCount, 1);

console.log("Blueprint source-backed structural recovery diagnostic contract passed.");
