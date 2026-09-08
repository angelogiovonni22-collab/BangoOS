import { clampBosConfidence, type BosBuildingGraph, type BosValidationIssue, type BosValidationReport } from "./building-graph";
import { footprintComplexity, topologyMetrics } from "./geometry";

export type BosValidationThresholds = {
  reconstructedScore: number;
  reviewScore: number;
  minExteriorWalls: number;
  minTotalWalls: number;
  minScaleConfidence: number;
  minClosure: number;
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
  const topology = topologyMetrics(perimeterSource.map((wall) => wall.centerline));
  const complexity = footprintComplexity(perimeterSource.map((wall) => wall.centerline));

  if (graph.levels.length === 0) issues.push(issue("NO_LEVEL", "error", "No reconstructed building level is present."));
  if (graph.walls.length < thresholds.minTotalWalls) {
    issues.push(issue("WALL_UNDERTRACE", "error", `Only ${graph.walls.length} wall segments were reconstructed; the plan is likely under-traced.`));
  }
  if (exterior.length > 0 && exterior.length < thresholds.minExteriorWalls) {
    issues.push(issue("EXTERIOR_UNDERTRACE", "error", `Only ${exterior.length} exterior wall segments were reconstructed.`));
  }
  if (topology.closure < thresholds.minClosure) {
    issues.push(issue("OPEN_TOPOLOGY", "warning", "The reconstructed wall topology contains too many dangling endpoints."));
  }
  if (graph.scale.confidence < thresholds.minScaleConfidence || !graph.scale.drawingUnitsPerMeter) {
    issues.push(issue("LOW_SCALE_CONFIDENCE", "warning", "Drawing scale is missing or insufficiently verified."));
  }
  if (graph.walls.length === 4 && complexity < 0.12) {
    issues.push(issue("RECTANGLE_SIMPLIFICATION", "error", "The reconstruction collapsed to a four-wall rectangle and must be reviewed against the source plan."));
  }

  const semanticCount = graph.doors.length + graph.windows.length + graph.stairs.length + graph.rooms.length + graph.decksPorches.length;
  const semanticCoverage = clampBosConfidence(semanticCount / Math.max(5, Math.ceil(graph.walls.length / 3)));
  const wallTopology = clampBosConfidence(topology.closure);
  const scaleConfidence = clampBosConfidence(graph.scale.confidence);
  const exteriorClosure = exterior.length ? clampBosConfidence(topologyMetrics(exterior.map((wall) => wall.centerline)).closure) : wallTopology * 0.75;
  const footprint = clampBosConfidence(complexity);
  const score = clampBosConfidence(
    exteriorClosure * 0.3 +
    wallTopology * 0.25 +
    scaleConfidence * 0.2 +
    semanticCoverage * 0.15 +
    Math.min(1, graph.walls.length / 16) * 0.1,
  );

  const hasError = issues.some((item) => item.severity === "error");
  let status: BosValidationReport["status"];
  if (graph.walls.length === 0) status = "failed";
  else if (!hasError && score >= thresholds.reconstructedScore) status = "reconstructed";
  else if (score >= thresholds.reviewScore) status = "needs_review";
  else status = "needs_input";

  return {
    version: 1,
    score,
    status,
    metrics: {
      exteriorClosure,
      footprintComplexity: footprint,
      wallTopology,
      scaleConfidence,
      semanticCoverage,
    },
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
