import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { solveGlobalWallConstraints } from "./global-constraint-solver";

function wall(id: string, start: { x: number; y: number }, end: { x: number; y: number }, thickness = 0.1524): BosWallSystemCandidate {
  const length = Math.hypot(end.x - start.x, end.y - start.y);
  return {
    id,
    sourcePage: 1,
    centerline: { start: { ...start }, end: { ...end } },
    thickness,
    length,
    orientationRadians: Math.atan2(end.y - start.y, end.x - start.x),
    faceA: { id: `${id}-a`, primitiveId: `${id}-pa`, sourcePage: 1, line: { start: { ...start }, end: { ...end } }, confidence: 0.92 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-pb`, sourcePage: 1, line: { start: { ...start }, end: { ...end } }, confidence: 0.92 },
    overlapRatio: 1,
    confidence: 0.92,
  };
}

const horizontal = wall("horizontal", { x: 0, y: 0 }, { x: 4, y: 0 });
const vertical = wall("vertical", { x: 4.04, y: 0.02 }, { x: 4.04, y: 3 });
const parallel = wall("parallel", { x: 0, y: 1 }, { x: 4, y: 1 }, 0.150);
const collinear = wall("collinear", { x: 4.02, y: 0.01 }, { x: 6, y: 0.01 });

const dimension: BosDimension = {
  id: "dim-4m",
  levelId: "level-1",
  page: 1,
  start: { x: 0, y: -0.5 },
  end: { x: 4, y: -0.5 },
  value: 4,
  unit: "m",
  rawText: `13'-1 1/2\"`,
  confidence: 0.95,
  evidence: [],
};

const result = solveGlobalWallConstraints([horizontal, vertical, parallel, collinear], [dimension]);
assert.equal(result.junctionCount, 1, "Only the near-coincident horizontal/vertical/collinear endpoint cluster should become a junction");
assert.equal(result.snappedEndpointCount, 3);
assert.equal(result.matchedDimensionCount, 1);
assert.deepEqual(result.unresolvedDimensionIds, []);
assert.ok(result.constraints.some((constraint) => constraint.relation === "junction"));
assert.ok(result.constraints.some((constraint) => constraint.relation === "orthogonal"));
assert.ok(result.constraints.some((constraint) => constraint.relation === "parallel"));
assert.ok(result.constraints.some((constraint) => constraint.relation === "collinear"));
assert.ok(result.constraints.some((constraint) => constraint.relation === "dimension" && constraint.dimensionId === "dim-4m"));
assert.ok(result.constraints.some((constraint) => constraint.relation === "thickness_consistency"));
assert.ok(result.thicknessMedian !== null && Math.abs(result.thicknessMedian - 0.1524) < 0.003);

const solvedHorizontal = result.wallSystems.find((candidate) => candidate.id === "horizontal")!;
const solvedVertical = result.wallSystems.find((candidate) => candidate.id === "vertical")!;
const junctionDistance = Math.hypot(
  solvedHorizontal.centerline.end.x - solvedVertical.centerline.start.x,
  solvedHorizontal.centerline.end.y - solvedVertical.centerline.start.y,
);
assert.ok(junctionDistance < 1e-12, "Global endpoint cluster must resolve to one exact junction node");

const noBridge = solveGlobalWallConstraints([
  wall("left", { x: 0, y: 0 }, { x: 2, y: 0 }),
  wall("right", { x: 2.2, y: 0 }, { x: 4, y: 0 }),
]);
assert.equal(noBridge.junctionCount, 0, "Solver must not bridge unsupported 200 mm gaps");
assert.equal(noBridge.snappedEndpointCount, 0);

console.log("global wall constraint solver contract passed");
