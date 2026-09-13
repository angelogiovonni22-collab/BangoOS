import assert from "node:assert/strict";
import { diagnoseDimensionChainBoundaries } from "./dimension-chain-boundary-diagnostic";

const wall = (id: string, coordinate: number, endpointDistanceMeters: number) => ({ wallId: id, coordinate, endpointDistanceMeters, thicknessMeters: 0.15, lengthMeters: 3, confidence: 0.95, faceAPrimitiveId: `${id}-a`, faceBPrimitiveId: `${id}-b`, overlapRatio: 1 });
const dimensions = [
  { id: "d1", levelId: "level-1", page: 1, start: { x: 0, y: 0 }, end: { x: 5, y: 0 }, value: 5, unit: "m" as const, confidence: 1, evidence: [] },
  { id: "d2", levelId: "level-1", page: 1, start: { x: 2, y: 0 }, end: { x: 5.02, y: 0 }, value: 3, unit: "m" as const, confidence: 1, evidence: [] },
];
const provenance = [
  { dimensionId: "d1", rawText: "5m", sourceAssociationMode: "single_segment" as const, axis: "horizontal" as const, startCoordinate: 0, endCoordinate: 5, startCandidates: [wall("left-a", 0.01, 0.01), wall("left-b", 0.04, 0.04)], endCandidates: [wall("good-a", 5.01, 0.01), wall("good-b", 5.04, 0.04), wall("bad", 5.27, 0.27)] },
  { dimensionId: "d2", rawText: "3m", sourceAssociationMode: "single_segment" as const, axis: "horizontal" as const, startCoordinate: 2, endCoordinate: 5.02, startCandidates: [wall("mid-a", 2.01, 0.01), wall("mid-b", 2.04, 0.04)], endCandidates: [wall("good-a", 5.01, 0.01), wall("good-b", 5.04, 0.02), wall("bad", 5.27, 0.25)] },
];
const result = diagnoseDimensionChainBoundaries({ dimensions, provenance });
assert.equal(result.uniqueChainBoundaryCount, 1);
assert.equal(result.chains[0].reason, "unique_chain_consistent_boundary");
assert(Math.abs((result.chains[0].recommendedCoordinate ?? 0) - 5.025) < 0.001);
assert.equal(result.chains[0].candidateCoordinates.length, 2);
console.log("Blueprint dimension-chain boundary diagnostic contract passed.");
