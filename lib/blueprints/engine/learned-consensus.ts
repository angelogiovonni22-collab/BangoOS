import type { BosBuildingGraph, BosLine2, BosPoint2 } from "./building-graph";
import type { BlueprintInferenceResponse } from "./python-inference";

export type LearnedConsensusResult = {
  status: "reject" | "review" | "promotion_candidate";
  score: number;
  metrics: {
    deterministicWallCoverage: number;
    learnedWallPrecision: number;
    roomCentroidAgreement: number;
    learnedConfidence: number;
  };
  reasons: string[];
};

const MAX_WALL_MIDPOINT_DISTANCE_M = 0.45;
const MAX_WALL_ANGLE_DELTA_RAD = Math.PI / 18; // 10 degrees
const PROMOTION_THRESHOLD = 0.82;
const REVIEW_THRESHOLD = 0.6;

function clamp(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function midpoint(line: BosLine2): BosPoint2 {
  return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
}

function lineAngle(line: BosLine2) {
  let angle = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (angle < 0) angle += Math.PI;
  while (angle >= Math.PI) angle -= Math.PI;
  return angle;
}

function angleDelta(left: BosLine2, right: BosLine2) {
  const delta = Math.abs(lineAngle(left) - lineAngle(right));
  return Math.min(delta, Math.PI - delta);
}

function wallMatches(left: BosLine2, right: BosLine2) {
  const a = midpoint(left);
  const b = midpoint(right);
  const distance = Math.hypot(a.x - b.x, a.y - b.y);
  return distance <= MAX_WALL_MIDPOINT_DISTANCE_M && angleDelta(left, right) <= MAX_WALL_ANGLE_DELTA_RAD;
}

function ratioMatched(source: BosLine2[], target: BosLine2[]) {
  if (source.length === 0) return target.length === 0 ? 1 : 0;
  const matched = source.filter((line) => target.some((candidate) => wallMatches(line, candidate))).length;
  return matched / source.length;
}

function polygonCentroid(points: BosPoint2[]) {
  if (points.length === 0) return { x: 0, y: 0 };
  return points.reduce((acc, point) => ({ x: acc.x + point.x / points.length, y: acc.y + point.y / points.length }), { x: 0, y: 0 });
}

function pointInPolygon(point: BosPoint2, polygon: BosPoint2[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i];
    const b = polygon[j];
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / ((b.y - a.y) || Number.EPSILON) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

function roomCentroidAgreement(graph: BosBuildingGraph, inference: BlueprintInferenceResponse) {
  if (inference.rooms.length === 0) return graph.rooms.length === 0 ? 1 : 0;
  if (graph.rooms.length === 0) return 0;
  const learnedCentroids = inference.rooms.map((room) => polygonCentroid(room.points.map(([x, y]) => ({ x, y }))));
  const deterministicPolygons = graph.rooms.map((room) => room.polygon.points);
  const supported = learnedCentroids.filter((center) => deterministicPolygons.some((polygon) => pointInPolygon(center, polygon))).length;
  return supported / learnedCentroids.length;
}

/**
 * Scores learned geometry against the existing evidence-backed Building Graph.
 * It never mutates graph geometry. A promotion_candidate still requires a later,
 * object-level merge gate before learned geometry can enter the canonical graph.
 */
export function scoreLearnedInferenceAgainstGraph(
  graph: BosBuildingGraph,
  inference: BlueprintInferenceResponse,
): LearnedConsensusResult {
  const reasons: string[] = [];
  if (graph.building.sourceVersionId && graph.building.sourceVersionId !== inference.source_version_id) {
    return {
      status: "reject",
      score: 0,
      metrics: { deterministicWallCoverage: 0, learnedWallPrecision: 0, roomCentroidAgreement: 0, learnedConfidence: 0 },
      reasons: ["source_version_mismatch"],
    };
  }
  if (graph.metadata.sourcePage !== inference.source_page) {
    return {
      status: "reject",
      score: 0,
      metrics: { deterministicWallCoverage: 0, learnedWallPrecision: 0, roomCentroidAgreement: 0, learnedConfidence: 0 },
      reasons: ["source_page_mismatch"],
    };
  }

  const deterministicWalls = graph.walls.map((wall) => wall.centerline);
  const learnedWalls = inference.walls.map((wall) => ({
    start: { x: wall.start[0], y: wall.start[1] },
    end: { x: wall.end[0], y: wall.end[1] },
  }));
  const deterministicWallCoverage = ratioMatched(deterministicWalls, learnedWalls);
  const learnedWallPrecision = ratioMatched(learnedWalls, deterministicWalls);
  const centroidAgreement = roomCentroidAgreement(graph, inference);
  const learnedConfidence = clamp(inference.consensus_confidence);

  const score = clamp(
    deterministicWallCoverage * 0.4 +
    learnedWallPrecision * 0.3 +
    centroidAgreement * 0.15 +
    learnedConfidence * 0.15,
  );

  if (deterministicWallCoverage < 0.65) reasons.push("insufficient_deterministic_wall_coverage");
  if (learnedWallPrecision < 0.65) reasons.push("insufficient_learned_wall_precision");
  if (learnedConfidence < 0.7) reasons.push("insufficient_model_confidence");
  if (graph.validation.metrics.scaleConfidence < 0.7) reasons.push("deterministic_scale_not_trusted");

  const hardGatePassed = reasons.length === 0;
  const status = hardGatePassed && score >= PROMOTION_THRESHOLD
    ? "promotion_candidate"
    : score >= REVIEW_THRESHOLD
      ? "review"
      : "reject";

  return {
    status,
    score,
    metrics: {
      deterministicWallCoverage,
      learnedWallPrecision,
      roomCentroidAgreement: centroidAgreement,
      learnedConfidence,
    },
    reasons,
  };
}
