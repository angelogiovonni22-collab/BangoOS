export type BosShortRunCandidateFidelityMetrics = {
  wallCount: number;
  preselectionWallCount: number;
  predictedPrecision: number;
  sourceWallFaceRecall: number;
  sourceNetworkRecall: number;
  preselectionSourceNetworkRecall: number;
  topologyClosure: number;
  unsupportedHighConfidenceWallCount: number;
  dimensionAssociationCount: number;
  unresolvedDimensionCount: number;
};

function delta(after: number, before: number) {
  return after - before;
}

/**
 * Fail-closed read-only promotion summary for a narrow, independently source-backed short-run
 * candidate set. Source-family improvement alone is not enough: rendered-source precision/recall,
 * topology, dimension evidence, and unsupported high-confidence geometry must remain non-regressive.
 */
export function summarizeSourceBackedShortRunFidelitySimulation(input: {
  familyLayerSafe: boolean;
  baseline: BosShortRunCandidateFidelityMetrics;
  simulated: BosShortRunCandidateFidelityMetrics;
}) {
  const epsilon = 1e-9;
  const regressions: string[] = [];
  const { baseline, simulated } = input;

  if (simulated.predictedPrecision + epsilon < baseline.predictedPrecision) regressions.push("predicted_precision");
  if (simulated.sourceWallFaceRecall + epsilon < baseline.sourceWallFaceRecall) regressions.push("source_wall_face_recall");
  if (simulated.sourceNetworkRecall + epsilon < baseline.sourceNetworkRecall) regressions.push("source_network_recall");
  if (simulated.preselectionSourceNetworkRecall + epsilon < baseline.preselectionSourceNetworkRecall) regressions.push("preselection_source_network_recall");
  if (simulated.topologyClosure + epsilon < baseline.topologyClosure) regressions.push("topology_closure");
  if (simulated.unsupportedHighConfidenceWallCount > baseline.unsupportedHighConfidenceWallCount) regressions.push("unsupported_high_confidence_geometry");
  if (simulated.dimensionAssociationCount < baseline.dimensionAssociationCount) regressions.push("dimension_associations");
  if (simulated.unresolvedDimensionCount > baseline.unresolvedDimensionCount) regressions.push("unresolved_dimensions");

  const evidenceImproved = simulated.sourceWallFaceRecall > baseline.sourceWallFaceRecall + epsilon
    || simulated.sourceNetworkRecall > baseline.sourceNetworkRecall + epsilon
    || simulated.preselectionSourceNetworkRecall > baseline.preselectionSourceNetworkRecall + epsilon;

  const safeToConsiderFidelityPromotion = input.familyLayerSafe
    && regressions.length === 0
    && evidenceImproved;

  return {
    mode: "read_only_source_backed_short_run_fidelity_simulation" as const,
    familyLayerSafe: input.familyLayerSafe,
    baseline,
    simulated,
    delta: {
      wallCount: delta(simulated.wallCount, baseline.wallCount),
      preselectionWallCount: delta(simulated.preselectionWallCount, baseline.preselectionWallCount),
      predictedPrecision: delta(simulated.predictedPrecision, baseline.predictedPrecision),
      sourceWallFaceRecall: delta(simulated.sourceWallFaceRecall, baseline.sourceWallFaceRecall),
      sourceNetworkRecall: delta(simulated.sourceNetworkRecall, baseline.sourceNetworkRecall),
      preselectionSourceNetworkRecall: delta(simulated.preselectionSourceNetworkRecall, baseline.preselectionSourceNetworkRecall),
      topologyClosure: delta(simulated.topologyClosure, baseline.topologyClosure),
      unsupportedHighConfidenceWallCount: delta(simulated.unsupportedHighConfidenceWallCount, baseline.unsupportedHighConfidenceWallCount),
      dimensionAssociationCount: delta(simulated.dimensionAssociationCount, baseline.dimensionAssociationCount),
      unresolvedDimensionCount: delta(simulated.unresolvedDimensionCount, baseline.unresolvedDimensionCount),
    },
    regressions,
    evidenceImproved,
    safeToConsiderFidelityPromotion,
    diagnostics: [
      `The isolated source-family recovery is ${input.familyLayerSafe ? "non-regressive" : "not safe"} at the source-family layer.`,
      `${regressions.length} rendered-source/topology/dimension regression(s) were detected in the isolated candidate set.`,
      evidenceImproved
        ? "Independent rendered-source coverage improved without relying on reconstructed geometry as source evidence."
        : "The isolated candidate set did not improve independent rendered-source coverage, so promotion is not justified even if it is otherwise non-regressive.",
      safeToConsiderFidelityPromotion
        ? "This narrow candidate set may proceed to the remaining hard 2D acceptance gates; no production extraction or canonical geometry change is authorized by this summary alone."
        : "Fail closed: production extraction and canonical geometry must remain unchanged.",
    ],
  };
}
