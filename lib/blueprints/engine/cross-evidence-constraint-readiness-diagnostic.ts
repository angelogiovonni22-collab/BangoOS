import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosSourcePixelOverlayReport } from "./source-pixel-overlay";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";

export type BosCrossEvidenceConstraintReadinessReason =
  | "ready_for_read_only_constraint_simulation"
  | "not_uniquely_converged"
  | "missing_candidate_wall"
  | "insufficient_source_pixel_support"
  | "span_residual_too_high";

export type BosCrossEvidenceConstraintReadinessDiagnostic = {
  dimensionId: string;
  rawText: string;
  candidateWallIds: string[];
  minimumWallSourceSupport: number | null;
  independentRelativeSpanError: number | null;
  candidateRelativeSpanError: number | null;
  ready: boolean;
  reason: BosCrossEvidenceConstraintReadinessReason;
};

/**
 * Read-only gate between evidence convergence and any later constraint-consumption simulation.
 * It verifies that the converged pair refers only to retained candidate walls, that every referenced
 * wall remains directly supported by rendered source pixels, and that both independent and candidate
 * spans stay inside the strict fidelity residual. No constraints or geometry are changed here.
 */
export function diagnoseCrossEvidenceConstraintReadiness(input: {
  convergence: readonly BosCrossEvidenceBoundaryConvergenceDiagnostic[];
  wallSystems: readonly BosWallSystemCandidate[];
  sourcePixelOverlay: BosSourcePixelOverlayReport;
  minimumWallSourceSupport?: number;
  maximumRelativeSpanError?: number;
}) {
  const minimumWallSourceSupport = input.minimumWallSourceSupport ?? 0.95;
  const maximumRelativeSpanError = input.maximumRelativeSpanError ?? 0.015;
  const wallIds = new Set(input.wallSystems.map((wall) => wall.id));
  const supportById = new Map(input.sourcePixelOverlay.perWallSupport.map((item) => [item.wallSystemId, item.support]));
  const diagnostics: BosCrossEvidenceConstraintReadinessDiagnostic[] = input.convergence.map((item) => {
    const candidate = item.reason === "unique_cross_evidence_boundary_pair" && item.candidates.length === 1
      ? item.candidates[0]
      : null;
    if (!candidate) {
      return {
        dimensionId: item.dimensionId,
        rawText: item.rawText,
        candidateWallIds: [],
        minimumWallSourceSupport: null,
        independentRelativeSpanError: null,
        candidateRelativeSpanError: null,
        ready: false,
        reason: "not_uniquely_converged" as const,
      };
    }

    const candidateWallIds = [...new Set([...candidate.candidateStartWallIds, ...candidate.candidateEndWallIds])];
    const missingWall = candidateWallIds.some((id) => !wallIds.has(id));
    const supports = candidateWallIds.map((id) => supportById.get(id)).filter((value): value is number => typeof value === "number");
    const minimumObservedSupport = supports.length ? Math.min(...supports) : null;
    const supportComplete = supports.length === candidateWallIds.length;

    let reason: BosCrossEvidenceConstraintReadinessReason = "ready_for_read_only_constraint_simulation";
    if (missingWall) reason = "missing_candidate_wall";
    else if (!supportComplete || minimumObservedSupport === null || minimumObservedSupport < minimumWallSourceSupport) reason = "insufficient_source_pixel_support";
    else if (candidate.independentRelativeSpanError > maximumRelativeSpanError || candidate.candidateRelativeSpanError > maximumRelativeSpanError) reason = "span_residual_too_high";

    return {
      dimensionId: item.dimensionId,
      rawText: item.rawText,
      candidateWallIds,
      minimumWallSourceSupport: minimumObservedSupport,
      independentRelativeSpanError: candidate.independentRelativeSpanError,
      candidateRelativeSpanError: candidate.candidateRelativeSpanError,
      ready: reason === "ready_for_read_only_constraint_simulation",
      reason,
    };
  });

  const readyCount = diagnostics.filter((item) => item.ready).length;
  return {
    dimensions: diagnostics,
    readyCount,
    diagnostics: [
      `Cross-evidence constraint readiness inspected ${diagnostics.length} convergence result(s).`,
      `${readyCount} are eligible for a later read-only constraint-consumption simulation with ${(minimumWallSourceSupport * 100).toFixed(0)}% minimum direct source-pixel wall support and ${(maximumRelativeSpanError * 100).toFixed(1)}% span residual.`,
      "Read-only: this gate does not add constraints, move walls, alter topology, persist geometry, or change the canonical model.",
    ],
  };
}
