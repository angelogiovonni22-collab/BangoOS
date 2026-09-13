import type { BosDimension } from "./building-graph";
import type { BosWallSystemCandidate } from "./wall-system-builder";
import type { BosConstraintEvidence } from "./global-constraint-solver";
import type { BosCrossEvidenceBoundaryConvergenceDiagnostic } from "./cross-evidence-boundary-convergence-diagnostic";
import type { BosCrossEvidenceConstraintReadinessDiagnostic } from "./cross-evidence-constraint-readiness-diagnostic";

export type BosReadOnlyDimensionConstraintSimulationReason =
  | "simulated_dimension_constraint"
  | "not_ready"
  | "missing_dimension"
  | "missing_unique_convergence"
  | "missing_candidate_wall"
  | "invalid_boundary_coordinates"
  | "span_residual_too_high";

export type BosReadOnlyDimensionConstraintSimulationDiagnostic = {
  dimensionId: string;
  rawText: string;
  candidateWallIds: string[];
  startCoordinate: number | null;
  endCoordinate: number | null;
  printedValueMeters: number | null;
  simulatedSpanMeters: number | null;
  relativeSpanError: number | null;
  minimumWallSourceSupport: number | null;
  simulatedConstraint: BosConstraintEvidence | null;
  applied: false;
  reason: BosReadOnlyDimensionConstraintSimulationReason;
};

/**
 * Builds hypothetical dimension constraints only after the cross-evidence readiness gate passes.
 * This function intentionally does not call the wall solver, mutate wall geometry, append constraints
 * to the live candidate, or persist anything. It is a final read-only rehearsal for later consumption.
 */
export function simulateReadOnlyDimensionConstraints(input: {
  dimensions: readonly BosDimension[];
  readiness: readonly BosCrossEvidenceConstraintReadinessDiagnostic[];
  convergence: readonly BosCrossEvidenceBoundaryConvergenceDiagnostic[];
  wallSystems: readonly BosWallSystemCandidate[];
  maximumRelativeSpanError?: number;
}) {
  const maximumRelativeSpanError = input.maximumRelativeSpanError ?? 0.015;
  const dimensionById = new Map(input.dimensions.map((dimension) => [dimension.id, dimension]));
  const convergenceById = new Map(input.convergence.map((item) => [item.dimensionId, item]));
  const wallIds = new Set(input.wallSystems.map((wall) => wall.id));

  const diagnostics: BosReadOnlyDimensionConstraintSimulationDiagnostic[] = input.readiness.map((ready) => {
    const base = {
      dimensionId: ready.dimensionId,
      rawText: ready.rawText,
      candidateWallIds: [...ready.candidateWallIds],
      startCoordinate: null as number | null,
      endCoordinate: null as number | null,
      printedValueMeters: null as number | null,
      simulatedSpanMeters: null as number | null,
      relativeSpanError: null as number | null,
      minimumWallSourceSupport: ready.minimumWallSourceSupport,
      simulatedConstraint: null as BosConstraintEvidence | null,
      applied: false as const,
    };

    if (!ready.ready) return { ...base, reason: "not_ready" as const };
    const dimension = dimensionById.get(ready.dimensionId);
    if (!dimension || !(dimension.value > 0)) return { ...base, reason: "missing_dimension" as const };
    const convergence = convergenceById.get(ready.dimensionId);
    if (!convergence || convergence.reason !== "unique_cross_evidence_boundary_pair" || convergence.candidates.length !== 1) {
      return { ...base, printedValueMeters: dimension.value, reason: "missing_unique_convergence" as const };
    }

    const candidate = convergence.candidates[0];
    const candidateWallIds = [...new Set([...candidate.candidateStartWallIds, ...candidate.candidateEndWallIds])];
    if (candidateWallIds.some((id) => !wallIds.has(id))) {
      return { ...base, candidateWallIds, printedValueMeters: dimension.value, reason: "missing_candidate_wall" as const };
    }

    const startCoordinate = convergence.recommendedStartCoordinate;
    const endCoordinate = convergence.recommendedEndCoordinate;
    if (!Number.isFinite(startCoordinate) || !Number.isFinite(endCoordinate) || startCoordinate === endCoordinate) {
      return { ...base, candidateWallIds, startCoordinate, endCoordinate, printedValueMeters: dimension.value, reason: "invalid_boundary_coordinates" as const };
    }

    const simulatedSpanMeters = Math.abs((endCoordinate as number) - (startCoordinate as number));
    const relativeSpanError = Math.abs(simulatedSpanMeters - dimension.value) / Math.max(dimension.value, 0.001);
    if (relativeSpanError > maximumRelativeSpanError) {
      return {
        ...base,
        candidateWallIds,
        startCoordinate,
        endCoordinate,
        printedValueMeters: dimension.value,
        simulatedSpanMeters,
        relativeSpanError,
        reason: "span_residual_too_high" as const,
      };
    }

    const supportConfidence = Math.max(0, Math.min(1, ready.minimumWallSourceSupport ?? 0));
    const residualConfidence = Math.max(0, Math.min(1, 1 - relativeSpanError / Math.max(maximumRelativeSpanError, 0.0001)));
    const simulatedConstraint: BosConstraintEvidence = {
      relation: "dimension",
      wallIds: candidateWallIds,
      dimensionId: ready.dimensionId,
      confidence: Math.min(supportConfidence, residualConfidence),
      residual: relativeSpanError,
    };

    return {
      ...base,
      candidateWallIds,
      startCoordinate,
      endCoordinate,
      printedValueMeters: dimension.value,
      simulatedSpanMeters,
      relativeSpanError,
      simulatedConstraint,
      reason: "simulated_dimension_constraint" as const,
    };
  });

  const simulatedConstraintCount = diagnostics.filter((item) => item.reason === "simulated_dimension_constraint").length;
  return {
    dimensions: diagnostics,
    simulatedConstraintCount,
    constraints: diagnostics.flatMap((item) => item.simulatedConstraint ? [item.simulatedConstraint] : []),
    diagnostics: [
      `Read-only dimension constraint simulation inspected ${diagnostics.length} readiness result(s).`,
      `${simulatedConstraintCount} hypothetical dimension constraint(s) survive the ${(maximumRelativeSpanError * 100).toFixed(1)}% printed-span gate.`,
      "Simulation only: no constraints were applied, no solver was invoked, no walls moved, no topology changed, and no canonical data was written.",
    ],
  };
}
