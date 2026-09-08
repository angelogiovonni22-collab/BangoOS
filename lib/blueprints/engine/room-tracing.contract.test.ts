import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { pointInBosPolygon, traceWallBoundedRooms } from "./room-tracing";

function wallFixture(
  graphId: string,
  segments: readonly (readonly [number, number, number, number])[],
) {
  const graph = createEmptyBosBuildingGraph({ buildingId: graphId, sourcePage: 1, levelName: "First Floor" });
  graph.walls = segments.map(([x1, y1, x2, y2], index): BosWall => ({
    id: `${graphId}-wall-${index + 1}`,
    levelId: "level-1",
    type: index < 4 ? "exterior" : "interior",
    centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thickness: 0.15,
    height: 2.44,
    confidence: 0.9,
    sourcePage: 1,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  }));
  return graph;
}

// Keep each exterior edge as one unsplit run. The partition terminates into the middle of the
// top and bottom runs, matching a common PDF-vector topology that must be recovered before faces
// can be traced.
const graph = wallFixture("room-test", [
  [0, 0, 8, 0],
  [8, 0, 8, 5],
  [8, 5, 0, 5],
  [0, 5, 0, 0],
  [4, 0, 4, 5],
]);

const rooms = traceWallBoundedRooms(graph);
assert.equal(rooms.length, 2, "A rectangle divided by a partition terminating into unsplit exterior runs must trace two bounded room faces");
assert(rooms.every((room) => room.polygon.points.length >= 4), "Traced rooms must contain usable polygons");
assert(rooms.some((room) => pointInBosPolygon({ x: 2, y: 2 }, room.polygon)), "Left room must contain its interior point");
assert(rooms.some((room) => pointInBosPolygon({ x: 6, y: 2 }, room.polygon)), "Right room must contain its interior point");
assert(rooms.every((room) => room.provenance.createdBy === "deterministic"), "Room tracing must preserve deterministic provenance");
assert(rooms.every((room) => room.provenance.algorithmVersion === "1.2.0"), "Near-miss-aware room tracing must report the current algorithm version");

// Vector extraction often leaves a small endpoint gap even when two walls visually meet. A gap
// inside the configured 12 cm snap tolerance must still close the junction and preserve both rooms.
const nearMissGraph = wallFixture("near-miss-room-test", [
  [0, 0, 8, 0],
  [8, 0, 8, 5],
  [8, 5, 0, 5],
  [0, 5, 0, 0],
  [4, 0.08, 4, 4.92],
]);
const nearMissRooms = traceWallBoundedRooms(nearMissGraph);
assert.equal(nearMissRooms.length, 2, "Partition endpoints within snap tolerance must bridge to adjacent wall runs and preserve bounded rooms");
assert(nearMissRooms.some((room) => pointInBosPolygon({ x: 2, y: 2 }, room.polygon)), "Near-miss recovery must preserve the left bounded room");
assert(nearMissRooms.some((room) => pointInBosPolygon({ x: 6, y: 2 }, room.polygon)), "Near-miss recovery must preserve the right bounded room");

// Do not bridge a visibly separate wall when the endpoint gap is outside the configured tolerance.
const separatedGraph = wallFixture("separated-room-test", [
  [0, 0, 8, 0],
  [8, 0, 8, 5],
  [8, 5, 0, 5],
  [0, 5, 0, 0],
  [4, 0.2, 4, 4.8],
]);
const separatedRooms = traceWallBoundedRooms(separatedGraph);
assert.equal(separatedRooms.length, 1, "Endpoint gaps outside snap tolerance must not be silently bridged into false room topology");

console.log("B.O.S. wall-bounded room tracing contract: PASS");