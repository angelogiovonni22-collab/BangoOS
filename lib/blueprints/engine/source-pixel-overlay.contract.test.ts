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
const inkHorizontal = (y: number, start = 10, end = 90) => {
  for (let x = start; x <= end; x += 1) data[y * width + x] = 0;
};
const inkVertical = (x: number, start = 50, end = 90) => {
  for (let y = start; y <= end; y += 1) data[y * width + x] = 0;
};

// Supported two-face horizontal wall.
inkHorizontal(20);
inkHorizontal(22);
// Real two-face vertical wall intentionally omitted by the candidate.
inkVertical(50);
inkVertical(52);
// Long annotation line: raw long-run audit should see it, paired wall-face mask should not.
inkHorizontal(70);
// Majority-page sheet frame that must not count against either recall denominator.
inkHorizontal(3, 1, 98);
const image: BosGraySourceImage = { data, width, height };

const supported = assessSourcePixelOverlay({
  image,
  wallSystems: [wall("supported", 2)],
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  options: {
    architecturalRunPixels: 20,
    supportRadiusPixels: 1,
    coverageRadiusPixels: 2,
    sampleStepPixels: 2,
    minWallThicknessMeters: 0.15,
    maxWallThicknessMeters: 0.35,
  },
});
assert(supported.predictedPrecision > 0.95, "predicted faces directly on source ink must have high precision");
assert(supported.architecturalRecall < 0.8, "raw long-run recall must remain conservative when source linework is missing or non-wall");
assert(supported.sourceWallFaceRecall < 0.9, "an omitted independently paired source wall must lower wall-face recall");
assert(supported.sourceWallFaceRecall > 0.45, "the covered paired source wall must still contribute substantial wall-face recall");
assert(supported.sourceWallFaceRecall > supported.architecturalRecall, "an unpaired annotation run must not pollute paired wall-face recall");
assert(supported.sourceWallFacePairCount >= 2, "independent wall-face masking must identify the two source wall systems");
assert(supported.excludedSheetFramePixelCount >= 90, "majority-page edge frame ink must be excluded from the raw architectural denominator");

const noFrameData = new Uint8Array(data);
for (let x = 1; x <= 98; x += 1) noFrameData[3 * width + x] = 255;
const withoutFrame = assessSourcePixelOverlay({
  image: { data: noFrameData, width, height },
  wallSystems: [wall("supported", 2)],
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  options: {
    architecturalRunPixels: 20,
    supportRadiusPixels: 1,
    coverageRadiusPixels: 2,
    sampleStepPixels: 2,
    minWallThicknessMeters: 0.15,
    maxWallThicknessMeters: 0.35,
  },
});
assert(Math.abs(supported.architecturalRecall - withoutFrame.architecturalRecall) < 0.01, "sheet-frame ink must not materially change raw architectural recall");
assert(Math.abs(supported.sourceWallFaceRecall - withoutFrame.sourceWallFaceRecall) < 0.01, "sheet-frame ink must not materially change paired wall-face recall");

const withUnsupported = assessSourcePixelOverlay({
  image,
  wallSystems: [wall("supported", 2), wall("unsupported", 7.5)],
  sourceWidthMeters: 10,
  sourceHeightMeters: 10,
  options: {
    architecturalRunPixels: 20,
    supportRadiusPixels: 1,
    coverageRadiusPixels: 2,
    sampleStepPixels: 2,
    minWallThicknessMeters: 0.15,
    maxWallThicknessMeters: 0.35,
  },
});
assert(withUnsupported.predictedPrecision < supported.predictedPrecision - 0.25, "unsupported predicted wall faces must lower precision");
assert(withUnsupported.unsupportedWallSystemIds.includes("unsupported"), "unsupported wall systems must be individually auditable");
assert(withUnsupported.diagnostics.some((item) => item.includes("independently paired rendered-source wall-face pixels")), "overlay diagnostics must expose the independent wall-face recall basis");
assert(withUnsupported.diagnostics.some((item) => item.includes("rendered Blueprint page")), "overlay diagnostics must state the independent rendered-source basis");

console.log("Blueprint source pixel overlay contract passed.");
