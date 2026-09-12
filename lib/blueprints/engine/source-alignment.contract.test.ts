import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { assessSourceGeometryAlignment } from "./source-alignment";
import { applyBosValidation } from "./validation";

function segment(start: [number, number], end: [number, number], id: string): BosRawSegment {
  return {
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    sourcePage: 1,
    sourceObjectId: id,
    confidence: 0.95,
  };
}

const source = [
  segment([0, 0], [5, 0], "a"),
  segment([5, 0], [5, 4], "b"),
  segment([5, 4], [0, 4], "c"),
  segment([0, 4], [0, 0], "d"),
];
const faithful = [
  segment([0.03, 0.02], [4.98, 0.01], "a-rebuilt"),
  segment([5.01, 0.04], [5, 3.97], "b-rebuilt"),
  segment([4.97, 4.02], [0.02, 4], "c-rebuilt"),
  segment([-0.01, 3.96], [0.02, 0.04], "d-rebuilt"),
];
const drifted = [
  segment([2, 2], [7, 2], "bad-a"),
  segment([7, 2], [7, 6], "bad-b"),
  segment([7, 6], [2, 6], "bad-c"),
  segment([2, 6], [2, 2], "bad-d"),
];

const faithfulReport = assessSourceGeometryAlignment(faithful, source);
const driftedReport = assessSourceGeometryAlignment(drifted, source);
assert(faithfulReport.score > 0.9, "geometry close to source evidence must receive a strong alignment score");
assert.equal(faithfulReport.supported, 4, "all faithful wall runs must retain source support");
assert(driftedReport.score < 0.45, "geometry that drifts away from the source sheet must fail fidelity scoring");

const graph = createEmptyBosBuildingGraph({ buildingId: "alignment-test", sourcePage: 1 });
graph.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.98 };
graph.walls = faithful.map((item, index) => ({
  id: `wall-${index + 1}`,
  levelId: "level-1",
  type: "exterior" as const,
  centerline: { start: item.start, end: item.end },
  thickness: 0.15,
  height: 2.44,
  confidence: 0.95,
  sourcePage: 1,
  evidence: [],
  provenance: { createdBy: "deterministic" as const, algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
}));
const metrics = graph.validation.metrics as typeof graph.validation.metrics & { sourceAlignment?: number };
metrics.sourceAlignment = 0.4;
const validation = applyBosValidation(graph).validation;
assert(validation.issues.some((item) => item.code === "SOURCE_ALIGNMENT_FAILURE"), "low source alignment must fail closed even when topology itself is clean");
assert.notEqual(validation.status, "reconstructed", "low source alignment must never be accepted as reconstructed");

console.log("Blueprint source alignment fidelity contract passed.");
