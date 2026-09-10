import assert from "node:assert/strict";
import { validateBlueprintInferenceResponse } from "./python-inference";

const evidence = [{ source: "model" as const, page: 2, confidence: 0.94, model: "raster2seq" }];

const valid = {
  protocol_version: "bos-blueprint-inference-v1" as const,
  source_version_id: "1d7fb860-1ff9-4295-88b4-4501661e9153",
  source_page: 2,
  walls: [{ start: [0, 0], end: [4, 0], confidence: 0.91, evidence }],
  rooms: [{ points: [[0, 0], [4, 0], [4, 3], [0, 3]], label: "living", confidence: 0.9, evidence }],
  openings: [{ kind: "door", center: [2, 0], width_m: 0.91, confidence: 0.87, evidence }],
  model_runs: [{ capability: "room_polygons", model: "raster2seq", model_version: "siggraph-2026", status: "succeeded", latency_ms: 120, confidence: 0.9 }],
  consensus_confidence: 0.9,
  warnings: [],
};

assert.equal(validateBlueprintInferenceResponse(valid), true, "evidence-backed inference payload should pass the boundary");
assert.equal(validateBlueprintInferenceResponse({ ...valid, protocol_version: "unknown" }), false, "unknown protocol must fail closed");
assert.equal(validateBlueprintInferenceResponse({ ...valid, walls: [{ ...valid.walls[0], evidence: [] }] }), false, "AI geometry without provenance must be rejected");
assert.equal(validateBlueprintInferenceResponse({ ...valid, rooms: [{ ...valid.rooms[0], points: [[0, 0], [1, 1]] }] }), false, "invalid polygons must be rejected");

console.log("Blueprint Python inference boundary contract: passed");
