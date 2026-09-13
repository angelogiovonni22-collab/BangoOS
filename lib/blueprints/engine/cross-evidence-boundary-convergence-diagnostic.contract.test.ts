import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosBoundaryFamilyProvenanceDiagnostic } from "./boundary-family-provenance-diagnostic";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import type { BosIndependentDimensionBoundaryDiagnostic } from "./source-network-dimension-endpoint-diagnostic";
import { diagnoseCrossEvidenceBoundaryConvergence } from "./cross-evidence-boundary-convergence-diagnostic";

const dimension: BosDimension = {
  id: "dimension-a",
  levelId: "level-1",
  page: 1,
  start: { x: 10, y: 2 },
  end: { x: 17, y: 2 },
  value: 7,
  unit: "m",
  rawText: "7.00 m",
  confidence: 0.9,
  evidence: [],
};

const independent: BosIndependentDimensionBoundaryDiagnostic = {
  dimensionId: dimension.id,
  rawText: dimension.rawText || "",
  axis: "horizontal",
  startCoordinate: 10,
  endCoordinate: 17,
  startFamilies: [
    { coordinate: 10.05, nearestEndpointDistanceMeters: 0.05, pairIds: ["start-a"] },
    { coordinate: 10.20, nearestEndpointDistanceMeters: 0.20, pairIds: ["start-b"] },
  ],
  endFamilies: [
    { coordinate: 17.04, nearestEndpointDistanceMeters: 0.04, pairIds: ["end-long"] },
    { coordinate: 16.90, nearestEndpointDistanceMeters: 0.10, pairIds: ["end-short"] },
  ],
  passingPairs: [
    { startCoordinate: 10.05, endCoordinate: 17.04, measuredSpanMeters: 6.99, relativeSpanError: 0.0014285714285713977 },
    { startCoordinate: 10.20, endCoordinate: 17.04, measuredSpanMeters: 6.84, relativeSpanError: 0.022857142857142805 },
    { startCoordinate: 10.05, endCoordinate: 16.90, measuredSpanMeters: 6.85, relativeSpanError: 0.021428571428571352 },
  ],
  recommendedStartCoordinate: null,
  recommendedEndCoordinate: null,
  reason: "ambiguous_independent_boundary_pair",
};

const provenance: BosBoundaryFamilyProvenanceDiagnostic = {
  dimensionId: dimension.id,
  rawText: dimension.rawText,
  sourceAssociationMode: "witness_span",
  axis: "horizontal",
  startCoordinate: 10,
  endCoordinate: 17,
  startCandidates: [
    { wallId: "wall-start", coordinate: 10.04, endpointDistanceMeters: 0.04, thicknessMeters: 0.15, lengthMeters: 1.8, confidence: 0.9, faceAPrimitiveId: "a", faceBPrimitiveId: "b", overlapRatio: 1 },
  ],
  endCandidates: [
    { wallId: "wall-end-a", coordinate: 17.03, endpointDistanceMeters: 0.03, thicknessMeters: 0.15, lengthMeters: 8, confidence: 0.95, faceAPrimitiveId: "c", faceBPrimitiveId: "d", overlapRatio: 1 },
    { wallId: "wall-end-b", coordinate: 16.89, endpointDistanceMeters: 0.11, thicknessMeters: 0.15, lengthMeters: 1.5, confidence: 0.9, faceAPrimitiveId: "e", faceBPrimitiveId: "f", overlapRatio: 1 },
  ],
};

function pair(id: string, lengthMeters: number): BosSourceWallFacePair {
  return { id, orientation: "vertical", faceAFixedPixel: 0, faceBFixedPixel: 1, startPixel: 0, endPixel: 10, centerFixedPixel: 0.5, lengthMeters, separationMeters: 0.15 };
}

const result = diagnoseCrossEvidenceBoundaryConvergence({
  dimensions: [dimension],
  independentDiagnostics: [independent],
  provenance: [provenance],
  wallFacePairs: [pair("start-a", 1.8), pair("start-b", 1.6), pair("end-long", 8), pair("end-short", 1.5)],
});
assert.equal(result.uniqueConvergenceCount, 1);
assert.equal(result.dimensions[0].reason, "unique_cross_evidence_boundary_pair");
assert.equal(result.dimensions[0].recommendedStartCoordinate, 10.04);
assert.equal(result.dimensions[0].recommendedEndCoordinate, 17.03);
assert.equal(result.dimensions[0].dominantStartCoordinate, null, "near-equal start extents must not fabricate a source anchor");
assert.equal(result.dimensions[0].dominantEndCoordinate, 17.04, "a clearly dominant retained source-wall extent may act as a read-only anchor");
assert(result.diagnostics.some((item) => item.includes("Read-only")));

const noAnchor = diagnoseCrossEvidenceBoundaryConvergence({
  dimensions: [dimension],
  independentDiagnostics: [independent],
  provenance: [provenance],
  wallFacePairs: [pair("start-a", 1.8), pair("start-b", 1.6), pair("end-long", 1.8), pair("end-short", 1.5)],
});
assert.equal(noAnchor.dimensions[0].reason, "no_dominant_source_anchor");
assert.equal(noAnchor.uniqueConvergenceCount, 0);

console.log("Blueprint cross-evidence boundary convergence diagnostic contract passed.");
