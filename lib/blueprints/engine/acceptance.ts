import type { BosBuildingGraph } from "./building-graph";
import { MITCHELL_DEWITT_FIRST_FLOOR, runBuildingGraphBenchmark } from "./benchmarks";

export type BlueprintAcceptanceStandard = {
  id: string;
  minGraphConfidence: number;
  minValidationScore: number;
  minWallTopology: number;
  minExteriorClosure: number;
  minScaleConfidence: number;
  minSemanticCoverage: number;
  minRooms: number;
  minOpenings: number;
  requireReconstructedStatus: boolean;
  maxErrorIssues: number;
};

/**
 * Product-quality gate for the Mitchell Dewitt first-floor benchmark.
 * These thresholds intentionally sit above the historical deterministic baseline.
 * Passing the legacy benchmark alone is not enough to call the 3D reconstruction
 * production-ready.
 */
export const MITCHELL_DEWITT_PRODUCTION_STANDARD: BlueprintAcceptanceStandard = {
  id: "mitchell-dewitt-production-v1",
  minGraphConfidence: 0.82,
  minValidationScore: 0.82,
  minWallTopology: 0.8,
  minExteriorClosure: 0.75,
  minScaleConfidence: 0.9,
  minSemanticCoverage: 0.7,
  minRooms: 6,
  minOpenings: 6,
  requireReconstructedStatus: true,
  maxErrorIssues: 0,
};

export type BlueprintAcceptanceReport = {
  standardId: string;
  passed: boolean;
  checks: Record<string, boolean>;
  metrics: Record<string, number>;
  failures: string[];
};

export function evaluateMitchellDewittProductionAcceptance(
  graph: BosBuildingGraph,
  standard: BlueprintAcceptanceStandard = MITCHELL_DEWITT_PRODUCTION_STANDARD,
): BlueprintAcceptanceReport {
  const legacy = runBuildingGraphBenchmark(graph, MITCHELL_DEWITT_FIRST_FLOOR);
  const errorIssues = graph.validation.issues.filter((issue) => issue.severity === "error").length;

  const checks: Record<string, boolean> = {
    legacyBenchmark: legacy.passed,
    graphConfidence: graph.confidence >= standard.minGraphConfidence,
    validationScore: graph.validation.score >= standard.minValidationScore,
    wallTopology: graph.validation.metrics.wallTopology >= standard.minWallTopology,
    exteriorClosure: graph.validation.metrics.exteriorClosure >= standard.minExteriorClosure,
    scaleConfidence: graph.validation.metrics.scaleConfidence >= standard.minScaleConfidence,
    semanticCoverage: graph.validation.metrics.semanticCoverage >= standard.minSemanticCoverage,
    roomCoverage: graph.rooms.length >= standard.minRooms,
    openingCoverage: graph.openings.length >= standard.minOpenings,
    reconstructedStatus: !standard.requireReconstructedStatus || graph.validation.status === "reconstructed",
    noErrorIssues: errorIssues <= standard.maxErrorIssues,
  };

  const failures = Object.entries(checks)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);

  return {
    standardId: standard.id,
    passed: failures.length === 0,
    checks,
    failures,
    metrics: {
      graphConfidence: graph.confidence,
      validationScore: graph.validation.score,
      wallTopology: graph.validation.metrics.wallTopology,
      exteriorClosure: graph.validation.metrics.exteriorClosure,
      scaleConfidence: graph.validation.metrics.scaleConfidence,
      semanticCoverage: graph.validation.metrics.semanticCoverage,
      rooms: graph.rooms.length,
      openings: graph.openings.length,
      errorIssues,
      legacyTopologyClosure: legacy.metrics.topologyClosure,
      footprintComplexity: legacy.metrics.footprintComplexity,
    },
  };
}
