import assert from "node:assert/strict";
import type { BosDimension } from "./building-graph";
import type { BosGlobalDimensionBoundaryDiagnostic } from "./global-dimension-boundary-diagnostic";
import { diagnoseMissingBoundaryProvenance } from "./missing-boundary-provenance-diagnostic";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";
import type { BosWallSystemCandidate } from "./wall-system-builder";

function wall(id: string, x: number): BosWallSystemCandidate {
  const start = { x, y: 0 };
  const end = { x, y: 4 };
  return {
    id,
    sourcePage: 1,
    centerline: { start, end },
    thickness: 0.1524,
    length: 4,
    orientationRadians: Math.PI / 2,
    faceA: { id: `${id}-a`, primitiveId: `${id}-pa`, sourcePage: 1, line: { start, end }, confidence: 0.92 },
    faceB: { id: `${id}-b`, primitiveId: `${id}-pb`, sourcePage: 1, line: { start, end }, confidence: 0.92 },
    overlapRatio: 1,
    confidence: 0.92,
  };
}

const dimension: BosDimension = {
  id: "dim-missing-end",
  levelId: "level-1",
  page: 1,
  start: { x: 0, y: -1 },
  end: { x: 8, y: -1 },
  value: 8,
  unit: "m",
  rawText: "26'-3\"",
  confidence: 0.95,
  evidence: [],
};

const association: BosRasterDimensionEvidenceAssociation = {
  dimensionId: dimension.id,
  sourceSegmentId: "source-axis",
  sourceSegmentIds: ["source-axis"],
  start: { x: 0, y: -1 },
  end: { x: 8, y: -1 },
  orientation: "horizontal",
  evidenceMode: "single_segment",
  relativeLengthError: 0,
  labelDistanceMeters: 0.1,
  startWitnessSupport: true,
  endWitnessSupport: true,
  confidence: 0.95,
};

const globalDiagnostic: BosGlobalDimensionBoundaryDiagnostic = {
  dimensionId: dimension.id,
  rawText: dimension.rawText || "",
  value: dimension.value,
  sourceAssociationMode: association.evidenceMode,
  reason: "no_boundary_near_end",
  boundaryFamilyCount: 1,
  startCandidateCount: 1,
  endCandidateCount: 0,
  startNearestDistanceMeters: 0,
  endNearestDistanceMeters: null,
  measuredBoundarySpanMeters: null,
  relativeSpanError: null,
};

const selected = wall("selected-left", 0);
const rejected = wall("rejected-right", 8.12);
const result = diagnoseMissingBoundaryProvenance({
  dimensions: [dimension],
  associations: [association],
  globalDiagnostics: [globalDiagnostic],
  explicitSystems: [selected, rejected],
  sheetFrameRejectedSystemIds: new Set(),
  structuralSelectedSystemIds: new Set([selected.id]),
});

assert.equal(result.probes.length, 1);
assert.equal(result.probes[0].missingEndpoint, "end");
assert.equal(result.probes[0].candidates.length, 1);
assert.equal(result.probes[0].candidates[0].wallId, rejected.id);
assert.equal(result.probes[0].candidates[0].stage, "structural_rejected");
assert.equal(result.recoveredBeforeSelectionCount, 1);
assert.equal(result.absentExplicitBoundaryCount, 0);
assert(result.diagnostics.some((item) => item.includes("read-only")));

const absent = diagnoseMissingBoundaryProvenance({
  dimensions: [dimension],
  associations: [association],
  globalDiagnostics: [globalDiagnostic],
  explicitSystems: [selected],
  sheetFrameRejectedSystemIds: new Set(),
  structuralSelectedSystemIds: new Set([selected.id]),
});
assert.equal(absent.probes[0].candidates.length, 0);
assert.equal(absent.absentExplicitBoundaryCount, 1);

console.log("Blueprint missing-boundary provenance diagnostic contract passed.");
