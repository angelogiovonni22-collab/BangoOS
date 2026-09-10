import assert from "node:assert/strict";
import {
  repairDetectedWallJunctions,
  suppressRepetitiveRasterWallArtifacts,
} from "./wall-detector";
import type { BosRawSegment } from "./geometry";

function rasterWall(x: number, thickness = 0.27432): BosRawSegment {
  return {
    start: { x, y: 10 },
    end: { x, y: 11.35 },
    sourcePage: 2,
    sourceObjectId: `raster-v-${Math.round(x * 100)}-1+raster-v-${Math.round(x * 100)}-2`,
    strokeWidth: thickness,
    confidence: 0.91,
  };
}

const stairLikeFamily = [
  rasterWall(20.0),
  rasterWall(20.24),
  rasterWall(20.48),
  rasterWall(20.72),
  rasterWall(20.96),
];
const trueLongWall: BosRawSegment = {
  start: { x: 18, y: 9.5 },
  end: { x: 18, y: 15.5 },
  sourcePage: 2,
  sourceObjectId: "raster-v-true-a+raster-v-true-b",
  strokeWidth: 0.1524,
  confidence: 0.97,
};
const retained = suppressRepetitiveRasterWallArtifacts([...stairLikeFamily, trueLongWall]);
assert.equal(retained.includes(trueLongWall), true, "long structural wall remains available");
assert.equal(retained.filter((item) => stairLikeFamily.includes(item)).length, 0, "dense thick raster tread family is suppressed");

const nearlyJoined: BosRawSegment[] = [
  {
    start: { x: 0, y: 0 },
    end: { x: 4.86, y: 0 },
    sourcePage: 2,
    sourceObjectId: "vector-horizontal",
    strokeWidth: 0.15,
    confidence: 0.95,
  },
  {
    start: { x: 5, y: -2 },
    end: { x: 5, y: 2 },
    sourcePage: 2,
    sourceObjectId: "vector-vertical",
    strokeWidth: 0.15,
    confidence: 0.95,
  },
];
const repaired = repairDetectedWallJunctions(nearlyJoined, 0.18);
assert.equal(repaired[0].end.x, 5, "near-miss endpoint is extended to the finite perpendicular wall");
assert.equal(repaired[0].end.y, 0, "junction repair preserves the perpendicular projection");
assert.deepEqual(repaired[1], nearlyJoined[1], "target wall remains geometrically stable");

const unrelatedParallel: BosRawSegment[] = [
  {
    start: { x: 0, y: 0 },
    end: { x: 2, y: 0 },
    sourcePage: 2,
    sourceObjectId: "vector-a",
    strokeWidth: 0.15,
  },
  {
    start: { x: 0, y: 0.15 },
    end: { x: 2, y: 0.15 },
    sourcePage: 2,
    sourceObjectId: "vector-b",
    strokeWidth: 0.15,
  },
];
assert.deepEqual(repairDetectedWallJunctions(unrelatedParallel, 0.18), unrelatedParallel, "parallel walls are never bridged by topology repair");

console.log("Mitchell topology accuracy contract: passed");
