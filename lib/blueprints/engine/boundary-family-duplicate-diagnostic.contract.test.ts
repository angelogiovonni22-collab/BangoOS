import assert from "node:assert/strict";
import { diagnoseBoundaryFamilyDuplicates } from "./boundary-family-duplicate-diagnostic";
import type { BosBoundaryFamilyProvenanceDiagnostic } from "./boundary-family-provenance-diagnostic";

const provenance: BosBoundaryFamilyProvenanceDiagnostic[] = [{
  dimensionId: "dimension-1",
  rawText: "10'-0\"",
  sourceAssociationMode: "witness_span",
  axis: "horizontal",
  startCoordinate: 0,
  endCoordinate: 3.048,
  startCandidates: [
    { wallId: "a", coordinate: 0.01, endpointDistanceMeters: 0.01, thicknessMeters: 0.15, lengthMeters: 4, confidence: 0.9, faceAPrimitiveId: "face-1", faceBPrimitiveId: "face-2", overlapRatio: 0.95 },
    { wallId: "b", coordinate: 0.03, endpointDistanceMeters: 0.03, thicknessMeters: 0.16, lengthMeters: 3.8, confidence: 0.88, faceAPrimitiveId: "face-1", faceBPrimitiveId: "face-2", overlapRatio: 0.94 },
    { wallId: "c", coordinate: 0.05, endpointDistanceMeters: 0.05, thicknessMeters: 0.17, lengthMeters: 3.5, confidence: 0.86, faceAPrimitiveId: "face-1", faceBPrimitiveId: "face-3", overlapRatio: 0.9 },
    { wallId: "d", coordinate: 0.06, endpointDistanceMeters: 0.06, thicknessMeters: 0.15, lengthMeters: 4, confidence: 0.91, faceAPrimitiveId: "face-x", faceBPrimitiveId: "face-y", overlapRatio: 0.96 },
  ],
  endCandidates: [],
}];

const result = diagnoseBoundaryFamilyDuplicates({ provenance });
assert.equal(result.pairs.length, 6);
assert.equal(result.pairs.find((pair) => pair.leftWallId === "a" && pair.rightWallId === "b")?.relation, "same_source_faces");
assert.equal(result.pairs.find((pair) => pair.leftWallId === "a" && pair.rightWallId === "c")?.relation, "near_coincident_variant");
assert.equal(result.pairs.find((pair) => pair.leftWallId === "a" && pair.rightWallId === "d")?.relation, "distinct_candidates");
assert.equal(result.sameSourceFacePairCount, 1);
assert(result.nearCoincidentVariantPairCount >= 1);
assert.equal(result.ambiguousEndpointsExplainedByDuplicateEvidence, 1);
assert(result.diagnostics.some((item) => item.includes("no candidate was removed or merged")));
assert(result.diagnostics.some((item) => item.includes("coordinate proximity alone")));
console.log("Blueprint boundary-family duplicate diagnostic contract passed.");
