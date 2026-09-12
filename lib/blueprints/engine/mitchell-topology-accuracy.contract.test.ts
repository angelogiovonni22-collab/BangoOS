import assert from "node:assert/strict";
import {
  repairDetectedWallJunctions,
  suppressRepetitiveRasterWallArtifacts,
  suppressUnsupportedShortRasterFragments,
} from "./wall-detector";
import type { BosRawSegment } from "./geometry";

function rasterWall(x: number, thickness = 0.27432): BosRawSegment {
  return {
    start: { x, y: 10 },
    end: { x, y: 11.35 },
    sourcePage: 1,
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
  sourcePage: 1,
  sourceObjectId: "raster-v-true-a+raster-v-true-b",
  strokeWidth: 0.1524,
  confidence: 0.97,
};
const retained = suppressRepetitiveRasterWallArtifacts([...stairLikeFamily, trueLongWall]);
assert.equal(retained.includes(trueLongWall), true, "long structural wall remains available");
assert.equal(retained.filter((item) => stairLikeFamily.includes(item)).length, 0, "dense raster tread/fixture family is suppressed across normal wall-like thicknesses");

const anchor: BosRawSegment = {
  start: { x: 0, y: 0 },
  end: { x: 6, y: 0 },
  sourcePage: 1,
  sourceObjectId: "raster-h-anchor-a+raster-h-anchor-b",
  strokeWidth: 0.1524,
  confidence: 0.97,
};
const supportedShortReturn: BosRawSegment = {
  start: { x: 2, y: 0.1 },
  end: { x: 2, y: 0.8 },
  sourcePage: 1,
  sourceObjectId: "raster-v-return-a+raster-v-return-b",
  strokeWidth: 0.1524,
  confidence: 0.92,
};
const floatingFixtureFragment: BosRawSegment = {
  start: { x: 9, y: 9 },
  end: { x: 9.6, y: 9 },
  sourcePage: 1,
  sourceObjectId: "raster-h-fixture-a+raster-h-fixture-b",
  strokeWidth: 0.11,
  confidence: 0.88,
};
const shortFiltered = suppressUnsupportedShortRasterFragments([anchor, supportedShortReturn, floatingFixtureFragment]);
assert(shortFiltered.includes(anchor), "long structural anchor remains available");
assert(shortFiltered.includes(supportedShortReturn), "short wall return touching a structural run is preserved");
assert(!shortFiltered.includes(floatingFixtureFragment), "floating sub-780 mm raster fragment is withheld from structural topology");

const nearlyJoined: BosRawSegment[] = [
  {
    start: { x: 0, y: 0 },
    end: { x: 4.86, y: 0 },
    sourcePage: 1,
    sourceObjectId: "vector-horizontal",
    strokeWidth: 0.15,
    confidence: 0.95,
  },
  {
    start: { x: 5, y: -2 },
    end: { x: 5, y: 2 },
    sourcePage: 1,
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
    sourcePage: 1,
    sourceObjectId: "vector-a",
    strokeWidth: 0.15,
  },
  {
    start: { x: 0, y: 0.15 },
    end: { x: 2, y: 0.15 },
    sourcePage: 1,
    sourceObjectId: "vector-b",
    strokeWidth: 0.15,
  },
];
assert.deepEqual(repairDetectedWallJunctions(unrelatedParallel, 0.18), unrelatedParallel, "parallel walls are never bridged by topology repair");

console.log("Mitchell A4 topology accuracy contract: passed");
