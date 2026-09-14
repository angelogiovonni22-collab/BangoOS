import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import { selectSourceWallNetwork } from "./source-wall-network-selector";

const pxPerMeter = 10;
function pair(id: string, orientation: "horizontal" | "vertical", fixedMeters: number, startMeters: number, endMeters: number, separationMeters = 0.2): BosSourceWallFacePair {
  const fixed = fixedMeters * pxPerMeter;
  const separationPixels = separationMeters * pxPerMeter;
  return { id, orientation, faceAFixedPixel: fixed - separationPixels / 2, faceBFixedPixel: fixed + separationPixels / 2, centerFixedPixel: fixed, startPixel: startMeters * pxPerMeter, endPixel: endMeters * pxPerMeter, lengthMeters: endMeters - startMeters, separationMeters };
}
const building = [pair("top-left","horizontal",2,2,5),pair("top-right","horizontal",2,6,10),pair("bottom","horizontal",8,2,10),pair("left","vertical",2,2,8),pair("right","vertical",10,2,8),pair("middle","vertical",6,2,8)];
const hatch = [pair("hatch-1","horizontal",14,13,14),pair("hatch-2","horizontal",14.3,13,14),pair("hatch-3","horizontal",14.6,13,14),pair("hatch-4","horizontal",14.9,13,14),pair("hatch-5","horizontal",15.2,13,14)];
const isolated=pair("isolated","vertical",17,15,17);
const selection=selectSourceWallNetwork({wallFacePairs:[...building,...hatch,isolated],sourcePixelWidth:200,sourcePixelHeight:200,sourceWidthMeters:20,sourceHeightMeters:20});
const retained=new Set(selection.wallFacePairs.map(item=>item.id));
for(const item of building)assert(retained.has(item.id)); for(const item of hatch)assert(!retained.has(item.id)); assert(!retained.has("isolated"));
assert(selection.repetitiveArtifactCount>=4); assert.equal(selection.retainedComponentCount,1); assert.equal(selection.retainedComponents[0].componentId,"source-component-1"); assert.deepEqual(selection.retainedComponents[0].bounds,{minX:2,minY:2,maxX:10,maxY:8}); assert.equal(selection.retainedComponents[0].pairCount,building.length); assert.deepEqual(new Set(selection.retainedComponents[0].pairIds),new Set(building.map(item=>item.id))); assert(selection.retainedComponents[0].totalLengthMeters>32.9&&selection.retainedComponents[0].totalLengthMeters<33.1);
const titleRail=[pair("rail-spine-a","vertical",19,1,10),pair("rail-spine-b","vertical",19.05,10,19),pair("rail-top","horizontal",1,17.2,19.5),pair("rail-middle","horizontal",10,17.2,19.5),pair("rail-bottom","horizontal",19,17.2,19.5)];
const withTitleRail=selectSourceWallNetwork({wallFacePairs:[...building,...titleRail],sourcePixelWidth:200,sourcePixelHeight:200,sourceWidthMeters:20,sourceHeightMeters:20});
const retainedWithRail=new Set(withTitleRail.wallFacePairs.map(item=>item.id)); for(const item of building)assert(retainedWithRail.has(item.id)); for(const item of titleRail)assert(!retainedWithRail.has(item.id));
assert.equal(withTitleRail.rejectedSideRailPairCount,titleRail.length); assert.equal(withTitleRail.retainedComponentCount,1); assert.equal(withTitleRail.retainedComponents.length,1); assert.deepEqual(withTitleRail.retainedComponents[0].bounds,{minX:2,minY:2,maxX:10,maxY:8}); assert(withTitleRail.diagnostics.some(item=>item.includes("right-side title-block rails")));
assert(selection.diagnostics.some(item=>item.includes("opening continuity"))); assert(selection.diagnostics.some(item=>item.includes("component bounds")));
console.log("Blueprint source wall network selector contract passed.");
