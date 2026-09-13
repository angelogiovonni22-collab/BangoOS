import assert from "node:assert/strict";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosIndependentDimensionBoundaryDiagnostic } from "./source-network-dimension-endpoint-diagnostic";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import { diagnoseBoundaryCoordinateMismatchProvenance } from "./boundary-coordinate-mismatch-provenance-diagnostic";

function wall(id: string, x: number, thickness: number): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x, y: 0 }, end: { x, y: 3 } },
    thickness,
    length: 3,
    orientationRadians: Math.PI / 2,
    confidence: 0.98,
    overlapRatio: 1,
    faceA: { id: `${id}-a`, primitiveId: `${id}-face-a`, sourcePage: 1, line: { start: { x: x - thickness / 2, y: 0 }, end: { x: x - thickness / 2, y: 3 } }, confidence: 0.98 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-face-b`, sourcePage: 1, line: { start: { x: x + thickness / 2, y: 0 }, end: { x: x + thickness / 2, y: 3 } }, confidence: 0.98 },
  };
}

const convergence: BosCrossEvidenceBoundaryConvergenceDiagnostic = {
  dimensionId: "dimension-23-4",
  rawText: "23'-4\"",
  dominantStartCoordinate: null,
  dominantEndCoordinate: 28.35,
  dominantStartLengthMeters: null,
  dominantEndLengthMeters: 12.9,
  candidates: [{
    independentStartCoordinate: 21.319,
    independentEndCoordinate: 28.355,
    candidateStartCoordinate: 21.342,
    candidateEndCoordinate: 28.351,
    independentRelativeSpanError: 0.0107,
    candidateRelativeSpanError: 0.0145,
    candidateStartWallIds: ["wall-start"],
    candidateEndWallIds: ["wall-end"],
  }],
  recommendedStartCoordinate: 21.342,
  recommendedEndCoordinate: 28.351,
  reason: "unique_cross_evidence_boundary_pair",
};

const independent: BosIndependentDimensionBoundaryDiagnostic = {
  dimensionId: "dimension-23-4",
  rawText: "23'-4\"",
  axis: "horizontal",
  startCoordinate: 21.159,
  endCoordinate: 28.292,
  startFamilies: [{ coordinate: 21.319, nearestEndpointDistanceMeters: 0.16, pairIds: ["source-start"] }],
  endFamilies: [{ coordinate: 28.355, nearestEndpointDistanceMeters: 0.06, pairIds: ["source-end"] }],
  passingPairs: [{ startCoordinate: 21.319, endCoordinate: 28.355, measuredSpanMeters: 7.036, relativeSpanError: 0.0107 }],
  recommendedStartCoordinate: null,
  recommendedEndCoordinate: null,
  reason: "ambiguous_independent_boundary_pair",
};

const pairs: BosSourceWallFacePair[] = [
  { id: "source-start", orientation: "vertical", faceAFixedPixel: 1255, faceBFixedPixel: 1263, startPixel: 500, endPixel: 900, centerFixedPixel: 1259, lengthMeters: 6.7, separationMeters: 0.135 },
  { id: "source-end", orientation: "vertical", faceAFixedPixel: 1672, faceBFixedPixel: 1677, startPixel: 200, endPixel: 980, centerFixedPixel: 1674.5, lengthMeters: 13, separationMeters: 0.085 },
];

const result = diagnoseBoundaryCoordinateMismatchProvenance({
  convergence: [convergence],
  independentDiagnostics: [independent],
  wallSystems: [wall("wall-start", 21.342, 0.293), wall("wall-end", 28.351, 0.11)],
  wallFacePairs: pairs,
  sourcePixelWidth: 2592,
  sourcePixelHeight: 1728,
  sourceWidthMeters: 43.8912,
  sourceHeightMeters: 29.2608,
});

assert.equal(result.dimensions.length, 1);
assert.equal(result.mismatchCount, 1);
assert.equal(result.dimensions[0].reason, "candidate_source_family_mismatch");
assert.equal(result.dimensions[0].endpoints[0].reason, "candidate_source_family_mismatch");
assert.equal(result.dimensions[0].endpoints[1].reason, "within_coordinate_target");
assert.deepEqual(result.dimensions[0].endpoints[0].candidateFacePrimitiveIds, ["wall-start-face-a", "wall-start-face-b"]);
assert.deepEqual(result.dimensions[0].endpoints[0].sourcePairIds, ["source-start"]);
assert.equal(result.dimensions[0].endpoints[0].candidateThicknessMeters[0], 0.293);
assert.equal(result.dimensions[0].endpoints[0].sourcePairSeparationMeters[0], 0.135);
assert(result.diagnostics.some((item) => item.includes("without moving")));

const withinTarget = diagnoseBoundaryCoordinateMismatchProvenance({
  convergence: [{ ...convergence, candidates: [{ ...convergence.candidates[0], candidateStartCoordinate: 21.329 }] }],
  independentDiagnostics: [independent],
  wallSystems: [wall("wall-start", 21.329, 0.15), wall("wall-end", 28.351, 0.11)],
  wallFacePairs: pairs,
  sourcePixelWidth: 2592,
  sourcePixelHeight: 1728,
  sourceWidthMeters: 43.8912,
  sourceHeightMeters: 29.2608,
});
assert.equal(withinTarget.mismatchCount, 0);
assert.equal(withinTarget.dimensions[0].reason, "within_coordinate_target");

console.log("Blueprint boundary coordinate mismatch provenance contract passed.");
