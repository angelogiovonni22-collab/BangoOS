import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import { buildRasterArchitecturalCandidate } from "./raster-architectural-candidate";

function dimension(id: string, value: number, centerX: number): BosDimension {
  return {
    id,
    levelId: "level-1",
    page: 1,
    value,
    unit: "m",
    rawText: `${value.toFixed(2)} m`,
    confidence: 0.95,
    evidence: [{
      id: `${id}-label`,
      page: 1,
      kind: "pdf_text",
      bbox: { x: centerX * 100 - 40, y: 1200, width: 80, height: 20 },
      score: 0.95,
    }],
  };
}

function witnesses(rightX: number): BosRawSegment[] {
  return [
    { sourcePage: 1, sourceObjectId: "left-witness", start: { x: 1, y: 12 }, end: { x: 1, y: 13 }, confidence: 0.95 },
    { sourcePage: 1, sourceObjectId: "right-witness", start: { x: rightX, y: 12.05 }, end: { x: rightX, y: 13.05 }, confidence: 0.95 },
  ];
}

const rejected = buildRasterArchitecturalCandidate({
  segments: witnesses(9.8),
  dimensions: [dimension("witness-over-eight-percent", 8, 5.4)],
  drawingUnitsPerMeter: 100,
  sourceWidthMeters: 12,
  sourceHeightMeters: 15,
});
assert.equal(rejected.dimensionEvidence.associations.length, 0, "a witness span with 10% printed-length residual must remain unresolved before global constraints");
assert(rejected.dimensionEvidence.unresolvedDimensionIds.includes("witness-over-eight-percent"));
assert(rejected.dimensionEvidence.diagnostics.some((item) => item.includes("above 8.0%")));

const retained = buildRasterArchitecturalCandidate({
  segments: witnesses(9.4),
  dimensions: [dimension("witness-within-eight-percent", 8, 5.2)],
  drawingUnitsPerMeter: 100,
  sourceWidthMeters: 12,
  sourceHeightMeters: 15,
});
const association = retained.dimensionEvidence.associations.find((item) => item.dimensionId === "witness-within-eight-percent");
assert(association, "a source-supported witness span inside the 8% gate should remain available");
assert.equal(association.evidenceMode, "witness_span");
assert(association.relativeLengthError < 0.08);

console.log("Blueprint witness-span fidelity contract passed.");
