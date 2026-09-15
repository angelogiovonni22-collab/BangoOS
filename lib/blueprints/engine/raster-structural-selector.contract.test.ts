import assert from "node:assert/strict";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { selectStructuralRasterWallSystems } from "./raster-structural-selector";

function wall(id: string, x1: number, y1: number, x2: number, y2: number, thickness = 0.15): BosWallSystemCandidate {
  const centerline = { start: { x: x1, y: y1 }, end: { x: x2, y: y2 } };
  const length = Math.hypot(x2 - x1, y2 - y1);
  let orientationRadians = Math.atan2(y2 - y1, x2 - x1);
  while (orientationRadians < 0) orientationRadians += Math.PI;
  while (orientationRadians >= Math.PI) orientationRadians -= Math.PI;
  const face = (suffix: string) => ({
    id: `${id}-${suffix}`,
    primitiveId: `${id}-${suffix}`,
    sourcePage: 1,
    line: centerline,
    confidence: 0.9,
  });
  return {
    id,
    sourcePage: 1,
    centerline,
    thickness,
    length,
    orientationRadians,
    faceA: face("a"),
    faceB: face("b"),
    overlapRatio: 1,
    confidence: 0.9,
  };
}

const building = [
  wall("top-left", 0, 0, 2.0, 0),
  wall("top-right", 3.0, 0, 6.0, 0),
  wall("right", 6, 0, 6, 4),
  wall("bottom", 0, 4, 6, 4),
  wall("left", 0, 0, 0, 4),
  wall("partition", 3, 0, 3, 4),
];

const repetitiveNoise = [
  wall("hatch-1", 12, 0, 13, 0),
  wall("hatch-2", 12, 0.2, 13, 0.2),
  wall("hatch-3", 12, 0.4, 13, 0.4),
  wall("hatch-4", 12, 0.6, 13, 0.6),
];

const isolatedNoise = [
  wall("fixture-a", 18, 2, 18.8, 2),
  wall("fixture-b", 18.8, 2, 18.8, 2.8),
];

const all = [...building, ...repetitiveNoise, ...isolatedNoise];
const result = selectStructuralRasterWallSystems(all);
const kept = new Set(result.wallSystems.map((item) => item.id));

for (const expected of building) assert(kept.has(expected.id), `building system ${expected.id} must survive structural selection`);
for (const rejected of [...repetitiveNoise, ...isolatedNoise]) assert(!kept.has(rejected.id), `non-building system ${rejected.id} must be rejected`);
assert(result.repetitiveArtifactCount >= 4, "repetitive short parallel hatch family must be identified before component selection");
assert(result.retainedComponentCount >= 1, "the building architectural network must be retained");
assert(result.rejectedSystemIds.length >= 6, "isolated and repetitive systems must remain auditable as rejected candidates");
assert.equal(result.protectedWallSystemCount, 0, "ordinary selection must not implicitly protect any candidate");
assert(result.diagnostics.some((item) => item.includes("no unsupported long-distance bridging")), "selector diagnostics must explicitly preserve the no-bridge invariant");

const protectedIds = new Set(["fixture-a", "hatch-1", "missing-id"]);
const sourceBacked = selectStructuralRasterWallSystems(all, { protectedWallSystemIds: protectedIds });
const sourceBackedKept = new Set(sourceBacked.wallSystems.map((item) => item.id));
assert(sourceBackedKept.has("fixture-a"), "independently source-backed isolated explicit wall must survive component filtering");
assert(sourceBackedKept.has("hatch-1"), "independently source-backed explicit wall must bypass repetitive-artifact rejection");
assert(!sourceBackedKept.has("hatch-2"), "unprotected repetitive neighbor must remain rejected");
assert.equal(sourceBacked.protectedWallSystemCount, 2, "only existing protected explicit wall IDs may be counted");
assert(sourceBacked.rejectedSystemIds.includes("fixture-b"), "unprotected isolated geometry must remain rejected");
assert(sourceBacked.diagnostics.some((item) => item.includes("independent source evidence")), "selector must report source-backed protection explicitly");

console.log("Blueprint raster structural selector contract passed.");
