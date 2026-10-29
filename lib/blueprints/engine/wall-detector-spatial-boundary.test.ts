import assert from "node:assert/strict";
import { detectWallCenterlines } from "./wall-detector";
import type { BosRawSegment } from "./geometry";

// A wall's two faces may sit on opposite sides of a spatial index boundary.
// Moving the drawing must not change whether a physically identical pair exists.
for (const axis of ["horizontal", "vertical"] as const) {
  for (const center of [-4, -2, 0, 2, 4, 4.7]) {
    const face = (offset: number): BosRawSegment => ({
      sourcePage: 1,
      sourceObjectId: `face-${offset}`,
      start: axis === "vertical" ? { x: offset, y: 0 } : { x: 0, y: offset },
      end: axis === "vertical" ? { x: offset, y: 3 } : { x: 3, y: offset },
    });
    const walls = detectWallCenterlines([face(center - 0.0762), face(center + 0.0762)]);
    assert.equal(walls.length, 1, `${axis} six-inch wall at ${center} must survive bucket boundaries`);
    assert(Math.abs((walls[0].strokeWidth || 0) - 0.1524) < 1e-8);
    assert.equal(detectWallCenterlines([face(center - 0.3), face(center + 0.3)]).length, 0,
      "Spatial indexing must not bypass the maximum wall thickness");
  }
}

// Exact paired contours from the synthetic Production QA PDF (12 runs, 6-inch walls).
const footprint = [[0, 0], [30, 0], [30, 10], [40, 10], [40, 30], [30, 30],
  [30, 40], [0, 40], [0, 30], [-10, 30], [-10, 10], [0, 10]];
const faces = [0.25, -0.25].flatMap((offset) => {
  const points = footprint.map(([x, y], index) => {
    const [px, py] = footprint[(index + footprint.length - 1) % footprint.length];
    const [nx, ny] = footprint[(index + 1) % footprint.length];
    const incoming = Math.hypot(x - px, y - py);
    const outgoing = Math.hypot(nx - x, ny - y);
    const fx = x + offset * (-(y - py) / incoming - (ny - y) / outgoing);
    const fy = y + offset * ((x - px) / incoming + (nx - x) / outgoing);
    return { x: (240 + fx * 18) / (18 / 0.3048), y: (1008 - 130 - fy * 18) / (18 / 0.3048) };
  });
  return points.map((start, index): BosRawSegment => ({
    start, end: points[(index + 1) % points.length], sourcePage: 1,
    sourceObjectId: `qa-face-${offset}-${index}`, confidence: 0.96,
  }));
});
const footprintWalls = detectWallCenterlines(faces);
assert.equal(footprintWalls.length, 12, "Every paired run of the closed QA footprint must survive lookup");
assert(footprintWalls.every((wall) => (wall.strokeWidth || 0) >= 0.07 && (wall.strokeWidth || 0) <= 0.45),
  "Recovered source pairs must still pass the unchanged thickness limits");

console.log("Wall detection spatial boundary tests passed");
