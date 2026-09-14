export type BosBlueprintPhaseFidelityAuditInput = {
  sourceAlignment: number | null;
  sourceNetworkRecall: number | null;
  wallTopology: number | null;
  exteriorClosure: number | null;
  verifiedBoundaryCount: number;
  verifiedBoundaryFailureCount: number;
  maximumVerifiedBoundaryCoordinateErrorMeters: number | null;
  maximumVerifiedBoundaryThicknessErrorMeters: number | null;
  simulatedDimensionCount: number;
  maximumSimulatedDimensionResidual: number | null;
  unresolvedSourceResolvedDimensionCount: number;
  ambiguousDimensionCount: number;
  totalDimensionCount: number;
  unsupportedHighConfidenceWallCount: number;
};

export type BosBlueprintPhaseFidelityAuditCheck = {
  key: string;
  passed: boolean;
  observed: number | null;
  target: string;
  evidence: string;
};

/**
 * Read-only summary of the hard 2D Blueprint fidelity gates. This intentionally does not infer
 * success from a single metric: source alignment, source-backed boundary accuracy, printed
 * dimensions, topology/closure, ambiguity, and unsupported geometry must all pass independently.
 */
export function auditBlueprintPhaseFidelity(input: BosBlueprintPhaseFidelityAuditInput) {
  const ambiguityRatio = input.totalDimensionCount > 0 ? input.ambiguousDimensionCount / input.totalDimensionCount : 1;
  const boundaryCoordinatePassed = input.verifiedBoundaryCount > 0
    && input.verifiedBoundaryFailureCount === 0
    && input.maximumVerifiedBoundaryCoordinateErrorMeters !== null
    && input.maximumVerifiedBoundaryCoordinateErrorMeters <= 0.02;
  const boundaryThicknessPassed = input.verifiedBoundaryCount > 0
    && input.verifiedBoundaryFailureCount === 0
    && input.maximumVerifiedBoundaryThicknessErrorMeters !== null
    && input.maximumVerifiedBoundaryThicknessErrorMeters <= 0.02;
  const dimensionResidualPassed = input.simulatedDimensionCount > 0
    && input.maximumSimulatedDimensionResidual !== null
    && input.maximumSimulatedDimensionResidual <= 0.015
    && input.unresolvedSourceResolvedDimensionCount === 0;

  const checks: BosBlueprintPhaseFidelityAuditCheck[] = [
    {
      key: "independent_source_alignment",
      passed: input.sourceAlignment !== null && input.sourceAlignment >= 0.99,
      observed: input.sourceAlignment,
      target: ">= 0.99",
      evidence: "Canonical independent source-alignment metric.",
    },
    {
      key: "independent_source_network_coverage",
      passed: input.sourceNetworkRecall !== null && input.sourceNetworkRecall >= 0.99,
      observed: input.sourceNetworkRecall,
      target: ">= 0.99",
      evidence: "Rendered-source building-scale wall network covered by reconstructed wall faces.",
    },
    {
      key: "verified_wall_coordinate_error",
      passed: boundaryCoordinatePassed,
      observed: input.maximumVerifiedBoundaryCoordinateErrorMeters,
      target: "<= 0.02 m",
      evidence: `${input.verifiedBoundaryCount} source-family boundary agreement(s), ${input.verifiedBoundaryFailureCount} unresolved.`,
    },
    {
      key: "verified_wall_thickness_error",
      passed: boundaryThicknessPassed,
      observed: input.maximumVerifiedBoundaryThicknessErrorMeters,
      target: "<= 0.02 m",
      evidence: `${input.verifiedBoundaryCount} source-family boundary agreement(s), ${input.verifiedBoundaryFailureCount} unresolved.`,
    },
    {
      key: "major_dimension_residual",
      passed: dimensionResidualPassed,
      observed: input.maximumSimulatedDimensionResidual,
      target: "<= 0.015 relative error and no unresolved source-resolved dimensions",
      evidence: `${input.simulatedDimensionCount} safe simulated dimension constraint(s); ${input.unresolvedSourceResolvedDimensionCount} source-resolved dimension(s) remain unresolved.`,
    },
    {
      key: "source_supported_room_cycles",
      passed: input.wallTopology !== null && input.wallTopology >= 0.999999,
      observed: input.wallTopology,
      target: "1.0 closure",
      evidence: "Canonical wall-topology closure metric is used as the fail-closed room-cycle proxy until all source-supported cycles close.",
    },
    {
      key: "exterior_perimeter_closure",
      passed: input.exteriorClosure !== null && input.exteriorClosure >= 0.999999,
      observed: input.exteriorClosure,
      target: "1.0 closure",
      evidence: "Canonical exterior-closure metric.",
    },
    {
      key: "dimension_ambiguity",
      passed: ambiguityRatio <= 0.01,
      observed: ambiguityRatio,
      target: "<= 0.01",
      evidence: `${input.ambiguousDimensionCount}/${input.totalDimensionCount} dimensions remain source-axis ambiguous.`,
    },
    {
      key: "unsupported_high_confidence_geometry",
      passed: input.unsupportedHighConfidenceWallCount === 0,
      observed: input.unsupportedHighConfidenceWallCount,
      target: "0 walls",
      evidence: "High-confidence reconstructed wall systems below direct rendered-source support requirements.",
    },
  ];

  return {
    passed: checks.every((check) => check.passed),
    passedCount: checks.filter((check) => check.passed).length,
    failedCount: checks.filter((check) => !check.passed).length,
    ambiguityRatio,
    checks,
    failedKeys: checks.filter((check) => !check.passed).map((check) => check.key),
    diagnostics: [
      `Blueprint phase fidelity audit: ${checks.filter((check) => check.passed).length}/${checks.length} hard gates currently pass.`,
      "Fail-closed: missing evidence never counts as a pass, and this audit does not move, create, promote, delete, or persist geometry.",
    ],
  };
}
