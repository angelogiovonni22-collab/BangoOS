import type { BosDimension, BosLine2, BosPoint2 } from "./building-graph";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosConstraintRelation =
  | "junction"
  | "parallel"
  | "orthogonal"
  | "collinear"
  | "dimension"
  | "thickness_consistency";

export type BosConstraintEvidence = {
  relation: BosConstraintRelation;
  wallIds: string[];
  confidence: number;
  residual?: number;
  dimensionId?: string;
};

export type BosGlobalConstraintResult = {
  wallSystems: BosWallSystemCandidate[];
  constraints: BosConstraintEvidence[];
  junctionCount: number;
  snappedEndpointCount: number;
  matchedDimensionCount: number;
  boundarySpanDimensionCount: number;
  singleWallDimensionCount: number;
  unresolvedDimensionIds: string[];
  thicknessMedian: number | null;
  thicknessMad: number | null;
};

export type BosGlobalConstraintOptions = {
  endpointSnapToleranceMeters?: number;
  collinearToleranceMeters?: number;
  parallelToleranceRadians?: number;
  orthogonalToleranceRadians?: number;
  dimensionMaxRelativeError?: number;
  dimensionMaxDistanceMeters?: number;
  dimensionBoundaryAlignmentToleranceMeters?: number;
  dimensionBoundaryClusterToleranceMeters?: number;
  dimensionBoundaryAmbiguityGapMeters?: number;
};

type EndpointRef = {
  wallIndex: number;
  wallId: string;
  endpoint: "start" | "end";
  point: BosPoint2;
  weight: number;
};

type BoundaryCluster = {
  coordinate: number;
  wallIds: string[];
};

function cloneSystem(system: BosWallSystemCandidate): BosWallSystemCandidate {
  return {
    ...system,
    centerline: { start: { ...system.centerline.start }, end: { ...system.centerline.end } },
    faceA: { ...system.faceA, line: { start: { ...system.faceA.line.start }, end: { ...system.faceA.line.end } } },
    faceB: { ...system.faceB, line: { start: { ...system.faceB.line.start }, end: { ...system.faceB.line.end } } },
  };
}

function distance(a: BosPoint2, b: BosPoint2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function lineLength(line: BosLine2) { return distance(line.start, line.end); }
function midpoint(line: BosLine2) { return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 }; }
function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}
function angleDelta(a: number, b: number) { const delta = Math.abs(a - b); return Math.min(delta, Math.PI - delta); }
function pointLineDistance(point: BosPoint2, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const size = Math.hypot(dx, dy);
  if (size <= Number.EPSILON) return distance(point, line.start);
  return Math.abs(dy * point.x - dx * point.y + line.end.x * line.start.y - line.end.y * line.start.x) / size;
}

class DisjointSet {
  private parent: number[];
  constructor(size: number) { this.parent = Array.from({ length: size }, (_, index) => index); }
  find(index: number): number {
    if (this.parent[index] !== index) this.parent[index] = this.find(this.parent[index]);
    return this.parent[index];
  }
  union(left: number, right: number) {
    const a = this.find(left); const b = this.find(right);
    if (a !== b) this.parent[b] = a;
  }
}

function weightedCentroid(points: EndpointRef[]) {
  const weight = points.reduce((sum, item) => sum + item.weight, 0) || 1;
  return {
    x: points.reduce((sum, item) => sum + item.point.x * item.weight, 0) / weight,
    y: points.reduce((sum, item) => sum + item.point.y * item.weight, 0) / weight,
  };
}

function median(values: number[]) {
  if (!values.length) return null;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function dimensionMidpoint(dimension: BosDimension) {
  if (!dimension.start || !dimension.end) return null;
  return midpoint({ start: dimension.start, end: dimension.end });
}
function dimensionAngle(dimension: BosDimension) {
  if (!dimension.start || !dimension.end) return null;
  return angle({ start: dimension.start, end: dimension.end });
}

function boundaryCoordinate(wall: BosWallSystemCandidate, dimensionAxis: "horizontal" | "vertical") {
  const center = midpoint(wall.centerline);
  return dimensionAxis === "horizontal" ? center.x : center.y;
}

function buildBoundaryClusters(input: {
  wallSystems: readonly BosWallSystemCandidate[];
  dimensionAngle: number;
  dimensionAxis: "horizontal" | "vertical";
  orthogonalTolerance: number;
  clusterTolerance: number;
}) {
  const eligible = input.wallSystems.filter((wall) => {
    const delta = angleDelta(angle(wall.centerline), input.dimensionAngle);
    return Math.abs(delta - Math.PI / 2) <= input.orthogonalTolerance * 2;
  }).map((wall) => ({ wall, coordinate: boundaryCoordinate(wall, input.dimensionAxis) }))
    .sort((a, b) => a.coordinate - b.coordinate);
  const clusters: BoundaryCluster[] = [];
  for (const item of eligible) {
    const current = clusters[clusters.length - 1];
    if (!current || Math.abs(item.coordinate - current.coordinate) > input.clusterTolerance) {
      clusters.push({ coordinate: item.coordinate, wallIds: [item.wall.id] });
      continue;
    }
    const count = current.wallIds.length;
    current.coordinate = (current.coordinate * count + item.coordinate) / (count + 1);
    current.wallIds.push(item.wall.id);
  }
  return clusters;
}

function nearestUniqueBoundaryCluster(input: {
  clusters: readonly BoundaryCluster[];
  coordinate: number;
  maxDistance: number;
  ambiguityGap: number;
}) {
  const ranked = input.clusters.map((cluster) => ({ cluster, distance: Math.abs(cluster.coordinate - input.coordinate) }))
    .filter((item) => item.distance <= input.maxDistance)
    .sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return null;
  if (ranked[1] && ranked[1].distance - ranked[0].distance < input.ambiguityGap) return null;
  return ranked[0];
}

/**
 * Solves only constraints supported by existing geometry. Nearby endpoint clusters are consolidated
 * into one global junction node; the solver never bridges endpoints outside the tight snap tolerance.
 * Dimensions are associated and measured globally but do not force geometry unless a later reviewed
 * optimization step explicitly authorizes that correction.
 */
export function solveGlobalWallConstraints(
  sourceSystems: readonly BosWallSystemCandidate[],
  dimensions: readonly BosDimension[] = [],
  options: BosGlobalConstraintOptions = {},
): BosGlobalConstraintResult {
  const endpointTolerance = options.endpointSnapToleranceMeters ?? 0.08;
  const collinearTolerance = options.collinearToleranceMeters ?? 0.035;
  const parallelTolerance = options.parallelToleranceRadians ?? Math.PI / 180 * 1.75;
  const orthogonalTolerance = options.orthogonalToleranceRadians ?? Math.PI / 180 * 2.5;
  const dimensionMaxRelativeError = options.dimensionMaxRelativeError ?? 0.08;
  const dimensionMaxDistance = options.dimensionMaxDistanceMeters ?? 2.5;
  const dimensionBoundaryAlignmentTolerance = options.dimensionBoundaryAlignmentToleranceMeters ?? 0.32;
  const dimensionBoundaryClusterTolerance = options.dimensionBoundaryClusterToleranceMeters ?? 0.08;
  const dimensionBoundaryAmbiguityGap = options.dimensionBoundaryAmbiguityGapMeters ?? 0.06;
  const wallSystems = sourceSystems.map(cloneSystem);
  const constraints: BosConstraintEvidence[] = [];

  const endpoints: EndpointRef[] = wallSystems.flatMap((wall, wallIndex) => [
    { wallIndex, wallId: wall.id, endpoint: "start" as const, point: { ...wall.centerline.start }, weight: Math.max(0.1, wall.confidence) },
    { wallIndex, wallId: wall.id, endpoint: "end" as const, point: { ...wall.centerline.end }, weight: Math.max(0.1, wall.confidence) },
  ]);
  const sets = new DisjointSet(endpoints.length);
  for (let left = 0; left < endpoints.length; left += 1) for (let right = left + 1; right < endpoints.length; right += 1) {
    if (endpoints[left].wallIndex === endpoints[right].wallIndex) continue;
    if (distance(endpoints[left].point, endpoints[right].point) <= endpointTolerance) sets.union(left, right);
  }

  const clusters = new Map<number, EndpointRef[]>();
  endpoints.forEach((endpoint, index) => {
    const root = sets.find(index);
    const group = clusters.get(root) || [];
    group.push(endpoint);
    clusters.set(root, group);
  });

  let snappedEndpointCount = 0;
  let junctionCount = 0;
  for (const group of clusters.values()) {
    const wallIds = [...new Set(group.map((item) => item.wallId))];
    if (wallIds.length < 2) continue;
    const centroid = weightedCentroid(group);
    const maxResidual = Math.max(...group.map((item) => distance(item.point, centroid)));
    if (maxResidual > endpointTolerance) continue;
    junctionCount += 1;
    for (const endpoint of group) {
      wallSystems[endpoint.wallIndex].centerline[endpoint.endpoint] = { ...centroid };
      snappedEndpointCount += 1;
    }
    constraints.push({ relation: "junction", wallIds, confidence: Math.max(0, 1 - maxResidual / Math.max(endpointTolerance, 0.001)), residual: maxResidual });
  }

  for (let left = 0; left < wallSystems.length; left += 1) for (let right = left + 1; right < wallSystems.length; right += 1) {
    const a = wallSystems[left]; const b = wallSystems[right];
    const delta = angleDelta(angle(a.centerline), angle(b.centerline));
    if (delta <= parallelTolerance) {
      constraints.push({ relation: "parallel", wallIds: [a.id, b.id], confidence: 1 - delta / parallelTolerance, residual: delta });
      const separation = Math.min(
        pointLineDistance(a.centerline.start, b.centerline), pointLineDistance(a.centerline.end, b.centerline),
        pointLineDistance(b.centerline.start, a.centerline), pointLineDistance(b.centerline.end, a.centerline),
      );
      if (separation <= collinearTolerance) constraints.push({ relation: "collinear", wallIds: [a.id, b.id], confidence: 1 - separation / collinearTolerance, residual: separation });
    } else if (Math.abs(delta - Math.PI / 2) <= orthogonalTolerance) {
      const residual = Math.abs(delta - Math.PI / 2);
      constraints.push({ relation: "orthogonal", wallIds: [a.id, b.id], confidence: 1 - residual / orthogonalTolerance, residual });
    }
  }

  const thicknesses = wallSystems.map((wall) => wall.thickness).filter((value) => Number.isFinite(value) && value > 0);
  const thicknessMedian = median(thicknesses);
  const thicknessMad = thicknessMedian === null ? null : median(thicknesses.map((value) => Math.abs(value - thicknessMedian)));
  if (thicknessMedian !== null && thicknessMad !== null) {
    constraints.push({ relation: "thickness_consistency", wallIds: wallSystems.map((wall) => wall.id), confidence: Math.max(0, Math.min(1, 1 - thicknessMad / Math.max(thicknessMedian, 0.001))), residual: thicknessMad });
  }

  const unresolvedDimensionIds: string[] = [];
  let matchedDimensionCount = 0;
  let boundarySpanDimensionCount = 0;
  let singleWallDimensionCount = 0;
  for (const dimension of dimensions) {
    const dm = dimensionMidpoint(dimension);
    const da = dimensionAngle(dimension);
    if (!dm || da === null || !dimension.start || !dimension.end || dimension.value <= 0 || dimension.confidence < 0.7) {
      unresolvedDimensionIds.push(dimension.id);
      continue;
    }

    const dimensionAxis: "horizontal" | "vertical" = Math.abs(dimension.end.x - dimension.start.x) >= Math.abs(dimension.end.y - dimension.start.y) ? "horizontal" : "vertical";
    const boundaryClusters = buildBoundaryClusters({ wallSystems, dimensionAngle: da, dimensionAxis, orthogonalTolerance, clusterTolerance: dimensionBoundaryClusterTolerance });
    const startCoordinate = dimensionAxis === "horizontal" ? dimension.start.x : dimension.start.y;
    const endCoordinate = dimensionAxis === "horizontal" ? dimension.end.x : dimension.end.y;
    const startBoundary = nearestUniqueBoundaryCluster({ clusters: boundaryClusters, coordinate: startCoordinate, maxDistance: dimensionBoundaryAlignmentTolerance, ambiguityGap: dimensionBoundaryAmbiguityGap });
    const endBoundary = nearestUniqueBoundaryCluster({ clusters: boundaryClusters, coordinate: endCoordinate, maxDistance: dimensionBoundaryAlignmentTolerance, ambiguityGap: dimensionBoundaryAmbiguityGap });
    if (startBoundary && endBoundary && startBoundary.cluster !== endBoundary.cluster) {
      const measuredSpan = Math.abs(endBoundary.cluster.coordinate - startBoundary.cluster.coordinate);
      const relativeError = Math.abs(measuredSpan - dimension.value) / Math.max(dimension.value, 0.001);
      if (relativeError <= dimensionMaxRelativeError) {
        matchedDimensionCount += 1;
        boundarySpanDimensionCount += 1;
        constraints.push({
          relation: "dimension",
          wallIds: [...startBoundary.cluster.wallIds, ...endBoundary.cluster.wallIds],
          dimensionId: dimension.id,
          confidence: Math.min(dimension.confidence, Math.max(0, 1 - relativeError)),
          residual: measuredSpan - dimension.value,
        });
        continue;
      }
    }

    const candidates = wallSystems.flatMap((wall) => {
      const delta = angleDelta(angle(wall.centerline), da);
      if (delta > parallelTolerance * 2) return [];
      const currentLength = lineLength(wall.centerline);
      const relativeError = Math.abs(currentLength - dimension.value) / Math.max(dimension.value, 0.001);
      if (relativeError > dimensionMaxRelativeError) return [];
      const locationDistance = distance(midpoint(wall.centerline), dm);
      if (locationDistance > dimensionMaxDistance) return [];
      return [{ wall, relativeError, locationDistance, score: relativeError * 2 + locationDistance / Math.max(dimensionMaxDistance, 0.001) }];
    }).sort((a, b) => a.score - b.score);
    if (!candidates.length || (candidates[1] && candidates[1].score - candidates[0].score < 0.05)) {
      unresolvedDimensionIds.push(dimension.id);
      continue;
    }
    const best = candidates[0];
    matchedDimensionCount += 1;
    singleWallDimensionCount += 1;
    constraints.push({ relation: "dimension", wallIds: [best.wall.id], dimensionId: dimension.id, confidence: Math.min(dimension.confidence, Math.max(0, 1 - best.relativeError)), residual: lineLength(best.wall.centerline) - dimension.value });
  }

  return {
    wallSystems,
    constraints,
    junctionCount,
    snappedEndpointCount,
    matchedDimensionCount,
    boundarySpanDimensionCount,
    singleWallDimensionCount,
    unresolvedDimensionIds,
    thicknessMedian,
    thicknessMad,
  };
}
