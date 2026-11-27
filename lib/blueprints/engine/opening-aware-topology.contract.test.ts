import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { buildOpeningTopologyClosures } from "./opening-topology";
import { traceWallBoundedRooms } from "./room-tracing";
import { validateBosBuildingGraph } from "./validation";

function wall(id: string, start: { x: number; y: number }, end: { x: number; y: number }, type: BosWall["type"] = "interior"): BosWall {
  return {
    id,
    levelId: "level-1",
    type,
    centerline: { start, end },
    thickness: 0.12,
    height: 2.44,
    confidence: 0.95,
    sourcePage: 1,
    evidence: [],
    provenance: {
      createdBy: "deterministic",
      algorithm: "fixture",
      algorithmVersion: "1",
      evidenceIds: [],
    },
  };
}

const base = createEmptyBosBuildingGraph({ buildingId: "opening-topology-fixture", sourcePage: 1 });
base.scale = { source: "printed", drawingUnitsPerMeter: 100, confidence: 0.98 };
base.walls = [
  wall("bottom-left", { x: 0, y: 0 }, { x: 2.05, y: 0 }),
  wall("bottom-right", { x: 2.95, y: 0 }, { x: 5, y: 0 }),
  wall("right", { x: 5, y: 0 }, { x: 5, y: 4 }),
  wall("top", { x: 5, y: 4 }, { x: 0, y: 4 }),
  wall("left", { x: 0, y: 4 }, { x: 0, y: 0 }),
];

assert.equal(traceWallBoundedRooms(base).length, 0, "An unexplained wall gap must not be silently bridged into a room");

base.openings = [{
  id: "door-gap",
  levelId: "level-1",
  type: "door",
  wallId: "bottom-left",
  offset: 2.5,
  width: 0.9,
  height: 2.03,
  sillHeight: 0,
  confidence: 0.62,
  sourcePage: 1,
  evidence: [{ id: "door-gap-evidence", page: 1, kind: "derived", score: 0.62 }],
  provenance: {
    createdBy: "deterministic",
    algorithm: "bos-wall-gap-openings",
    algorithmVersion: "1.1.0",
    evidenceIds: ["door-gap-evidence"],
  },
}];
base.doors = [{ ...base.openings[0], type: "door", swing: "unknown" }];

const closures = buildOpeningTopologyClosures(base);
assert.equal(closures.length, 1, "A verified door gap should create exactly one virtual topology closure");
assert.deepEqual(closures[0].centerline, { start: { x: 2.05, y: 0 }, end: { x: 2.95, y: 0 } }, "The closure must use the exact recognized gap endpoints rather than inventing new geometry");

const rooms = traceWallBoundedRooms(base);
assert.equal(rooms.length, 1, "Room tracing should close a face across a verified door opening without persisting a physical wall");
assert.equal(base.walls.length, 5, "Opening-aware room tracing must not mutate canonical wall geometry");

const validation = validateBosBuildingGraph(base, {
  reconstructedScore: 0,
  reviewScore: 0,
  minExteriorWalls: 0,
  minTotalWalls: 1,
  minScaleConfidence: 0,
  minClosure: 0.7,
});
assert.ok(validation.metrics.wallTopology >= 0.99, `Verified opening closure should restore topology, got ${validation.metrics.wallTopology}`);
assert.ok(!validation.issues.some((item) => item.code === "OPEN_TOPOLOGY"), "A verified architectural opening must not be counted as an unexplained dangling topology defect");

console.log("opening-aware topology contract passed");
