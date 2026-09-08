import assert from "node:assert/strict";
import { createEmptyBosBuildingGraph, type BosWall } from "./building-graph";
import { recognizeArchitecturalSemantics, type ScaledTextToken } from "./architecture";

function wall(id: string, x1: number, y1: number, x2: number, y2: number): BosWall {
  return {
    id,
    levelId: "level-1",
    type: "exterior",
    centerline: { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } },
    thickness: 0.15,
    height: 2.44,
    confidence: 0.9,
    sourcePage: 2,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  };
}

function token(text: string, xMeters: number, yMeters: number): ScaledTextToken {
  return { text, page: 2, xMeters, yMeters, widthMeters: 0.2, heightMeters: 0.1 };
}

const bounded = createEmptyBosBuildingGraph({ buildingId: "slab-foundation-fixture", sourcePage: 2 });
bounded.walls = [
  wall("w1", 0, 0, 6, 0),
  wall("w2", 6, 0, 6, 5),
  wall("w3", 6, 5, 0, 5),
  wall("w4", 0, 5, 0, 0),
];
bounded.rooms = [{
  id: "room-1",
  levelId: "level-1",
  type: "room",
  polygon: { points: [{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 5 }, { x: 0, y: 5 }] },
  confidence: 0.9,
  sourcePage: 2,
  evidence: [],
  provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
}];

const foundation = recognizeArchitecturalSemantics(bounded, [token("FOUNDATION", 2.9, 2.4)]);
assert.equal(foundation.slabs.length, 1, "An explicit foundation label inside a bounded room should create one foundation surface");
assert.equal(foundation.slabs[0].type, "foundation");
assert.deepEqual(foundation.slabs[0].polygon, bounded.rooms[0].polygon, "Foundation recognition should reuse the verified bounded room polygon instead of inventing a footprint");
assert(foundation.slabs[0].confidence >= 0.8, "A foundation label inside a verified room should carry strong deterministic confidence");
assert.equal(foundation.slabs[0].provenance.algorithm, "bos-plan-label-semantics");

const slab = recognizeArchitecturalSemantics(bounded, [token("CONCRETE SLAB", 3.1, 2.4)]);
assert.equal(slab.slabs.length, 1, "An explicit concrete slab label should create one floor slab");
assert.equal(slab.slabs[0].type, "floor");
assert.deepEqual(slab.slabs[0].polygon, bounded.rooms[0].polygon, "Slab recognition should prefer the containing bounded room polygon");

const unbounded = createEmptyBosBuildingGraph({ buildingId: "unbounded", sourcePage: 2 });
const ignored = recognizeArchitecturalSemantics(unbounded, [
  token("FOUNDATION NOTES", 40, 40),
  token("BASEMENT", 40, 41),
]);
assert.equal(ignored.slabs.length, 0, "Notes headings and generic basement text without bounded geometry must not invent slab/foundation surfaces");

console.log("B.O.S. slab/foundation semantic contract: PASS");