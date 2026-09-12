import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph } from "./building-graph";
import { recognizeArchitecturalSemantics, type ScaledTextToken } from "./architecture";

const graph = createEmptyBosBuildingGraph({ buildingId: "semantic-support-test", sourcePage: 1, sourceSheetTitle: "First Floor Plan" });
graph.walls = [
  { id: "wall-top", levelId: "level-1", type: "exterior", centerline: { start: { x: 0, y: 0 }, end: { x: 6, y: 0 } }, thickness: 0.15, height: 2.44, confidence: 0.95, sourcePage: 1, evidence: [], provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] } },
  { id: "wall-right", levelId: "level-1", type: "exterior", centerline: { start: { x: 6, y: 0 }, end: { x: 6, y: 5 } }, thickness: 0.15, height: 2.44, confidence: 0.95, sourcePage: 1, evidence: [], provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] } },
  { id: "wall-bottom", levelId: "level-1", type: "exterior", centerline: { start: { x: 6, y: 5 }, end: { x: 0, y: 5 } }, thickness: 0.15, height: 2.44, confidence: 0.95, sourcePage: 1, evidence: [], provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] } },
  { id: "wall-left", levelId: "level-1", type: "exterior", centerline: { start: { x: 0, y: 5 }, end: { x: 0, y: 0 } }, thickness: 0.15, height: 2.44, confidence: 0.95, sourcePage: 1, evidence: [], provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] } },
];

function token(text: string, xMeters: number, yMeters: number): ScaledTextToken {
  return { text, page: 1, xMeters, yMeters, x: xMeters, y: yMeters, width: 0, height: 0 };
}

const supported = recognizeArchitecturalSemantics(graph, [
  token("2-CAR GARAGE", 3, 2.5),
  token("PATIO", 3, 5.5),
]);
assert(supported.rooms.some((room) => /garage/i.test(room.name || "")), "A garage label with nearby structural wall evidence must still produce a supported semantic room");
assert.equal(supported.decksPorches.length, 1, "A patio/deck label with nearby structural wall evidence must still produce a supported slab semantic");
const garage = supported.rooms.find((room) => /garage/i.test(room.name || ""));
assert(garage && Math.max(...garage.polygon.points.map((point) => point.x)) <= 6, "Semantic room geometry must stay bounded by nearby reconstructed walls");

const unsupported = recognizeArchitecturalSemantics(graph, [
  token("PATIO", 30, 30),
  token("UP", 30, 31),
]);
assert.equal(unsupported.decksPorches.length, 0, "A distant patio label without nearby structural wall evidence must not invent a slab polygon");
assert.equal(unsupported.stairs.length, 0, "A distant stair-direction label without nearby structural wall evidence must not invent a stair polygon");

console.log("B.O.S. semantic support-bound regression: PASS");
