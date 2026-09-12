import assert from "node:assert/strict";
import type { BosSourceWallFacePair } from "./source-wall-face-mask";
import { selectSourceWallNetwork } from "./source-wall-network-selector";

const pxPerMeter = 10;
function pair(id: string, orientation: "horizontal" | "vertical", fixedMeters: number, startMeters: number, endMeters: number, separationMeters = 0.2): BosSourceWallFacePair {
  const fixed = fixedMeters * pxPerMeter;
  const separationPixels = separationMeters * pxPerMeter;
  return {
    id,
    orientation,
    faceAFixedPixel: fixed - separationPixels / 2,
    faceBFixedPixel: fixed + separationPixels / 2,
    centerFixedPixel: fixed,
    startPixel: startMeters * pxPerMeter,
    endPixel: endMeters * pxPerMeter,
    lengthMeters: endMeters - startMeters,
    separationMeters,
  };
}

const building = [
  pair("top-left", "horizontal", 2, 2, 5),
  pair("top-right", "horizontal", 2, 6, 10), // 1 m door-sized opening from top-left
  pair("bottom", "horizontal", 8, 2, 10),
  pair("left", "vertical", 2, 2, 8),
  pair("right", "vertical", 10, 2, 8),
  pair("middle", "vertical", 6, 2, 8),
];
const hatch = [
  pair("hatch-1", "horizontal", 14.0, 13, 14),
  pair("hatch-2", "horizontal", 14.3, 13, 14),
  pair("hatch-3", "horizontal", 14.6, 13, 14),
  pair("hatch-4", "horizontal", 14.9, 13, 14),
  pair("hatch-5", "horizontal", 15.2, 13, 14),
];
const isolated = pair("isolated", "vertical", 17, 15, 17);

const selection = selectSourceWallNetwork({
  wallFacePairs: [...building, ...hatch, isolated],
  sourcePixelWidth: 200,
  sourcePixelHeight: 200,
  sourceWidthMeters: 20,
  sourceHeightMeters: 20,
});
const retained = new Set(selection.wallFacePairs.map((item) => item.id));
for (const item of building) assert(retained.has(item.id), `building pair ${item.id} must survive structural source-network selection`);
for (const item of hatch) assert(!retained.has(item.id), `repetitive hatch pair ${item.id} must be rejected`);
assert(!retained.has("isolated"), "small isolated wall-like evidence must not become building-scale source truth");
assert(selection.repetitiveArtifactCount >= 4, "dense repetitive short parallel families must be auditable");
assert(selection.retainedComponentCount === 1, "the synthetic building should resolve as one retained architectural component");
assert(selection.diagnostics.some((item) => item.includes("never consults reconstructed candidate topology")) === false, "runtime diagnostics should describe evidence rather than implementation comments");
assert(selection.diagnostics.some((item) => item.includes("opening continuity")), "diagnostics must make opening continuity explicit");
console.log("Blueprint source wall network selector contract passed.");
