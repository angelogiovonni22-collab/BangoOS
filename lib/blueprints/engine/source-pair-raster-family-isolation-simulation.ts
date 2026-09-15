import type { ReturnTypeOfSourceBackedShortRunSummary } from "./source-pair-raster-family-isolation-types";

export type BosSourceBackedFamilyIsolationResult = {
  representativePairId: string;
  summary: ReturnTypeOfSourceBackedShortRunSummary;
};

/**
 * Fail-closed aggregation for one-family-at-a-time source-backed short-run simulations.
 * A family is eligible only when its isolated replay passes the existing source-family promotion
 * summary. This aggregation does not authorize Production extraction changes.
 */
export function summarizeSourceBackedFamilyIsolationSimulation(input: {
  results: readonly BosSourceBackedFamilyIsolationResult[];
}) {
  const ordered = [...input.results].sort((a, b) => a.representativePairId.localeCompare(b.representativePairId));
  const safe = ordered.filter((result) => result.summary.safeToConsiderPromotion);
  const regressive = ordered.filter((result) => result.summary.previouslyUniqueRegressionFamilyIds.length > 0);
  const ambiguousGrowth = ordered.filter((result) => result.summary.delta.ambiguousAgreementCount > 0);
  return {
    mode: "read_only_source_backed_short_run_family_isolation" as const,
    familyCount: ordered.length,
    safeFamilyCount: safe.length,
    safeFamilyIds: safe.map((result) => result.representativePairId),
    safeAddedSegmentIds: [...new Set(safe.flatMap((result) => result.summary.addedSegmentIds))].sort(),
    regressiveFamilyIds: regressive.map((result) => result.representativePairId),
    ambiguityGrowthFamilyIds: ambiguousGrowth.map((result) => result.representativePairId),
    results: ordered,
    diagnostics: [
      `${ordered.length} source-backed short-run family/families were replayed independently against the unchanged source-family hard gates.`,
      `${safe.length} family/families are non-regressive when isolated; their candidates still require independent rendered-source, topology, dimension, and full phase fidelity validation before any Production behavior may change.`,
      `${regressive.length} family/families regress an already unique source family when isolated and must remain fail-closed.`,
      `${ambiguousGrowth.length} family/families increase source-family ambiguity when isolated and must remain fail-closed.`,
    ],
  };
}
