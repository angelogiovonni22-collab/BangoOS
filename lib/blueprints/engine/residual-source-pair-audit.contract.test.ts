import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { auditResidualSourcePairs } from "./residual-source-pair-audit";

function wall(id: string, y: number, thickness = 0.2, start = 1, end = 5): BosWallSystemCandidate {
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

function pair(id: string, centerY: number, separationMeters = 0.2, start = 10, end = 50): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((centerY - separationMeters / 2) * 10),
    faceBFixedPixel: Math.round((centerY + separationMeters / 2) * 10),
    startPixel: start,
    endPixel: end,
    centerFixedPixel: centerY * 10,
    lengthMeters: (end - start) / 10,
    separationMeters,
  };
}

const unique = pair("unique", 4, 0.2);
const unmatched = pair("unmatched", 6, 0.2);
const report = auditResidualSourcePairs({
  retainedSourcePairs: [unique, unmatched],
  explicitWallSystems: [wall("unique-wall", 4.01, 0.205)],
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(report.sourcePairCount, 2);
assert.equal(report.uniquelyRepresentedPairCount, 1);
assert.equal(report.unmatchedPairCount, 1);
assert.equal(report.pairs.find((item) => item.pairId === "unique")?.reason, "unique_explicit_match");
assert.equal(report.pairs.find((item) => item.pairId === "unmatched")?.reason, "no_explicit_match");
assert(report.unmatchedSourceLengthRatio > 0);

const ambiguous = auditResidualSourcePairs({
  retainedSourcePairs: [pair("ambiguous", 4, 0.2)],
  explicitWallSystems: [wall("a", 4.005, 0.2), wall("b", 3.995, 0.2)],
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(ambiguous.ambiguousPairCount, 1);
assert.equal(ambiguous.pairs[0]?.eligibleMatchCount, 2);
assert.equal(ambiguous.pairs[0]?.reason, "ambiguous_explicit_match");

const shortCoverage = auditResidualSourcePairs({
  retainedSourcePairs: [pair("short-coverage", 4, 0.2, 10, 50)],
  explicitWallSystems: [wall("short", 4, 0.2, 1, 3)],
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(shortCoverage.unmatchedPairCount, 1, "an explicit wall covering only half of a source pair must not qualify");
assert((shortCoverage.pairs[0]?.nearestSourceSpanCoverageRatio ?? 0) < 0.9);

const coordinateMismatch = auditResidualSourcePairs({
  retainedSourcePairs: [pair("coordinate-mismatch", 4, 0.2)],
  explicitWallSystems: [wall("offset", 4.021, 0.2)],
  sourcePixelWidth: 100,
  sourcePixelHeight: 100,
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
});
assert.equal(coordinateMismatch.unmatchedPairCount, 1, "coordinate error above 2 cm must fail closed");

console.log("Blueprint residual source-pair audit contract passed.");
