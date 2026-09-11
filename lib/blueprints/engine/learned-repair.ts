import type { BosBuildingGraph, BosPoint2, BosWall } from "./building-graph";
import type { BlueprintInferenceResponse } from "./python-inference";
import type { LearnedConsensusResult } from "./learned-consensus";
import { classifyExteriorWalls } from "./exterior-classifier";
import { traceWallBoundedRooms } from "./room-tracing";
import { applyBosValidation } from "./validation";

const ENDPOINT_SUPPORT_M = 0.65;
const MIDPOINT_DUPLICATE_M = 0.3;
const MIN_WALL_LENGTH_M = 0.18;

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function midpoint(wall: BosWall) {
  return {
    x: (wall.centerline.start.x + wall.centerline.end.x) / 2,
    y: (wall.centerline.start.y + wall.centerline.end.y) / 2,
  };
}

function angle(wall: BosWall) {
  let value = Math.atan2(
    wall.centerline.end.y - wall.centerline.start.y,
    wall.centerline.end.x - wall.centerline.start.x,
  );
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const delta = Math.abs(a - b);
  return Math.min(delta, Math.PI - delta);
}

function supportedByExistingEndpoint(point: BosPoint2, walls: BosWall[]) {
  return walls.some((wall) =>
    distance(point, wall.centerline.start) <= ENDPOINT_SUPPORT_M ||
    distance(point, wall.centerline.end) <= ENDPOINT_SUPPORT_M,
  );
}

function duplicatesExisting(candidate: BosWall, walls: BosWall[]) {
  const center = midpoint(candidate);
  const candidateAngle = angle(candidate);
  return walls.some((wall) =>
    distance(center, midpoint(wall)) <= MIDPOINT_DUPLICATE_M &&
    angleDelta(candidateAngle, angle(wall)) <= Math.PI / 18,
  );
}

function median(values: number[], fallback: number) {
  const usable = values.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => a - b);
  if (!usable.length) return fallback;
  return usable[Math.floor(usable.length / 2)];
}

export type LearnedRepairResult = {
  graph: BosBuildingGraph;
  accepted: boolean;
  addedWallCount: number;
  reason: string;
};

/**
 * Learned geometry may repair only missing, endpoint-supported wall links after the
 * deterministic-vs-learned consensus gate reaches promotion_candidate. It never
 * deletes deterministic walls, and the repair is accepted only when validation
 * topology and total score both improve.
 */
export function applyLearnedWallRepair(
  graph: BosBuildingGraph,
  inference: BlueprintInferenceResponse,
  consensus: LearnedConsensusResult,
): LearnedRepairResult {
  if (consensus.status !== "promotion_candidate") {
    return { graph, accepted: false, addedWallCount: 0, reason: "consensus_not_promotable" };
  }
  if (graph.metadata.sourcePage !== inference.source_page || graph.building.sourceVersionId !== inference.source_version_id) {
    return { graph, accepted: false, addedWallCount: 0, reason: "source_identity_mismatch" };
  }

  const baselineWalls = graph.walls;
  const levelId = graph.levels[0]?.id || "level-1";
  const thickness = median(baselineWalls.map((wall) => wall.thickness), 0.14);
  const height = median(baselineWalls.map((wall) => wall.height), 2.44);
  const additions: BosWall[] = [];

  inference.walls.forEach((item, index) => {
    const start = { x: item.start[0], y: item.start[1] };
    const end = { x: item.end[0], y: item.end[1] };
    if (distance(start, end) < MIN_WALL_LENGTH_M) return;
    if (!supportedByExistingEndpoint(start, baselineWalls) || !supportedByExistingEndpoint(end, baselineWalls)) return;
    const candidate: BosWall = {
      id: `learned-repair-wall-${index}`,
      levelId,
      type: "unknown",
      centerline: { start, end },
      thickness,
      height,
      confidence: Math.max(0, Math.min(0.95, item.confidence * consensus.score)),
      sourcePage: inference.source_page,
      evidence: item.evidence.map((evidence, evidenceIndex) => ({
        id: `learned-repair-${index}-evidence-${evidenceIndex}`,
        page: evidence.page,
        kind: "ai" as const,
        score: evidence.confidence,
        sourceObjectId: evidence.model || "learned-inference",
      })),
      provenance: {
        createdBy: "ai_assisted",
        algorithm: "learned-wall-topology-repair",
        algorithmVersion: "1.0.0",
        evidenceIds: item.evidence.map((_, evidenceIndex) => `learned-repair-${index}-evidence-${evidenceIndex}`),
      },
    };
    if (!duplicatesExisting(candidate, [...baselineWalls, ...additions])) additions.push(candidate);
  });

  if (!additions.length) return { graph, accepted: false, addedWallCount: 0, reason: "no_supported_gap_walls" };

  const candidateGraph: BosBuildingGraph = structuredClone(graph);
  candidateGraph.walls = [...baselineWalls, ...additions];
  candidateGraph.rooms = traceWallBoundedRooms(candidateGraph);
  candidateGraph.walls = classifyExteriorWalls(candidateGraph.walls, candidateGraph.rooms);
  candidateGraph.metadata.algorithms = {
    ...candidateGraph.metadata.algorithms,
    learnedInference: "raster2seq-raster2graph-512",
    learnedTopologyRepair: "endpoint-supported-additive-1.0.0",
  };
  const validated = applyBosValidation(candidateGraph);
  const baselineScore = graph.validation.score;
  const baselineTopology = graph.validation.metrics.wallTopology;
  const improved = validated.validation.score >= baselineScore + 0.03 &&
    validated.validation.metrics.wallTopology > baselineTopology;
  if (!improved) {
    return { graph, accepted: false, addedWallCount: additions.length, reason: "validation_did_not_improve" };
  }
  return { graph: validated, accepted: true, addedWallCount: additions.length, reason: "accepted" };
}
