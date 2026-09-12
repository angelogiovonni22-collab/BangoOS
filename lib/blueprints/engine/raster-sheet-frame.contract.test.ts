import assert from "node:assert/strict";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { excludeRasterSheetFrameSystems } from "./raster-sheet-frame";

function wall(id: string, x1: number, y1: number, x2: number, y2: number): BosWallSystemCandidate {
  const centerline = { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
  const length = Math.hypot(x2 - x1, y2 - y1);
  let orientationRadians = Math.atan2(y2 - y1, x2 - x1);
  while (orientationRadians < 0) orientationRadians += Math.PI;
  while (orientationRadians >= Math.PI) orientationRadians -= Math.PI;
  const face = (suffix: string) => ({ id: `${id}-${suffix}`, primitiveId: `${id}-${suffix}`, sourcePage: 1, line: centerline, confidence: 0.9 });
  return { id, sourcePage: 1, centerline, thickness: 0.15, length, orientationRadians, faceA: face("a"), faceB: face("b"), overlapRatio: 1, confidence: 0.9 };
}

const pageWidth = 40;
const pageHeight = 30;
const topFrame = wall("top-frame", 1, 0.7, 39, 0.7);
const rightFrame = wall("right-frame", 38.5, 1, 38.5, 29);
const centralLongWall = wall("central-long-wall", 4, 15, 36, 15);
const nearEdgeShortExterior = wall("near-edge-short-exterior", 1, 1.5, 15, 1.5);
const interiorPartition = wall("interior-partition", 20, 7, 20, 23);

const result = excludeRasterSheetFrameSystems(
  [topFrame, rightFrame, centralLongWall, nearEdgeShortExterior, interiorPartition],
  pageWidth,
  pageHeight,
);
const kept = new Set(result.wallSystems.map((item) => item.id));

assert(!kept.has(topFrame.id), "majority-width horizontal line near sheet edge must be rejected as drawing frame");
assert(!kept.has(rightFrame.id), "majority-height vertical line near sheet edge must be rejected as drawing frame");
assert(kept.has(centralLongWall.id), "long central architectural wall must not be rejected merely because it spans much of the page");
assert(kept.has(nearEdgeShortExterior.id), "ordinary exterior wall near a sheet edge must survive when it does not span most of the page");
assert(kept.has(interiorPartition.id), "interior partitions must survive sheet-frame exclusion");
assert.equal(result.rejectedSystemIds.length, 2, "only the two deliberate sheet-frame systems should be rejected");

console.log("Blueprint raster sheet frame exclusion contract passed.");
