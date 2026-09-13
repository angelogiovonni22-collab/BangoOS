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

function association(dimensionId: string, startX: number, endX: number): BosRasterDimensionEvidenceAssociation {
  return {
    dimensionId,
    sourceSegmentId: `${dimensionId}-source`,
    sourceSegmentIds: [`${dimensionId}-source`],
    start: { x: startX, y: -1 },
    end: { x: endX, y: -1 },
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
const matchedResult = diagnoseGlobalDimensionBoundaries({
  wallSystems: [wall("left", 0), wall("right", 8)],
  dimensions: [matched],
  associations: [association("matched", 0, 8)],
  matchedDimensionIds: new Set(["matched"]),
});
assert.equal(matchedResult.dimensions[0]?.reason, "matched_global_constraint");
assert.equal(matchedResult.reasonCounts.matched_global_constraint, 1);

const missingStart = dimension("missing-start", 2, 8, 6);
const missingStartResult = diagnoseGlobalDimensionBoundaries({
  wallSystems: [wall("right", 8), wall("decoy", 5)],
  dimensions: [missingStart],
  associations: [association("missing-start", 2, 8)],
  matchedDimensionIds: new Set(),
});
assert.equal(missingStartResult.dimensions[0]?.reason, "no_boundary_near_start");

const ambiguousStart = dimension("ambiguous-start", 0, 8, 8);
const ambiguousStartResult = diagnoseGlobalDimensionBoundaries({
  wallSystems: [wall("left-a", -0.05), wall("left-b", 0.05), wall("right", 8)],
  dimensions: [ambiguousStart],
  associations: [association("ambiguous-start", 0, 8)],
  matchedDimensionIds: new Set(),
});
assert.equal(ambiguousStartResult.dimensions[0]?.reason, "ambiguous_boundary_at_start");
assert.equal(ambiguousStartResult.dimensions[0]?.startCandidateCount, 2);

const residual = dimension("residual", 0, 7, 8);
const residualResult = diagnoseGlobalDimensionBoundaries({
  wallSystems: [wall("left", 0), wall("right", 7)],
  dimensions: [residual],
  associations: [association("residual", 0, 7)],
  matchedDimensionIds: new Set(),
});
assert.equal(residualResult.dimensions[0]?.reason, "boundary_span_residual_too_high");
assert((residualResult.dimensions[0]?.relativeSpanError || 0) > 0.08);

assert(matchedResult.diagnostics.some((item) => item.includes("without changing candidate or canonical geometry")));
assert(matchedResult.diagnostics.some((item) => item.includes("0.32 m endpoint alignment")));
console.log("Blueprint global dimension boundary diagnostic contract passed.");
