import assert from "node:assert/strict";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { assessSourcePixelOverlay, type BosGraySourceImage } from "./source-pixel-overlay";

function wall(id: string, y: number): BosWallSystemCandidate {
  const faceA = { start: { x: 1, y }, end: { x: 9, y } };
  const faceB = { start: { x: 1, y: y + 0.2 }, end: { x: 9, y: y + 0.2 } };
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: 1, y: y + 0.1 }, end: { x: 9, y: y + 0.1 } },
    thickness: 0.2,
    length: 8,
    orientationRadians: 0,
    faceA: { id: `${id}-a`, primitiveId: `${id}-a`, sourcePage: 1, line: faceA, confidence: 0.9 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-b`, sourcePage: 1, line: faceB, confidence: 0.9 },
    overlapRatio: 1,
    confidence: 0.9,
  };
}

const width = 100;
const height = 100;
const data = new Uint8Array(width * height).fill(255);
const inkHorizontal = (y: number) => {
  for (let x = 10; x <= 90; x += 1) data[y * width + x] = 0;
};
const inkVertical = (x: number) => {
  for (let y = 50; y <= 90; y += 1) data[y * width + x] = 0;
};
inkHorizontal(20);
inkHorizontal(22);
inkVertical(50); // real architectural source line intentionally omitted by the candidate
const image: BosGraySourceImage = { data, width, height };

const supported = assessSourcePixelOverlay({
  image,
  wallSystems: [wall("supported", 2)],
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  options: { architecturalRunPixels: 20, supportRadiusPixels: 1, coverageRadiusPixels: 2, sampleStepPixels: 2 },
});
assert(supported.predictedPrecision > 0.95, "predicted faces directly on source ink must have high precision");
assert(supported.architecturalRecall < 0.9, "a missing real source wall must lower architectural recall");
assert(supported.architecturalRecall > 0.4, "covered source walls must still contribute recall");

const withUnsupported = assessSourcePixelOverlay({
  image,
  wallSystems: [wall("supported", 2), wall("unsupported", 7)],
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  options: { architecturalRunPixels: 20, supportRadiusPixels: 1, coverageRadiusPixels: 2, sampleStepPixels: 2 },
});
assert(withUnsupported.predictedPrecision < supported.predictedPrecision - 0.25, "unsupported predicted wall faces must lower precision");
assert(withUnsupported.unsupportedWallSystemIds.includes("unsupported"), "unsupported wall systems must be individually auditable");
assert(withUnsupported.diagnostics.some((item) => item.includes("rendered Blueprint page")), "overlay diagnostics must state the independent rendered-source basis");

console.log("Blueprint source pixel overlay contract passed.");
