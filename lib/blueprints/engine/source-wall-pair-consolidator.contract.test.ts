import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import { consolidateSourceWallPairs } from "./source-wall-pair-consolidator";

const scale = 100;
function pair(id: string, fixedMeters: number, startMeters: number, endMeters: number, separationMeters: number): BosSourceWallFacePair {
  return {
    id,
    orientation: "horizontal",
    faceAFixedPixel: Math.round((fixedMeters - separationMeters / 2) * scale),
    faceBFixedPixel: Math.round((fixedMeters + separationMeters / 2) * scale),
    centerFixedPixel: fixedMeters * scale,
    startPixel: startMeters * scale,
    endPixel: endMeters * scale,
    lengthMeters: endMeters - startMeters,
    separationMeters,
  };
}

const duplicates = [
  pair("same-wall-a", 5.00, 2.0, 10.0, 0.20),
  pair("same-wall-b", 5.02, 2.1, 9.9, 0.22),
  pair("same-wall-c", 4.98, 2.0, 10.0, 0.19),
];
const separateParallelWall = pair("separate-wall", 5.30, 2.0, 10.0, 0.20);
const adjacentFragment = pair("adjacent-fragment", 5.01, 10.2, 14.0, 0.20);

const result = consolidateSourceWallPairs({
  wallFacePairs: [...duplicates, separateParallelWall, adjacentFragment],
  sourcePixelWidth: 2000,
  sourcePixelHeight: 2000,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
const retained = new Set(result.wallFacePairs.map((item) => item.id));
assert.equal(result.wallFacePairs.length, 3, "three near-identical raster-row pairs must collapse to one while distinct walls/fragments survive");
assert(retained.has("separate-wall"), "a physically separate parallel wall must not be merged by duplicate consolidation");
assert(retained.has("adjacent-fragment"), "a non-overlapping continuation fragment must survive consolidation");
assert(duplicates.some((item) => retained.has(item.id)), "one original source pair must represent the duplicate evidence cluster");
assert.equal(result.rejectedDuplicatePairIds.length, 2, "only redundant members of the duplicate cluster should be rejected");
assert(result.diagnostics.some((item) => item.includes("without moving or synthesizing source geometry")), "diagnostics must make evidence-preserving consolidation explicit");
console.log("Blueprint source wall pair consolidator contract passed.");
