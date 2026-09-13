import assert from "node:assert/strict";
import { diagnoseIndependentSourceDimensionBoundaries } from "./source-network-dimension-endpoint-diagnostic";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";

const pair = (id: string, xMeters: number): BosSourceWallFacePair => ({
  id,
  orientation: "vertical",
  faceAFixedPixel: Math.round((xMeters - 0.05) * 100),
  faceBFixedPixel: Math.round((xMeters + 0.05) * 100),
  startPixel: 0,
  endPixel: 400,
  centerFixedPixel: Math.round(xMeters * 100),
  lengthMeters: 4,
  separationMeters: 0.1,
});

const dimensions = [
  { id: "d1", levelId: "level-1", page: 1, start: { x: 10, y: 0 }, end: { x: 14, y: 0 }, value: 4, unit: "m" as const, confidence: 1, rawText: "13'-1\"", evidence: [] },
];
const associations = [
  { dimensionId: "d1", sourceSegmentId: "s1", sourceSegmentIds: ["s1"], start: { x: 10, y: 2 }, end: { x: 14, y: 2 }, orientation: "horizontal" as const, evidenceMode: "single_segment" as const, relativeLengthError: 0, labelDistanceMeters: 0, startWitnessSupport: true, endWitnessSupport: true, confidence: 1 },
];

const unique = diagnoseIndependentSourceDimensionBoundaries({
  dimensions,
  associations,
  dimensionIds: new Set(["d1"]),
  wallFacePairs: [pair("left", 10.04), pair("right-a", 14.02), pair("right-b", 14.06)],
  sourcePixelWidth: 3000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 30,
  sourceHeightMeters: 20,
});
assert.equal(unique.uniquePairCount, 1);
assert.equal(unique.dimensions[0].reason, "unique_independent_boundary_pair");
assert.equal(unique.dimensions[0].endFamilies.length, 1, "near-duplicate source pairs should cluster into one boundary family");

const ambiguous = diagnoseIndependentSourceDimensionBoundaries({
  dimensions,
  associations,
  dimensionIds: new Set(["d1"]),
  wallFacePairs: [pair("left", 10.04), pair("right-a", 14.02), pair("right-b", 14.26)],
  sourcePixelWidth: 3000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 30,
  sourceHeightMeters: 20,
});
assert.equal(ambiguous.uniquePairCount, 0);
assert.equal(ambiguous.dimensions[0].reason, "ambiguous_independent_boundary_pair");

const residual = diagnoseIndependentSourceDimensionBoundaries({
  dimensions,
  associations,
  dimensionIds: new Set(["d1"]),
  wallFacePairs: [pair("left", 10.25), pair("wrong-right", 13.7)],
  sourcePixelWidth: 3000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 30,
  sourceHeightMeters: 20,
});
assert.equal(residual.dimensions[0].reason, "independent_boundary_span_residual_too_high");

console.log("Blueprint independent source-network dimension endpoint diagnostic contract passed.");
