import assert from "node:assert/strict";
import "./multi-floor-orchestration.contract.test";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { MITCHELL_DEWITT_FIRST_FLOOR, runBuildingGraphBenchmark } from "./benchmarks";
import { parseArchitecturalLength, parsePrintedScale } from "./dimensions";
import { associateDimensionsToWalls } from "./dimension-solver";
import { footprintComplexity, mergeCollinearSegments, topologyMetrics, type BosRawSegment } from "./geometry";
import { buildBosBuildingGraphIfc } from "./graph-to-ifc";
import { detectWallGapOpenings } from "./openings";
import { selectTargetPage, type BosParsedPage } from "./plan-parser";
import {
  latestPersistedManualScale,
  replayPersistedBosGraphCorrections,
  type PersistedBosGraphCorrectionRow,
} from "./persisted-corrections";
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
const junctionTopology = topologyMetrics([
  { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
  { start: { x: 2, y: -2 }, end: { x: 2, y: 0.06 } },
]);
assert(junctionTopology.junctions >= 1, "Topology metrics must recognize T-junctions and near-miss endpoints instead of counting both wall runs as disconnected");
const separatedTopology = topologyMetrics([
  { start: { x: 0, y: 0 }, end: { x: 4, y: 0 } },
  { start: { x: 2, y: -2 }, end: { x: 2, y: -0.3 } },
]);
assert.equal(separatedTopology.junctions, 0, "Topology metrics must not bridge wall endpoints beyond junction tolerance");

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

const openingWalls: BosWall[] = [
  { ...graph.walls[0], id: "opening-a", centerline: { start: { x: 0, y: 0 }, end: { x: 2, y: 0 } } },
  { ...graph.walls[0], id: "opening-b", centerline: { start: { x: 2.9, y: 0 }, end: { x: 5, y: 0 } } },
];
const detectedOpenings = detectWallGapOpenings(openingWalls);
assert.equal(detectedOpenings.doors.length, 1, "A door-sized wall gap should become a deterministic door opening");
assert.equal(detectedOpenings.doors[0].wallId, "opening-b", "Detected opening must remain associated with one source wall");

graph.dimensions.push({
  id: "dimension-wall-1",
  levelId: "level-1",
  page: 2,
  start: { x: 0, y: -0.4 },
  end: { x: 12, y: -0.4 },
  value: 12,
  unit: "m",
  confidence: 0.95,
  evidence: [],
});
assert(associateDimensionsToWalls(graph).some((item) => item.wallId === "wall-1"), "Dimension solver must associate a parallel dimension to the matching wall");

const ifc = buildBosBuildingGraphIfc(validated);
assert(ifc.startsWith("ISO-10303-21;"), "IFC export must emit a STEP header");
assert(ifc.includes("IFCWALLSTANDARDCASE") && ifc.includes("FILE_SCHEMA(('IFC4'))"), "IFC export must contain IFC4 wall entities");

const persistedRows: PersistedBosGraphCorrectionRow[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    correction_type: "set_scale",
    payload: { type: "set_scale", drawingUnitsPerMeter: 144, createdAt: "2026-09-08T09:00:00.000Z" },
    created_by: "user-1",
    created_at: "2026-09-08T09:00:00.000Z",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    correction_type: "classify_wall",
    payload: { type: "classify_wall", wallId: "wall-1", wallType: "interior", createdAt: "2026-09-08T09:01:00.000Z" },
    created_by: "user-1",
    created_at: "2026-09-08T09:01:00.000Z",
  },
];
assert.equal(latestPersistedManualScale(persistedRows), 144, "Latest persisted set_scale correction must be available before native geometry conversion");
const persistedReplay = replayPersistedBosGraphCorrections(validated, persistedRows);
assert.equal(persistedReplay.graph.scale.source, "manual", "Persisted manual scale must survive correction replay");
assert.equal(persistedReplay.graph.walls.find((wall) => wall.id === "wall-1")?.type, "interior", "Persisted wall classification must replay after regeneration");
assert.equal(persistedReplay.graph.walls.find((wall) => wall.id === "wall-1")?.provenance.createdBy, "manual", "Replayed corrections must retain human provenance");
assert.equal(persistedReplay.conflicts.length, 0, "Matching persisted corrections must replay without conflicts");

const conflictReplay = replayPersistedBosGraphCorrections(validated, [{
  id: "00000000-0000-0000-0000-000000000003",
  correction_type: "move_wall",
  payload: { type: "move_wall", wallId: "missing-wall", start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, createdAt: "2026-09-08T09:02:00.000Z" },
  created_by: "user-1",
  created_at: "2026-09-08T09:02:00.000Z",
}]);
assert.equal(conflictReplay.conflicts.length, 1, "Unmatched persisted corrections must surface a conflict instead of being silently dropped");
assert.equal(conflictReplay.graph.validation.status, "needs_review", "Correction conflicts must prevent a regenerated graph from being presented as reconstructed");
assert(conflictReplay.graph.validation.issues.some((issue) => issue.code === "CORRECTION_CONFLICT"), "Correction conflict must be visible in validation issues");

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