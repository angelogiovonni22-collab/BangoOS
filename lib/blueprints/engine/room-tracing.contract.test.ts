import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { pointInBosPolygon, traceWallBoundedRooms } from "./room-tracing";

const graph = createEmptyBosBuildingGraph({ buildingId: "room-test", sourcePage: 1, levelName: "First Floor" });
const segments = [
  [0, 0, 4, 0],
  [4, 0, 8, 0],
  [8, 0, 8, 5],
  [8, 5, 4, 5],
  [4, 5, 0, 5],
  [0, 5, 0, 0],
  [4, 0, 4, 5],
] as const;
graph.walls = segments.map(([x1, y1, x2, y2], index): BosWall => ({
  id: `room-wall-${index + 1}`,
  levelId: "level-1",
  type: index < 6 ? "exterior" : "interior",
  centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
  thickness: 0.15,
  height: 2.44,
  confidence: 0.9,
  sourcePage: 1,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
}));

const rooms = traceWallBoundedRooms(graph);
assert.equal(rooms.length, 2, "A closed rectangle divided by one full partition must trace two bounded room faces");
assert(rooms.every((room) => room.polygon.points.length >= 4), "Traced rooms must contain usable polygons");
assert(rooms.some((room) => pointInBosPolygon({ x: 2, y: 2 }, room.polygon)), "Left room must contain its interior point");
assert(rooms.some((room) => pointInBosPolygon({ x: 6, y: 2 }, room.polygon)), "Right room must contain its interior point");
assert(rooms.every((room) => room.provenance.createdBy === "deterministic"), "Room tracing must preserve deterministic provenance");

console.log("B.O.S. wall-bounded room tracing contract: PASS");