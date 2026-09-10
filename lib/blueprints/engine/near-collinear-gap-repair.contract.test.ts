import assert from "node:assert/strict";
import { topologyMetrics, type BosRawSegment } from "./geometry";
import { repairNearCollinearWallGaps } from "./near-collinear-gap-repair";

function segment(id: string, x1: number, y1: number, x2: number, y2: number, strokeWidth = 0.15): BosRawSegment {
  return {
    start: { x: x1, y: y1 },
    end: { x: x2, y: y2 },
    sourcePage: 2,
    sourceObjectId: id,
    strokeWidth,
    confidence: 0.95,
  };
}

const repaired = repairNearCollinearWallGaps([
  segment("left-run", 0, 0, 4, 0),
  segment("right-run", 4.22, 0.01, 8, 0.01),
]);
assert.equal(repaired.length, 1, "small near-collinear reconstruction gap should be repaired");
assert.ok(Math.hypot(repaired[0].end.x - repaired[0].start.x, repaired[0].end.y - repaired[0].start.y) > 7.9);

const doorway = repairNearCollinearWallGaps([
  segment("door-left", 0, 0, 3, 0),
  segment("door-right", 3.82, 0, 7, 0),
]);
assert.equal(doorway.length, 2, "normal doorway-width gaps must remain open");

const offset = repairNearCollinearWallGaps([
  segment("upper", 0, 0, 3, 0),
  segment("offset", 3.2, 0.14, 6, 0.14),
]);
assert.equal(offset.length, 2, "parallel but offset walls must not be bridged");

const perpendicular = repairNearCollinearWallGaps([
  segment("horizontal", 0, 0, 3, 0),
  segment("vertical", 3.2, 0, 3.2, 3),
]);
assert.equal(perpendicular.length, 2, "corners and returns must not be flattened into one wall");

const graphFixture = [
  segment("bottom-left", 0, 0, 4, 0),
  segment("bottom-right", 4.22, 0.01, 8, 0.01),
  segment("right", 8, 0, 8, 6),
  segment("top", 8, 6, 0, 6),
  segment("left", 0, 6, 0, 0),
  segment("divider", 4, 0, 4, 6),
];
const graphRepaired = repairNearCollinearWallGaps(graphFixture);
const beforeTopology = topologyMetrics(graphFixture);
const afterTopology = topologyMetrics(graphRepaired);
assert.ok(afterTopology.closure + 1e-9 >= beforeTopology.closure, "gap repair must never lower topology closure");
assert.ok(afterTopology.dangling <= beforeTopology.dangling, "gap repair must never increase dangling endpoints");

console.log("Near-collinear wall gap repair contract: passed");
