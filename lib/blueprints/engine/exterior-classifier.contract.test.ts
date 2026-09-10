import assert from "node:assert/strict";
import type { BosRoom, BosWall } from "./building-graph";
import { classifyExteriorWalls } from "./exterior-classifier";

function wall(id: string, x1: number, y1: number, x2: number, y2: number): BosWall {
  return {
    id,
    levelId: "level-1",
    type: "unknown",
    centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thickness: 0.15,
    height: 2.44,
    confidence: 0.95,
    sourcePage: 2,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  };
}

function room(id: string, points: Array<{ x: number; y: number }>): BosRoom {
  return {
    id,
    levelId: "level-1",
    type: "room",
    polygon: { points },
    confidence: 0.9,
    sourcePage: 2,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  };
}

const walls = [
  wall("bottom", 0, 0, 10, 0),
  wall("right-lower", 10, 0, 10, 4),
  wall("recess-bottom", 10, 4, 7, 4),
  wall("recess-return", 7, 4, 7, 7),
  wall("right-upper", 7, 7, 10, 7),
  wall("top", 10, 7, 10, 10),
  wall("top-left", 10, 10, 0, 10),
  wall("left", 0, 10, 0, 0),
  wall("divider", 5, 0, 5, 10),
];

const rooms = [
  room("left-room", [{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 5, y: 10 }, { x: 0, y: 10 }]),
  room("right-lower-room", [{ x: 5, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 7, y: 4 }, { x: 7, y: 7 }, { x: 5, y: 7 }]),
  room("right-upper-room", [{ x: 5, y: 7 }, { x: 7, y: 7 }, { x: 10, y: 7 }, { x: 10, y: 10 }, { x: 5, y: 10 }]),
];

const classified = classifyExteriorWalls(walls, rooms);
const byId = new Map(classified.map((item) => [item.id, item.type]));
assert.equal(byId.get("recess-bottom"), "exterior", "recessed perimeter segment is exterior even away from the global envelope");
assert.equal(byId.get("recess-return"), "exterior", "stepped return is exterior from one-sided room adjacency");
assert.equal(byId.get("divider"), "interior", "wall with occupied rooms on both sides remains interior");
assert.equal(byId.get("left"), "exterior", "global envelope fallback still protects obvious perimeter walls");

console.log("Exterior classifier contract: passed");
