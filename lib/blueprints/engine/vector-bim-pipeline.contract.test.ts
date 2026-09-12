import assert from "node:assert/strict";
import { applyDimensionWallConstraints } from "./dimension-constraints";
import { parseArchitecturalLength } from "./dimensions";
import { topologyMetrics, type BosRawSegment } from "./geometry";
import { solveArchitecturalTopology } from "./topology-solver";
import type { BosDimension, BosWall } from "./building-graph";

function segment(start: [number, number], end: [number, number], id: string): BosRawSegment {
  return {
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    sourcePage: 1,
    sourceObjectId: id,
    strokeWidth: 0.15,
    confidence: 0.9,
  };
}

const nearClosedRectangle = [
  segment([0, 0.02], [4.01, 0], "top"),
  segment([4.08, 0.04], [4, 3.02], "right"),
  segment([4.03, 3.08], [-0.02, 3], "bottom"),
  segment([-0.07, 2.96], [0.01, -0.03], "left"),
];
const solved = solveArchitecturalTopology(nearClosedRectangle);
const metrics = topologyMetrics(solved.segments);
assert.equal(solved.segments.length, 4, "topology solver must preserve the four structural wall runs");
assert(metrics.closure >= 0.99, "near-miss rectangle endpoints must become a closed architectural loop");
assert(solved.snappedEndpointCount > 0 || solved.repairedJunctionCount > 0, "solver must record the junction work it performed");

const fractionalLength = parseArchitecturalLength("9'-10 1/8\"");
assert(fractionalLength !== null, "fractional architectural dimensions must parse");
assert(Math.abs((fractionalLength || 0) - ((9 * 12 + 10.125) * 0.0254)) < 1e-9, "fractional feet/inches must retain exact construction-plan length");

const wall: BosWall = {
  id: "wall-1",
  levelId: "level-1",
  type: "interior",
  centerline: { start: { x: 0, y: 0 }, end: { x: 2.94, y: 0 } },
  thickness: 0.1524,
  height: 2.4384,
  confidence: 0.82,
  sourcePage: 1,
  evidence: [],
  provenance: {
    createdBy: "deterministic",
    algorithm: "paired-line",
    algorithmVersion: "1",
    evidenceIds: [],
  },
};
const dimension: BosDimension = {
  id: "dimension-1",
  levelId: "level-1",
  page: 1,
  value: 3,
  unit: "m",
  rawText: "9'-10 1/8\"",
  confidence: 0.95,
  evidence: [{
    id: "dimension-text-1",
    page: 1,
    kind: "pdf_text",
    bbox: { x: 140, y: 12, width: 14, height: 3 },
    text: "9'-10 1/8\"",
    score: 0.95,
  }],
};
const constrained = applyDimensionWallConstraints([wall], [dimension], 100);
assert.equal(constrained.matched, 1, "a unique nearby printed dimension must bind to its wall run");
assert.equal(constrained.adjusted, 1, "a small safe dangling length mismatch must be corrected from printed evidence");
assert(Math.abs(Math.hypot(
  constrained.walls[0].centerline.end.x - constrained.walls[0].centerline.start.x,
  constrained.walls[0].centerline.end.y - constrained.walls[0].centerline.start.y,
) - 3) < 1e-6, "constrained wall length must equal the printed dimension");
assert(constrained.dimensions[0].start && constrained.dimensions[0].end, "matched dimensions must retain their wall anchors for overlay/debugging");

console.log("Blueprint vector/BIM reconstruction pipeline contract passed.");
