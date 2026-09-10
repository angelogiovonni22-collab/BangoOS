import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall, type BosRoom } from "./building-graph";
import { scoreLearnedInferenceAgainstGraph } from "./learned-consensus";
import type { BlueprintInferenceResponse } from "./python-inference";

const graph = createEmptyBosBuildingGraph({ buildingId: "test", sourcePage: 2 });
graph.building.sourceVersionId = "1d7fb860-1ff9-4295-88b4-4501661e9153";
graph.scale = { source: "dimension_solved", drawingUnitsPerMeter: 100, confidence: 0.98 };
graph.validation.metrics.scaleConfidence = 0.98;

const wall = (id: string, x1: number, y1: number, x2: number, y2: number): BosWall => ({
  id,
  levelId: "level-1",
  type: "unknown",
  centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
  thickness: 0.14,
  height: 2.7,
  confidence: 0.95,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] },
});

graph.walls = [
  wall("top", 0, 0, 4, 0),
  wall("right", 4, 0, 4, 3),
  wall("bottom", 4, 3, 0, 3),
  wall("left", 0, 3, 0, 0),
];
const room: BosRoom = {
  id: "room-1",
  levelId: "level-1",
  type: "room",
  polygon: { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }] },
  confidence: 0.9,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "test", algorithmVersion: "1", evidenceIds: [] },
};
graph.rooms = [room];

const evidence = [{ source: "model" as const, page: 2, confidence: 0.94, model: "raster2seq" }];
const inference: BlueprintInferenceResponse = {
  protocol_version: "bos-blueprint-inference-v1",
  source_version_id: graph.building.sourceVersionId,
  source_page: 2,
  walls: graph.walls.map((item) => ({
    start: [item.centerline.start.x, item.centerline.start.y],
    end: [item.centerline.end.x, item.centerline.end.y],
    confidence: 0.94,
    evidence,
  })),
  rooms: [{ points: [[0, 0], [4, 0], [4, 3], [0, 3]], confidence: 0.93, evidence }],
  openings: [],
  model_runs: [{ capability: "room_polygons", model: "raster2seq", model_version: "siggraph-2026", status: "succeeded", latency_ms: 120, confidence: 0.93 }],
  consensus_confidence: 0.93,
  warnings: [],
};

const supported = scoreLearnedInferenceAgainstGraph(graph, inference);
assert.equal(supported.status, "promotion_candidate", "strongly agreeing learned geometry should become a promotion candidate");
assert.ok(supported.score >= 0.9);

const mismatch = scoreLearnedInferenceAgainstGraph(graph, { ...inference, source_page: 3 });
assert.equal(mismatch.status, "reject");
assert.deepEqual(mismatch.reasons, ["source_page_mismatch"]);

const hallucinated: BlueprintInferenceResponse = {
  ...inference,
  walls: inference.walls.map((item) => ({
    ...item,
    start: [item.start[0] + 10, item.start[1] + 10],
    end: [item.end[0] + 10, item.end[1] + 10],
  })),
  consensus_confidence: 0.99,
};
const rejected = scoreLearnedInferenceAgainstGraph(graph, hallucinated);
assert.equal(rejected.status, "reject", "high model confidence must not override disagreement with deterministic evidence");
assert.ok(rejected.reasons.includes("insufficient_deterministic_wall_coverage"));
assert.ok(rejected.reasons.includes("insufficient_learned_wall_precision"));

console.log("Blueprint learned consensus contract: passed");
