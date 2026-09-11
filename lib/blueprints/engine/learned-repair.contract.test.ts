import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { applyBosValidation } from "./validation";
import { scoreLearnedInferenceAgainstGraph } from "./learned-consensus";
import { applyLearnedWallRepair } from "./learned-repair";
import type { BlueprintInferenceResponse } from "./python-inference";

const graph = createEmptyBosBuildingGraph({ buildingId: "building-1", sourcePage: 2 });
graph.building.sourceVersionId = "version-1";
graph.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.98 };

const makeWall = (id: string, start: [number, number], end: [number, number]): BosWall => ({
  id,
  levelId: "level-1",
  type: "unknown",
  centerline: { start: { x: start[0], y: start[1] }, end: { x: end[0], y: end[1] } },
  thickness: 0.14,
  height: 2.44,
  confidence: 0.9,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "contract", algorithmVersion: "1", evidenceIds: [] },
});

graph.walls = [
  makeWall("top", [0, 0], [6, 0]),
  makeWall("right", [6, 0], [6, 4]),
  makeWall("bottom", [6, 4], [0, 4]),
];
const baseline = applyBosValidation(graph);

const inference: BlueprintInferenceResponse = {
  protocol_version: "bos-blueprint-inference-v1",
  source_version_id: "version-1",
  source_page: 2,
  walls: [
    { start: [0, 0], end: [6, 0], confidence: 0.95, evidence: [{ source: "model", page: 2, confidence: 0.95, model: "raster2seq:test" }] },
    { start: [6, 0], end: [6, 4], confidence: 0.95, evidence: [{ source: "model", page: 2, confidence: 0.95, model: "raster2seq:test" }] },
    { start: [6, 4], end: [0, 4], confidence: 0.95, evidence: [{ source: "model", page: 2, confidence: 0.95, model: "raster2seq:test" }] },
    { start: [0, 4], end: [0, 0], confidence: 0.95, evidence: [{ source: "model", page: 2, confidence: 0.95, model: "raster2seq:test" }] },
  ],
  rooms: [],
  openings: [],
  model_runs: [{ capability: "room_polygons", model: "raster2seq", model_version: "test", status: "succeeded", latency_ms: 1, confidence: 0.95 }],
  consensus_confidence: 0.95,
  warnings: [],
};

const consensus = scoreLearnedInferenceAgainstGraph(baseline, inference);
assert.equal(consensus.status, "promotion_candidate");
const repair = applyLearnedWallRepair(baseline, inference, consensus);
assert.equal(repair.accepted, true);
assert.equal(repair.addedWallCount, 1);
assert.equal(repair.graph.walls.length, 4);
assert(repair.graph.validation.metrics.wallTopology > baseline.validation.metrics.wallTopology);
assert(repair.graph.validation.score >= baseline.validation.score + 0.03);

const rejected = applyLearnedWallRepair(baseline, { ...inference, source_page: 3 }, consensus);
assert.equal(rejected.accepted, false);
assert.equal(rejected.reason, "source_identity_mismatch");

console.log("learned repair contract passed");
