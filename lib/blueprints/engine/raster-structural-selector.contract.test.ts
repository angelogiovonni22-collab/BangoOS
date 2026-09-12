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
  wall("top-right", 3.0, 0, 6.0, 0), // one-metre door/opening gap: architectural continuity
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

const result = selectStructuralRasterWallSystems([...building, ...repetitiveNoise, ...isolatedNoise]);
const kept = new Set(result.wallSystems.map((item) => item.id));

for (const expected of building) assert(kept.has(expected.id), `building system ${expected.id} must survive structural selection`);
for (const rejected of [...repetitiveNoise, ...isolatedNoise]) assert(!kept.has(rejected.id), `non-building system ${rejected.id} must be rejected`);
assert(result.repetitiveArtifactCount >= 4, "repetitive short parallel hatch family must be identified before component selection");
assert(result.retainedComponentCount >= 1, "the building architectural network must be retained");
assert(result.rejectedSystemIds.length >= 6, "isolated and repetitive systems must remain auditable as rejected candidates");
assert(result.diagnostics.some((item) => item.includes("no unsupported long-distance bridging")), "selector diagnostics must explicitly preserve the no-bridge invariant");

console.log("Blueprint raster structural selector contract passed.");
