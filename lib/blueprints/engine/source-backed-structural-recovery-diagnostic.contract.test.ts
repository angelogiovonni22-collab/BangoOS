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

function pair(id: string, centerY: number, separationMeters = 0.2, startPixel = 10, endPixel = 50): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((centerY - separationMeters / 2) * 10),
    faceBFixedPixel: Math.round((centerY + separationMeters / 2) * 10),
    startPixel,
    endPixel,
    centerFixedPixel: centerY * 10,
    lengthMeters: Math.abs(endPixel - startPixel) / 10,
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
assert.equal(report.compositeRecoverableWallCount, 0);
assert.equal(report.candidates[0].candidateCoverageRatio, 1);

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
assert.equal(thicknessMismatch.compositeRecoverableWallCount, 0);

const shortSource = diagnoseSourceBackedStructuralRecovery({
  preselectionWallSystems: [wall("long-candidate", 4, 0.2)],
  selectedWallSystems: [],
  retainedSourcePairs: [pair("short-source", 4, 0.2, 20, 30)],
  directSourceSupportByWallId: new Map([["long-candidate", 1]]),
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(shortSource.uniquelyRecoverableWallCount, 0, "a short retained source pair must not justify most of a longer rejected wall");
assert.equal(shortSource.compositeRecoverableWallCount, 0, "one short source fragment cannot use the composite path");

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
assert.equal(ambiguous.compositeRecoverableWallCount, 0, "duplicate full-span source pairs must not masquerade as composite evidence");

const composite = diagnoseSourceBackedStructuralRecovery({
  preselectionWallSystems: [wall("fragmented-source-wall", 4, 0.2)],
  selectedWallSystems: [],
  retainedSourcePairs: [
    pair("fragment-a", 4, 0.2, 10, 29),
    pair("fragment-b", 4, 0.2, 31, 50),
  ],
  directSourceSupportByWallId: new Map([["fragmented-source-wall", 0.99]]),
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(composite.uniquelyRecoverableWallCount, 0, "neither fragment independently covers the wall");
assert.equal(composite.compositeRecoverableWallCount, 1, "two unique source fragments may jointly prove the existing wall");
assert.deepEqual(composite.compositeRecoverableWallIds, ["fragmented-source-wall"]);
assert.equal(composite.compositeCandidates[0].pairIds.length, 2);
assert.ok(composite.compositeCandidates[0].candidateCoverageRatio >= 0.9);
assert.ok(composite.compositeCandidates[0].nonRedundantCoverageRatio >= 0.8);

const sharedPair = diagnoseSourceBackedStructuralRecovery({
  preselectionWallSystems: [wall("shared-a", 4, 0.2), wall("shared-b", 4.001, 0.2)],
  selectedWallSystems: [],
  retainedSourcePairs: [
    pair("shared-fragment-a", 4, 0.2, 10, 29),
    pair("shared-fragment-b", 4, 0.2, 31, 50),
  ],
  directSourceSupportByWallId: new Map([["shared-a", 1], ["shared-b", 1]]),
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(sharedPair.compositeRecoverableWallCount, 0, "a source fragment compatible with multiple rejected walls must fail closed");

console.log("Blueprint source-backed structural recovery diagnostic contract passed.");
