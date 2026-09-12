import assert from "node:assert/strict";
import { dominantRasterWallCluster } from "./reconstruct";
import type { BosRawSegment } from "./geometry";

function segment(id: string, x1: number, y1: number, x2: number, y2: number): BosRawSegment {
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    sourcePage: 1,
    sourceObjectId: id,
    confidence: 0.95,
  };
}

// Main body: eight structural runs with mid-run splits, matching what raster wall detection
// commonly produces around corners/openings.
const main: BosRawSegment[] = [
  segment("main-top-a", 0, 0, 3, 0),
  segment("main-top-b", 3, 0, 6, 0),
  segment("main-right-a", 6, 0, 6, 2),
  segment("main-right-b", 6, 2, 6, 4),
  segment("main-bottom-a", 6, 4, 3, 4),
  segment("main-bottom-b", 3, 4, 0, 4),
  segment("main-left-a", 0, 4, 0, 2),
  segment("main-left-b", 0, 2, 0, 0),
];

// A legitimate attached suite/wing separated by a 3-foot cased opening. Structural selection
// must retain it without inventing or snapping any geometry across the opening.
const nearbyWing: BosRawSegment[] = [
  segment("wing-top", 6.9, 1, 10.9, 1),
  segment("wing-right", 10.9, 1, 10.9, 4),
  segment("wing-bottom", 10.9, 4, 6.9, 4),
  segment("wing-left", 6.9, 4, 6.9, 2.2),
];

// Distant title-block-like paired linework must still be rejected.
const distantNoise: BosRawSegment[] = [
  segment("noise-top", 20, 15, 23, 15),
  segment("noise-right", 23, 15, 23, 18),
  segment("noise-bottom", 23, 18, 20, 18),
  segment("noise-left", 20, 18, 20, 15),
];

const selected = dominantRasterWallCluster([...main, ...nearbyWing, ...distantNoise]);
assert.equal(selected.length, 12, "Nearby building wings separated by normal openings must remain in the structural raster region");
assert(selected.some((item) => item.sourceObjectId === "wing-right"), "The nearby wing must not be discarded as a detached component");
assert(!selected.some((item) => item.sourceObjectId?.startsWith("noise-")), "Distant title-block/noise components must remain excluded");
assert.deepEqual(selected.find((item) => item.sourceObjectId === "wing-top")?.start, { x: 6.9, y: 1 }, "Structural clustering must select only; it must never bridge or move geometry");

console.log("B.O.S. raster structural connected-wing regression: PASS");
