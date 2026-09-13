import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import { diagnoseGlobalDimensionBoundaries } from "./global-dimension-boundary-diagnostic";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

function wall(id: string, x: number): BosWallSystemCandidate {
  const start = { x, y: 0 };
  const end = { x, y: 6 };
  return {
    id,
    sourcePage: 1,
    centerline: { start, end },
    thickness: 0.1524,
    length: 6,
    orientationRadians: Math.PI / 2,
    faceA: { id: `${id}-a`, primitiveId: `${id}-pa`, sourcePage: 1, line: { start, end }, confidence: 0.92 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-pb`, sourcePage: 1, line: { start, end }, confidence: 0.92 },
    overlapRatio: 1,
    confidence: 0.92,
  };
}

function dimension(id: string, startX: number, endX: number, value: number): BosDimension {
  return {
    id,
    levelId: "level-1",
    page: 1,
    start: { x: startX, y: -1 },
    end: { x: endX, y: -1 },
    value,
    unit: "m",
    rawText: `${value.toFixed(2)} m`,
    confidence: 0.9,
    evidence: [],
  };
}

function association(dimensionId: string): BosRasterDimensionEvidenceAssociation {
  return {
    dimensionId,
    sourceSegmentId: `${dimensionId}-source`,
    sourceSegmentIds: [`${dimensionId}-source`],
    start: { x: 0, y: -1 },
    end: { x: 8, y: -1 },
    orientation: "horizontal",
    evidenceMode: "single_segment",
    relativeLengthError: 0,
    labelDistanceMeters: 0.1,
    startWitnessSupport: true,
    endWitnessSupport: true,
    confidence: 0.9,
  };
}

const matched = dimension("matched", 0, 8, 8);
const missingStart = dimension("missing-start", 2, 8, 6);
const ambiguousStart = dimension("ambiguous-start", 0.02, 8, 7.98);
const residual = dimension("residual", 0, 7, 8);

const result = diagnoseGlobalDimensionBoundaries({
  wallSystems: [wall("left", 0), wall("left-neighbor", 0.05), wall("right", 8), wall("residual-right", 7)],
  dimensions: [matched, missingStart, ambiguousStart, residual],
  associations: [association("matched"), association("missing-start"), association("ambiguous-start"), association("residual")],
  matchedDimensionIds: new Set(["matched"]),
});

assert.equal(result.dimensions.length, 4);
assert.equal(result.dimensions.find((item) => item.dimensionId === "matched")?.reason, "matched_global_constraint");
assert.equal(result.dimensions.find((item) => item.dimensionId === "missing-start")?.reason, "no_boundary_near_start");
assert.equal(result.dimensions.find((item) => item.dimensionId === "ambiguous-start")?.reason, "ambiguous_boundary_at_start");
assert.equal(result.dimensions.find((item) => item.dimensionId === "residual")?.reason, "boundary_span_residual_too_high");
assert.equal(result.reasonCounts.matched_global_constraint, 1);
assert(result.diagnostics.some((item) => item.includes("without changing candidate or canonical geometry")));
assert(result.diagnostics.some((item) => item.includes("0.32 m endpoint alignment")));
console.log("Blueprint global dimension boundary diagnostic contract passed.");
