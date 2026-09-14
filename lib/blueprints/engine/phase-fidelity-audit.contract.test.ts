import assert from "node:assert/strict";
import { auditBlueprintPhaseFidelity } from "./phase-fidelity-audit";

const passing = auditBlueprintPhaseFidelity({
  sourceAlignment: 0.995,
  sourceNetworkRecall: 0.992,
  wallTopology: 1,
  exteriorClosure: 1,
  verifiedBoundaryCount: 4,
  verifiedBoundaryFailureCount: 0,
  maximumVerifiedBoundaryCoordinateErrorMeters: 0.012,
  maximumVerifiedBoundaryThicknessErrorMeters: 0.014,
  simulatedDimensionCount: 3,
  maximumSimulatedDimensionResidual: 0.011,
  unresolvedSourceResolvedDimensionCount: 0,
  ambiguousDimensionCount: 0,
  totalDimensionCount: 70,
  unsupportedHighConfidenceWallCount: 0,
});
assert.equal(passing.passed, true);
assert.equal(passing.failedCount, 0);

const liveLike = auditBlueprintPhaseFidelity({
  sourceAlignment: 0.9737,
  sourceNetworkRecall: 0.6518,
  wallTopology: 0.4859,
  exteriorClosure: 0.3846,
  verifiedBoundaryCount: 1,
  verifiedBoundaryFailureCount: 0,
  maximumVerifiedBoundaryCoordinateErrorMeters: 0.0061,
  maximumVerifiedBoundaryThicknessErrorMeters: 0.0122,
  simulatedDimensionCount: 1,
  maximumSimulatedDimensionResidual: 0.0145,
  unresolvedSourceResolvedDimensionCount: 1,
  ambiguousDimensionCount: 23,
  totalDimensionCount: 70,
  unsupportedHighConfidenceWallCount: 1,
});
assert.equal(liveLike.passed, false);
assert(liveLike.failedKeys.includes("independent_source_alignment"));
assert(liveLike.failedKeys.includes("independent_source_network_coverage"));
assert(liveLike.failedKeys.includes("major_dimension_residual"));
assert(liveLike.failedKeys.includes("source_supported_room_cycles"));
assert(liveLike.failedKeys.includes("exterior_perimeter_closure"));
assert(liveLike.failedKeys.includes("dimension_ambiguity"));
assert(liveLike.failedKeys.includes("unsupported_high_confidence_geometry"));
assert(!liveLike.failedKeys.includes("verified_wall_coordinate_error"));
assert(!liveLike.failedKeys.includes("verified_wall_thickness_error"));

const missingEvidence = auditBlueprintPhaseFidelity({
  sourceAlignment: null,
  sourceNetworkRecall: null,
  wallTopology: null,
  exteriorClosure: null,
  verifiedBoundaryCount: 0,
  verifiedBoundaryFailureCount: 0,
  maximumVerifiedBoundaryCoordinateErrorMeters: null,
  maximumVerifiedBoundaryThicknessErrorMeters: null,
  simulatedDimensionCount: 0,
  maximumSimulatedDimensionResidual: null,
  unresolvedSourceResolvedDimensionCount: 0,
  ambiguousDimensionCount: 0,
  totalDimensionCount: 0,
  unsupportedHighConfidenceWallCount: 0,
});
assert.equal(missingEvidence.passed, false, "missing evidence must fail closed");
assert(missingEvidence.diagnostics.some((item) => item.includes("Fail-closed")));

console.log("Blueprint phase fidelity audit contract passed.");
