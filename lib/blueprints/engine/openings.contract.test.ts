import assert from "node:assert/strict";
import type { BosWall } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { detectWallGapOpenings } from "./openings";

function wall(id: string, x1: number, x2: number): BosWall {
  return {
    id,
    levelId: "level-1",
    type: "exterior",
    centerline: { start: { x: x1, y: 0 }, end: { x: x2, y: 0 } },
    thickness: 0.15,
    height: 2.44,
    confidence: 0.94,
    sourcePage: 2,
    evidence: [],
    provenance: { createdBy: "deterministic", algorithm: "fixture", algorithmVersion: "1", evidenceIds: [] },
  };
}

const doorWalls = [wall("door-wall-left", 0, 2), wall("door-wall-right", 2.9, 5.2)];
const doorLeaf: BosRawSegment = {
  sourcePage: 2,
  sourceObjectId: "door-leaf-left-hinge",
  start: { x: 2, y: 0 },
  end: { x: 2.7, y: 0.55 },
  confidence: 0.96,
};
const recognizedDoor = detectWallGapOpenings(doorWalls, { symbolSegments: [doorLeaf] });
assert.equal(recognizedDoor.doors.length, 1, "Door-sized wall gaps must remain deterministic doors when symbol evidence is supplied");
assert.equal(recognizedDoor.doors[0].swing, "left", "A leaf anchored to the leading gap endpoint must resolve a deterministic left hinge/swing classification");
assert(recognizedDoor.doors[0].evidence.some((item) => item.kind === "pdf_vector" && item.sourceObjectId === "door-leaf-left-hinge"), "Recognized door symbols must retain vector evidence provenance");
assert(recognizedDoor.doors[0].confidence > 0.62, "Recognized door symbols must raise confidence above gap-only classification");

const doubleDoorLeaves: BosRawSegment[] = [
  { sourcePage: 2, sourceObjectId: "double-left", start: { x: 2, y: 0 }, end: { x: 2.42, y: 0.55 }, confidence: 0.95 },
  { sourcePage: 2, sourceObjectId: "double-right", start: { x: 2.9, y: 0 }, end: { x: 2.48, y: 0.55 }, confidence: 0.95 },
];
const recognizedDoubleDoor = detectWallGapOpenings(doorWalls, { symbolSegments: doubleDoorLeaves });
assert.equal(recognizedDoubleDoor.doors[0].swing, "double", "Opposing anchored door leaves must resolve a double-door symbol");

const windowWalls = [wall("window-wall-left", 0, 2), wall("window-wall-right", 3.8, 6)];
const windowLines: BosRawSegment[] = [
  { sourcePage: 2, sourceObjectId: "window-line-a", start: { x: 2.15, y: 0.06 }, end: { x: 3.65, y: 0.06 }, confidence: 0.95 },
  { sourcePage: 2, sourceObjectId: "window-line-b", start: { x: 2.15, y: -0.06 }, end: { x: 3.65, y: -0.06 }, confidence: 0.95 },
];
const recognizedWindow = detectWallGapOpenings(windowWalls, { symbolSegments: windowLines });
assert.equal(recognizedWindow.windows.length, 1, "Window-sized wall gaps must remain deterministic windows when symbol evidence is supplied");
assert.equal(recognizedWindow.windows[0].style, "double-line", "Two parallel vectors spanning a window gap must resolve a double-line window symbol");
assert.equal(recognizedWindow.windows[0].evidence.filter((item) => item.kind === "pdf_vector").length, 2, "Window symbol recognition must retain both supporting vector lines");

const unrelatedSymbol: BosRawSegment = {
  sourcePage: 2,
  sourceObjectId: "unrelated",
  start: { x: 20, y: 20 },
  end: { x: 20.8, y: 20.6 },
  confidence: 0.99,
};
const safeFallback = detectWallGapOpenings(doorWalls, { symbolSegments: [unrelatedSymbol] });
assert.equal(safeFallback.doors[0].swing, "unknown", "Unrelated vector linework must not invent a door swing classification");
assert.equal(safeFallback.doors[0].provenance.algorithm, "bos-wall-gap-openings", "Unrecognized symbol linework must preserve gap-only provenance");

console.log("B.O.S. opening symbol recognition contract: PASS");
