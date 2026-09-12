import assert from "node:assert/strict";
import type { BosRawSegment } from "./geometry";
import { evaluateRasterEvidenceStages } from "./raster-evidence-benchmark";

const segment = (id: string, x1: number, y1: number, x2: number, y2: number): BosRawSegment => ({
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  sourcePage: 1,
  sourceObjectId: id,
  confidence: 0.62,
});

// The right-hand wall intentionally straddles the legacy detector's 2 m spatial bucket boundary
// (x=3.85 and x=4.00). A valid wall must not disappear because its two faces index to adjacent
// buckets; the explicit raster wall-system builder expands its search by wall-thickness bounds.
const source: BosRawSegment[] = [
  segment("raster-h-1", 0, 0, 4, 0),
  segment("raster-h-2", 0, 0.15, 4, 0.15),
  segment("raster-h-3", 0, 3, 4, 3),
  segment("raster-h-4", 0, 3.15, 4, 3.15),
  segment("raster-v-1", 0, 0, 0, 3.15),
  segment("raster-v-2", 0.15, 0, 0.15, 3.15),
  segment("raster-v-3", 4, 0, 4, 3.15),
  segment("raster-v-4", 3.85, 0, 3.85, 3.15),
];

const report = evaluateRasterEvidenceStages({
  segments: source,
  dimensions: [],
  drawingUnitsPerMeter: 59.055118110236215,
});

assert.equal(report.rawSegmentCount, source.length, "raster benchmark must preserve the raw evidence count");
assert(report.annotationFilteredSegmentCount > 0, "raster benchmark must expose annotation-filtered evidence");
assert(report.explicitWallSystemCount >= 4, "bucket-safe explicit pairing must recover all four rectangular wall systems");
assert(report.constrainedWallSystemCount >= 4, "global constraints must retain supported explicit raster wall systems");
assert(report.explicitWallSystemTopology.closure > 0.9, "explicit raster wall systems must form the supported rectangular enclosure");
assert(report.constrainedWallSystemTopology.closure >= report.explicitWallSystemTopology.closure - 0.01, "global constraints must not materially degrade explicit raster closure");
assert(report.diagnostics.some((item) => item.includes("Raster evidence stage counts")), "benchmark must emit auditable stage diagnostics");

console.log("Blueprint raster evidence benchmark contract passed.");
