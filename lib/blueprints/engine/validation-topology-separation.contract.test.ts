import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { validateBosBuildingGraph } from "./validation";

const graph = createEmptyBosBuildingGraph({ buildingId: "topology-separation", sourcePage: 2 });
graph.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.98 };
const wall = (id: string, type: "exterior" | "interior", x1: number, y1: number, x2: number, y2: number): BosWall => ({
  id,
  levelId: "level-1",
  type,
  centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
  thickness: 0.1524,
  height: 2.4384,
  confidence: 0.95,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "validation-fixture", algorithmVersion: "1", evidenceIds: [] },
});

graph.walls = [
  wall("e1", "exterior", 0, 0, 2, 0),
  wall("e2", "exterior", 2, 0, 4, 0),
  wall("e3", "exterior", 4, 0, 4, 2),
  wall("i1", "interior", 10, 10, 12, 10),
  wall("i2", "interior", 12, 10, 12, 12),
  wall("i3", "interior", 12, 12, 10, 12),
  wall("i4", "interior", 10, 12, 10, 10),
];

const report = validateBosBuildingGraph(graph, {
  reconstructedScore: 0.78,
  reviewScore: 0.52,
  minExteriorWalls: 0,
  minTotalWalls: 1,
  minScaleConfidence: 0.55,
  minClosure: 0.7,
});

assert(report.metrics.wallTopology > report.metrics.exteriorClosure, "wallTopology must measure the complete wall graph independently of exterior closure");
assert.equal(report.metrics.wallTopology, 0.75, "complete topology includes the closed interior loop");
assert.equal(report.metrics.exteriorClosure, 0.5, "exterior closure remains an independent perimeter metric");
assert.equal(report.issues.some((item) => item.code === "OPEN_TOPOLOGY"), false, "OPEN_TOPOLOGY is based on the complete reconstructed wall graph");

console.log("Blueprint validation topology separation contract: passed");
