import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseSourceNetworkCoverageGaps } from "./source-network-coverage-gap-diagnostic";

function pair(id: string, centerPx: number, startPx: number, endPx: number): BosSourceWallFacePair {
  return {
    id,
    orientation: "vertical",
    faceAFixedPixel: centerPx - 2,
    faceBFixedPixel: centerPx + 2,
    startPixel: startPx,
    endPixel: endPx,
    centerFixedPixel: centerPx,
    lengthMeters: (endPx - startPx) / 10,
    separationMeters: 0.4,
  };
}

function wall(id: string, x: number, y0: number, y1: number): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x, y: y0 }, end: { x, y: y1 } },
    thickness: 0.2,
    length: y1 - y0,
    orientationRadians: Math.PI / 2,
    confidence: 0.98,
    overlapRatio: 1,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: { start: { x: x - 0.1, y: y0 }, end: { x: x - 0.1, y: y1 } }, confidence: 0.98 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: { start: { x: x + 0.1, y: y0 }, end: { x: x + 0.1, y: y1 } }, confidence: 0.98 },
  };
}

const full = diagnoseSourceNetworkCoverageGaps({
  wallFacePairs: [pair("source-full", 100, 0, 100)],
  wallSystems: [wall("wall-full", 10.1, 0, 10)],
  sourcePixelWidth: 200,
  sourcePixelHeight: 200,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
  faceDistanceToleranceMeters: 0.02,
});
assert.equal(full.fullyCoveredPairCount, 1);
assert.equal(full.uncoveredPairCount, 0);
assert.equal(full.gaps.length, 0);

const partial = diagnoseSourceNetworkCoverageGaps({
  wallFacePairs: [pair("source-partial", 100, 0, 100)],
  wallSystems: [wall("wall-partial", 10.1, 0, 4)],
  sourcePixelWidth: 200,
  sourcePixelHeight: 200,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
  faceDistanceToleranceMeters: 0.02,
});
assert.equal(partial.partiallyCoveredPairCount, 1);
assert(partial.gaps[0].uncoveredLengthMeters > 5.9 && partial.gaps[0].uncoveredLengthMeters < 6.1);

const missing = diagnoseSourceNetworkCoverageGaps({
  wallFacePairs: [pair("source-missing", 100, 0, 100)],
  wallSystems: [wall("wall-far", 12, 0, 10)],
  sourcePixelWidth: 200,
  sourcePixelHeight: 200,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
assert.equal(missing.uncoveredPairCount, 1);
assert.equal(missing.gaps[0].pairId, "source-missing");
assert(missing.gaps[0].nearestCandidateFaceDistanceMeters !== null);

console.log("Blueprint source-network coverage gap diagnostic contract passed.");
