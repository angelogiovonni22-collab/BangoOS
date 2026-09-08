import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { MITCHELL_DEWITT_FIRST_FLOOR, runBuildingGraphBenchmark } from "./benchmarks";
import { parseArchitecturalLength, parsePrintedScale } from "./dimensions";
import { footprintComplexity, mergeCollinearSegments, topologyMetrics, type BosRawSegment } from "./geometry";
import { selectTargetPage, type BosParsedPage } from "./plan-parser";
import { applyBosValidation } from "./validation";

const scale = parsePrintedScale(`1/4\" = 1'-0\"`);
assert(scale, "Architectural scale should parse");
assert(scale.drawingUnitsPerMeter && scale.drawingUnitsPerMeter > 0, "Architectural scale must produce drawing-units-per-meter");
assert.equal(Math.round((parseArchitecturalLength(`10'-6\"`) || 0) * 1000), 3200, "10 ft 6 in should resolve to 3.2004m within rounding");

const pages: BosParsedPage[] = [
  { pageNumber: 1, width: 1000, height: 700, text: [{ text: "EXISTING BASEMENT FLOOR PLAN", page: 1 }], vectorSegments: [], rasterRequired: false },
  { pageNumber: 2, width: 1000, height: 700, text: [{ text: "EXISTING FIRST FLOOR PLAN 1/4\" = 1'-0\" OUTSIDE DECK 2-CAR GARAGE", page: 2 }], vectorSegments: [], rasterRequired: false },
  { pageNumber: 3, width: 1000, height: 700, text: [{ text: "EXISTING SECOND FLOOR PLAN", page: 3 }], vectorSegments: [], rasterRequired: false },
];
const selected = selectTargetPage(pages, { title: "EXISTING FIRST FLOOR PLAN", discipline: "Architectural" });
assert.equal(selected.page.pageNumber, 2, "Registered first-floor sheet must target page 2 rather than page 1");
assert(selected.score > 0.5, "Target page should have a strong deterministic match");

const raw: BosRawSegment[] = [
  { sourcePage: 2, start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
  { sourcePage: 2, start: { x: 4, y: 0 }, end: { x: 8, y: 0 } },
  { sourcePage: 2, start: { x: 8, y: 0 }, end: { x: 8, y: 4 } },
];
const merged = mergeCollinearSegments(raw);
assert.equal(merged.length, 2, "Collinear connected wall segments should merge deterministically");
assert.equal(topologyMetrics(merged).nodes, 3, "Topology metrics should preserve snapped graph endpoints");

const graph = createEmptyBosBuildingGraph({
  buildingId: "benchmark-house",
  sourcePage: 2,
  levelName: "First Floor",
  sourceSheetTitle: "EXISTING FIRST FLOOR PLAN",
});
graph.scale = scale;

const perimeter = [
  [0, 0, 12, 0], [12, 0, 12, 4], [12, 4, 15, 4], [15, 4, 15, 11],
  [15, 11, 11, 11], [11, 11, 11, 14], [11, 14, 5, 14], [5, 14, 5, 11],
  [5, 11, 0, 11], [0, 11, 0, 7], [-5, 7, -5, 0], [-5, 0, 0, 0],
] as const;
graph.walls = perimeter.map(([x1, y1, x2, y2], index): BosWall => ({
  id: `wall-${index + 1}`,
  levelId: "level-1",
  type: "exterior",
  centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
  thickness: 0.1524,
  height: 2.4384,
  confidence: 0.92,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "benchmark-fixture", algorithmVersion: "1", evidenceIds: [] },
}));
assert(footprintComplexity(graph.walls.map((wall) => wall.centerline)) >= MITCHELL_DEWITT_FIRST_FLOOR.minFootprintComplexity, "Irregular benchmark footprint must not collapse to a rectangle");

graph.rooms.push({
  id: "room-garage", levelId: "level-1", type: "room", name: "2-Car Garage",
  polygon: { points: [{ x: -5, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 7 }, { x: -5, y: 7 }] },
  confidence: 0.9, sourcePage: 2, evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "benchmark-fixture", algorithmVersion: "1", evidenceIds: [] },
});
graph.decksPorches.push({
  id: "deck-1", levelId: "level-1", type: "deck",
  polygon: { points: [{ x: 5, y: 14 }, { x: 11, y: 14 }, { x: 11, y: 17 }, { x: 5, y: 17 }] },
  thickness: 0.15, elevation: 0, confidence: 0.9, sourcePage: 2, evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "benchmark-fixture", algorithmVersion: "1", evidenceIds: [] },
});
graph.stairs.push({
  id: "stair-1", levelId: "level-1", type: "stair",
  polygon: { points: [{ x: 6, y: 5 }, { x: 8, y: 5 }, { x: 8, y: 8 }, { x: 6, y: 8 }] },
  direction: "up", confidence: 0.85, sourcePage: 2, evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "benchmark-fixture", algorithmVersion: "1", evidenceIds: [] },
});
const validated = applyBosValidation(graph);
const benchmark = runBuildingGraphBenchmark(validated, MITCHELL_DEWITT_FIRST_FLOOR);
assert(benchmark.passed, `Benchmark fixture must pass: ${JSON.stringify(benchmark)}`);

const rectangle = createEmptyBosBuildingGraph({ buildingId: "bad", sourcePage: 2, sourceSheetTitle: "FIRST FLOOR PLAN" });
rectangle.scale = scale;
rectangle.walls = [
  [0, 0, 10, 0], [10, 0, 10, 10], [10, 10, 0, 10], [0, 10, 0, 0],
].map(([x1, y1, x2, y2], index): BosWall => ({
  id: `rectangle-${index}`,
  levelId: "level-1",
  type: "exterior",
  centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
  thickness: 0.15,
  height: 2.44,
  confidence: 0.99,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "bad-fixture", algorithmVersion: "1", evidenceIds: [] },
}));
const rejected = runBuildingGraphBenchmark(applyBosValidation(rectangle), MITCHELL_DEWITT_FIRST_FLOOR);
assert.equal(rejected.passed, false, "Mitchell Dewitt must permanently reject a four-wall rectangle reconstruction");
assert.equal(rejected.checks.footprintNotRectangle, false, "Rectangle simplification must be an explicit benchmark failure");

console.log("B.O.S. Native Blueprint Engine foundation contract: PASS");
