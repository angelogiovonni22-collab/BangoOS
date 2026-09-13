import assert from "node:assert/strict";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import type { BosSourcePixelOverlayReport } from "./source-pixel-overlay";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import { diagnoseCrossEvidenceConstraintReadiness } from "./cross-evidence-constraint-readiness-diagnostic";

function wall(id: string): BosWallSystemCandidate {
  return {
    id,
    sourcePage: 1,
    centerline: { start: { x: 0, y: 0 }, end: { x: 0, y: 3 } },
    thickness: 0.15,
    confidence: 0.95,
    overlapRatio: 1,
    faceA: { primitiveId: `${id}-a`, line: { start: { x: -0.075, y: 0 }, end: { x: -0.075, y: 3 } } },
    faceB: { primitiveId: `${id}-b`, line: { start: { x: 0.075, y: 0 }, end: { x: 0.075, y: 3 } } },
  };
}

const convergence: BosCrossEvidenceBoundaryConvergenceDiagnostic = {
  dimensionId: "dimension-ready",
  rawText: "23'-4\"",
  dominantStartCoordinate: null,
  dominantEndCoordinate: 28.35,
  dominantStartLengthMeters: null,
  dominantEndLengthMeters: 12.9,
  candidates: [{
    independentStartCoordinate: 21.319,
    independentEndCoordinate: 28.355,
    candidateStartCoordinate: 21.342,
    candidateEndCoordinate: 28.351,
    independentRelativeSpanError: 0.0107,
    candidateRelativeSpanError: 0.0145,
    candidateStartWallIds: ["wall-start"],
    candidateEndWallIds: ["wall-end-a", "wall-end-b"],
  }],
  recommendedStartCoordinate: 21.342,
  recommendedEndCoordinate: 28.351,
  reason: "unique_cross_evidence_boundary_pair",
};

function overlay(entries: Array<{ wallSystemId: string; support: number }>): BosSourcePixelOverlayReport {
  return {
    predictedFaceSampleCount: 1,
    supportedFaceSampleCount: 1,
    predictedPrecision: 1,
    architecturalInkPixelCount: 1,
    coveredArchitecturalInkPixelCount: 1,
    architecturalRecall: 1,
    f1: 1,
    sourceWallFacePixelCount: 1,
    coveredSourceWallFacePixelCount: 1,
    sourceWallFaceRecall: 1,
    sourceWallFaceF1: 1,
    sourceWallFacePairCount: 1,
    sourceWallFaceCandidateRunCount: 1,
    sourceWallFaceRejectedSheetFrameRunCount: 0,
    excludedSheetFramePixelCount: 0,
    unsupportedWallSystemCount: 0,
    unsupportedWallSystemIds: [],
    perWallSupport: entries.map((entry) => ({ ...entry, samples: 20 })),
    diagnostics: [],
  };
}

const walls = [wall("wall-start"), wall("wall-end-a"), wall("wall-end-b")];
const ready = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [convergence],
  wallSystems: walls,
  sourcePixelOverlay: overlay([
    { wallSystemId: "wall-start", support: 1 },
    { wallSystemId: "wall-end-a", support: 0.99 },
    { wallSystemId: "wall-end-b", support: 0.98 },
  ]),
});
assert.equal(ready.readyCount, 1);
assert.equal(ready.dimensions[0].reason, "ready_for_read_only_constraint_simulation");
assert.equal(ready.dimensions[0].minimumWallSourceSupport, 0.98);
assert(ready.diagnostics.some((item) => item.includes("does not add constraints")));

const weakSupport = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [convergence],
  wallSystems: walls,
  sourcePixelOverlay: overlay([
    { wallSystemId: "wall-start", support: 1 },
    { wallSystemId: "wall-end-a", support: 0.94 },
    { wallSystemId: "wall-end-b", support: 0.98 },
  ]),
});
assert.equal(weakSupport.readyCount, 0);
assert.equal(weakSupport.dimensions[0].reason, "insufficient_source_pixel_support");

const notConverged = diagnoseCrossEvidenceConstraintReadiness({
  convergence: [{ ...convergence, reason: "ambiguous_cross_evidence_pair", recommendedStartCoordinate: null, recommendedEndCoordinate: null }],
  wallSystems: walls,
  sourcePixelOverlay: overlay(walls.map((item) => ({ wallSystemId: item.id, support: 1 }))),
});
assert.equal(notConverged.dimensions[0].reason, "not_uniquely_converged");

console.log("Blueprint cross-evidence constraint readiness diagnostic contract passed.");
