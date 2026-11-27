import { clampBosConfidence, type BosBuildingGraph, type BosValidationIssue, type BosValidationReport } from "./building-graph";
import { footprintComplexity, topologyMetrics } from "./geometry";
import { openingAwareWallCenterlines } from "./opening-topology";

export type BosValidationThresholds = {
  reconstructedScore: number;
  reviewScore: number;
  minExteriorWalls: number;
  minTotalWalls: number;
  minScaleConfidence: number;
  minClosure: number;
};

type FidelityMetrics = BosValidationReport["metrics"] & {
  sourceAlignment?: number;
  sourceSupportedWalls?: number;
  sourceTotalWalls?: number;
};

export const DEFAULT_VALIDATION_THRESHOLDS: BosValidationThresholds = {
  reconstructedScore: 0.78,
  reviewScore: 0.52,
  minExteriorWalls: 6,
  minTotalWalls: 8,
  minScaleConfidence: 0.55,
  minClosure: 0.7,
};

function issue(code: string, severity: BosValidationIssue["severity"], message: string, objectIds?: string[]): BosValidationIssue {
  return { id: `validation-${code.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`, code, severity, message, objectIds };
}

export function validateBosBuildingGraph(
  graph: BosBuildingGraph,
  thresholds: BosValidationThresholds = DEFAULT_VALIDATION_THRESHOLDS,
): BosValidationReport {
  const issues: BosValidationIssue[] = [];
  const exterior = graph.walls.filter((wall) => wall.type === "exterior");
  const perimeterSource = exterior.length >= 3 ? exterior : graph.walls;
  const fullTopology = topologyMetrics(openingAwareWallCenterlines(graph));
  const perimeterTopology = topologyMetrics(openingAwareWallCenterlines(graph, perimeterSource));
  const complexity = footprintComplexity(perimeterSource.map((wall) => wall.centerline));
  const fidelityMetrics = graph.validation.metrics as FidelityMetrics;
  const sourceAlignment = typeof fidelityMetrics.sourceAlignment === "number"
    ? clampBosConfidence(fidelityMetrics.sourceAlignment)
    : null;

  if (graph.levels.length === 0) issues.push(issue("NO_LEVEL", "error", "No reconstructed building level is present."));
  if (graph.walls.length < thresholds.minTotalWalls) {
    issues.push(issue("WALL_UNDERTRACE", "error", `Only ${graph.walls.length} wall segments were reconstructed; the plan is likely under-traced.`));
  }
  if (exterior.length > 0 && exterior.length < thresholds.minExteriorWalls) {
    issues.push(issue("EXTERIOR_UNDERTRACE", "error", `Only ${exterior.length} exterior wall segments were reconstructed.`));
  }
  if (fullTopology.closure < thresholds.minClosure) {
    issues.push(issue("OPEN_TOPOLOGY", "warning", "The reconstructed wall topology contains too many unexplained dangling endpoints after verified door/window gaps are accounted for."));
  }
  if (graph.scale.confidence < thresholds.minScaleConfidence || !graph.scale.drawingUnitsPerMeter) {
    issues.push(issue("LOW_SCALE_CONFIDENCE", "warning", "Drawing scale is missing or insufficiently verified."));
  }
  if (graph.walls.length === 4 && complexity < 0.12) {
    issues.push(issue("RECTANGLE_SIMPLIFICATION", "error", "The reconstruction collapsed to a four-wall rectangle and must be reviewed against the source plan."));
  }
  if (sourceAlignment !== null && sourceAlignment < 0.45) {
    issues.push(issue("SOURCE_ALIGNMENT_FAILURE", "error", "The reconstructed wall geometry diverges too far from the selected source sheet to be accepted as faithful."));
  } else if (sourceAlignment !== null && sourceAlignment < 0.72) {
    issues.push(issue("LOW_SOURCE_ALIGNMENT", "warning", "The reconstructed wall geometry requires review because source-sheet alignment is below the commercial fidelity target."));
  }

  const semanticCount = graph.doors.length + graph.windows.length + graph.stairs.length + graph.rooms.length + graph.decksPorches.length;
  const semanticCoverage = clampBosConfidence(semanticCount / Math.max(5, Math.ceil(graph.walls.length / 3)));
  const wallTopology = clampBosConfidence(fullTopology.closure);
  const scaleConfidence = clampBosConfidence(graph.scale.confidence);
  const exteriorClosure = exterior.length ? clampBosConfidence(perimeterTopology.closure) : wallTopology * 0.75;
  const footprint = clampBosConfidence(complexity);
  const baseScore = clampBosConfidence(
    exteriorClosure * 0.3 +
    wallTopology * 0.25 +
    scaleConfidence * 0.2 +
    semanticCoverage * 0.15 +
    Math.min(1, graph.walls.length / 16) * 0.1,
  );
  const score = sourceAlignment === null
    ? baseScore
    : clampBosConfidence(baseScore * 0.85 + sourceAlignment * 0.15);

  const hasError = issues.some((item) => item.severity === "error");
  let status: BosValidationReport["status"];
  if (graph.walls.length === 0) status = "failed";
  else if (!hasError && score >= thresholds.reconstructedScore && (sourceAlignment === null || sourceAlignment >= 0.72)) status = "reconstructed";
  else if (score >= thresholds.reviewScore) status = "needs_review";
  else status = "needs_input";

  const metrics: FidelityMetrics = {
    exteriorClosure,
    footprintComplexity: footprint,
    wallTopology,
    scaleConfidence,
    semanticCoverage,
  };
  if (sourceAlignment !== null) metrics.sourceAlignment = sourceAlignment;
  if (typeof fidelityMetrics.sourceSupportedWalls === "number") metrics.sourceSupportedWalls = fidelityMetrics.sourceSupportedWalls;
  if (typeof fidelityMetrics.sourceTotalWalls === "number") metrics.sourceTotalWalls = fidelityMetrics.sourceTotalWalls;

  return {
    version: 1,
    score,
    status,
    metrics,
    issues,
  };
}

export function applyBosValidation(graph: BosBuildingGraph) {
  const validation = validateBosBuildingGraph(graph);
  const evidenceConfidence = graph.walls.length
    ? graph.walls.reduce((sum, wall) => sum + wall.confidence, 0) / graph.walls.length
    : 0;
  return {
    ...graph,
    validation,
    confidence: clampBosConfidence(validation.score * 0.7 + evidenceConfidence * 0.3),
  } satisfies BosBuildingGraph;
}
