import type { BosLine2 } from "./building-graph";
import { mergeCollinearSegments, type BosRawSegment } from "./geometry";

export type WallDetectionOptions = {
  minWallLength: number;
  minWallThickness: number;
  maxWallThickness: number;
  parallelToleranceRadians: number;
  minOverlapRatio: number;
};

export type WallAnnotationZone = {
  x: number;
  y: number;
  width: number;
  height: number;
  padding?: number;
};

export const DEFAULT_WALL_DETECTION_OPTIONS: WallDetectionOptions = {
  minWallLength: 0.45,
  minWallThickness: 0.07,
  maxWallThickness: 0.45,
  parallelToleranceRadians: Math.PI / 180 * 1.75,
  minOverlapRatio: 0.45,
};

function length(line: BosLine2) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const diff = Math.abs(a - b);
  return Math.min(diff, Math.PI - diff);
}

function unit(line: BosLine2) {
  const size = length(line) || 1;
  return { x: (line.end.x - line.start.x) / size, y: (line.end.y - line.start.y) / size };
}

function projection(point: { x: number; y: number }, origin: { x: number; y: number }, axis: { x: number; y: number }) {
  return (point.x - origin.x) * axis.x + (point.y - origin.y) * axis.y;
}

function pairMetrics(a: BosLine2, b: BosLine2) {
  const axis = unit(a);
  const normal = { x: -axis.y, y: axis.x };
  const origin = a.start;
  const a0 = projection(a.start, origin, axis);
  const a1 = projection(a.end, origin, axis);
  const b0 = projection(b.start, origin, axis);
  const b1 = projection(b.end, origin, axis);
  const minA = Math.min(a0, a1);
  const maxA = Math.max(a0, a1);
  const minB = Math.min(b0, b1);
  const maxB = Math.max(b0, b1);
  const overlapStart = Math.max(minA, minB);
  const overlapEnd = Math.min(maxA, maxB);
  const overlap = Math.max(0, overlapEnd - overlapStart);
  const shorter = Math.max(0.0001, Math.min(maxA - minA, maxB - minB));
  const offset0 = Math.abs(projection(b.start, origin, normal));
  const offset1 = Math.abs(projection(b.end, origin, normal));
  return { axis, normal, origin, overlapStart, overlapEnd, overlapRatio: overlap / shorter, separation: (offset0 + offset1) / 2 };
}

function midpointLine(a: BosLine2, b: BosLine2, metrics: ReturnType<typeof pairMetrics>): BosLine2 {
  const signedB = projection(b.start, metrics.origin, metrics.normal);
  const offset = signedB / 2;
  return {
    start: {
      x: metrics.origin.x + metrics.axis.x * metrics.overlapStart + metrics.normal.x * offset,
      y: metrics.origin.y + metrics.axis.y * metrics.overlapStart + metrics.normal.y * offset,
    },
    end: {
      x: metrics.origin.x + metrics.axis.x * metrics.overlapEnd + metrics.normal.x * offset,
      y: metrics.origin.y + metrics.axis.y * metrics.overlapEnd + metrics.normal.y * offset,
    },
  };
}

function wallDetectionPreference(segment: BosRawSegment) {
  const standardThickness = 0.1524;
  const thicknessPenalty = Math.abs((segment.strokeWidth || standardThickness) - standardThickness);
  return (segment.confidence || 0) * 2 + Math.min(1, length(segment) / 8) - thicknessPenalty * 2;
}

function pointInsideAnnotationZone(point: { x: number; y: number }, zone: WallAnnotationZone, extraPadding = 0) {
  const padding = (zone.padding ?? 0.3) + extraPadding;
  const minX = zone.x - padding;
  const maxX = zone.x + Math.max(0, zone.width) + padding;
  const minY = zone.y - padding;
  const maxY = zone.y + Math.max(0, zone.height) + padding;
  return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
}

function segmentMidpoint(segment: BosRawSegment) {
  return {
    x: (segment.start.x + segment.end.x) / 2,
    y: (segment.start.y + segment.end.y) / 2,
  };
}

export function suppressDimensionAnnotationDetections(
  input: BosRawSegment[],
  zones: readonly WallAnnotationZone[],
) {
  if (!zones.length) return input;
  const maxAnnotationCandidateLength = 1.2;
  const maxWitnessCandidateLength = 2.4;
  const maxWitnessThickness = 0.12;

  return input.filter((segment) => {
    const candidateLength = length(segment);
    if (
      candidateLength <= maxAnnotationCandidateLength
      && zones.some((zone) => pointInsideAnnotationZone(segment.start, zone) && pointInsideAnnotationZone(segment.end, zone))
    ) {
      return false;
    }

    // Dimension witness/extension pairs can survive the label-box filter because one endpoint sits
    // just outside the text bbox. Only suppress a second, deliberately narrow class: short paired
    // lines whose inferred separation remains at or below a light partition thickness and whose
    // midpoint plus one endpoint stay anchored to dimension-label evidence. This keeps normal long
    // architectural walls while removing A4-style dimension witnesses that otherwise become walls.
    if (candidateLength > maxWitnessCandidateLength) return true;
    if (segment.strokeWidth === undefined || segment.strokeWidth > maxWitnessThickness) return true;
    const midpoint = segmentMidpoint(segment);
    const witnessArtifact = zones.some((zone) =>
      pointInsideAnnotationZone(midpoint, zone, 0.35)
      && (
        pointInsideAnnotationZone(segment.start, zone, 0.15)
        || pointInsideAnnotationZone(segment.end, zone, 0.15)
      ),
    );
    return !witnessArtifact;
  });
}

export function suppressNestedWallDetections(
  input: BosRawSegment[],
  options: WallDetectionOptions = DEFAULT_WALL_DETECTION_OPTIONS,
) {
  const ordered = [...input].sort((a, b) => wallDetectionPreference(b) - wallDetectionPreference(a));
  const selected: BosRawSegment[] = [];
  const centerlineTolerance = Math.min(0.18, options.maxWallThickness * 0.5);

  for (const candidate of ordered) {
    const duplicate = selected.some((current) => {
      if (angleDelta(angle(candidate), angle(current)) > options.parallelToleranceRadians * 1.5) return false;
      const metrics = pairMetrics(current, candidate);
      return metrics.overlapRatio >= 0.72 && metrics.separation <= centerlineTolerance;
    });
    if (!duplicate) selected.push(candidate);
  }
  return selected;
}

/**
 * Rasterized plan sheets often turn stair treads, railings and framing hatch into dense families
 * of short parallel paired-line detections. A real wall can be short or thick, but it should not
 * normally appear as four or more almost-identical centerlines packed into one narrow band.
 * Keep this deliberately conservative and raster-only so repeated real partitions remain intact.
 */
export function suppressRepetitiveRasterWallArtifacts(
  input: BosRawSegment[],
  options: WallDetectionOptions = DEFAULT_WALL_DETECTION_OPTIONS,
) {
  if (input.length < 4) return input;
  const minArtifactThickness = 0.07;
  const maxArtifactLength = 1.5;
  const maxFamilySeparation = 1.05;
  const minFamilySize = 4;

  return input.filter((candidate, candidateIndex) => {
    const candidateLength = length(candidate);
    const rasterDerived = (candidate.sourceObjectId || "").includes("raster-");
    if (!rasterDerived || candidateLength > maxArtifactLength || (candidate.strokeWidth || 0) < minArtifactThickness) return true;

    let familySize = 1;
    for (let index = 0; index < input.length; index += 1) {
      if (index === candidateIndex) continue;
      const other = input[index];
      const otherLength = length(other);
      if (!(other.sourceObjectId || "").includes("raster-")) continue;
      if (otherLength > maxArtifactLength || (other.strokeWidth || 0) < minArtifactThickness) continue;
      if (angleDelta(angle(candidate), angle(other)) > options.parallelToleranceRadians * 1.75) continue;
      const lengthRatio = otherLength / Math.max(candidateLength, 0.0001);
      if (lengthRatio < 0.62 || lengthRatio > 1.62) continue;
      const metrics = pairMetrics(candidate, other);
      if (metrics.overlapRatio < 0.55 || metrics.separation > maxFamilySeparation) continue;
      familySize += 1;
      if (familySize >= minFamilySize) return false;
    }
    return true;
  });
}

function finiteProjection(point: { x: number; y: number }, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return null;
  const parameter = ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) / lengthSquared;
  if (parameter < 0 || parameter > 1) return null;
  const projected = { x: line.start.x + parameter * dx, y: line.start.y + parameter * dy };
  return { projected, distance: Math.hypot(projected.x - point.x, projected.y - point.y) };
}

/**
 * Reject very short raster-only fragments that do not touch a credible longer wall run. This runs
 * after collinear merging, so a real wall drawn as several short pieces first gets a chance to
 * become a structural segment. The filter is intentionally limited to sub-780 mm fragments;
 * short exterior jogs or partitions that meet a longer wall are preserved.
 */
export function suppressUnsupportedShortRasterFragments(input: BosRawSegment[]) {
  if (input.length < 2) return input;
  const maxFragmentLength = 0.78;
  const anchorMinLength = 1.5;
  const supportTolerance = 0.22;
  const anchors = input.filter((segment) => length(segment) >= anchorMinLength);
  if (!anchors.length) return input;

  return input.filter((candidate) => {
    const rasterDerived = (candidate.sourceObjectId || "").includes("raster-");
    if (!rasterDerived || length(candidate) >= maxFragmentLength) return true;
    return [candidate.start, candidate.end].some((endpoint) => anchors.some((anchor) => {
      if (anchor === candidate) return false;
      const projected = finiteProjection(endpoint, anchor);
      return Boolean(projected && projected.distance <= supportTolerance);
    }));
  });
}

/**
 * Close small raster/vector endpoint misses at clear non-parallel wall junctions. This only moves
 * a dangling endpoint onto an existing finite wall segment and never bridges empty space between
 * unrelated parallel walls.
 */
export function repairDetectedWallJunctions(input: BosRawSegment[], tolerance = 0.18) {
  if (input.length < 2) return input;
  return input.map((segment, segmentIndex) => {
    const repairEndpoint = (point: { x: number; y: number }) => {
      let best: { x: number; y: number; distance: number } | null = null;
      for (let index = 0; index < input.length; index += 1) {
        if (index === segmentIndex) continue;
        const other = input[index];
        const orientationDelta = angleDelta(angle(segment), angle(other));
        if (orientationDelta < Math.PI / 6) continue;
        const projected = finiteProjection(point, other);
        if (!projected || projected.distance <= 0.005 || projected.distance > tolerance) continue;
        if (!best || projected.distance < best.distance) best = { ...projected.projected, distance: projected.distance };
      }
      return best ? { x: best.x, y: best.y } : point;
    };
    return {
      ...segment,
      start: repairEndpoint(segment.start),
      end: repairEndpoint(segment.end),
    };
  }).filter((segment) => length(segment) >= DEFAULT_WALL_DETECTION_OPTIONS.minWallLength);
}

export function detectWallCenterlines(
  source: BosRawSegment[],
  options: WallDetectionOptions = DEFAULT_WALL_DETECTION_OPTIONS,
): BosRawSegment[] {
  const candidates = source.filter((segment) => length(segment) >= options.minWallLength);
  const detections: BosRawSegment[] = [];

  // Spatial buckets keep paired-line detection bounded on dense architectural PDFs.
  const bucketSize = 2;
  const buckets = new Map<string, number[]>();
  const keysFor = (segment: BosLine2) => {
    const minX = Math.floor(Math.min(segment.start.x, segment.end.x) / bucketSize);
    const maxX = Math.floor(Math.max(segment.start.x, segment.end.x) / bucketSize);
    const minY = Math.floor(Math.min(segment.start.y, segment.end.y) / bucketSize);
    const maxY = Math.floor(Math.max(segment.start.y, segment.end.y) / bucketSize);
    const keys: string[] = [];
    for (let x = minX; x <= maxX; x += 1) for (let y = minY; y <= maxY; y += 1) keys.push(`${x}:${y}`);
    return keys;
  };

  candidates.forEach((segment, index) => {
    for (const key of keysFor(segment)) {
      const bucket = buckets.get(key) || [];
      bucket.push(index);
      buckets.set(key, bucket);
    }
  });

  const visited = new Set<string>();
  for (const indices of buckets.values()) {
    for (let ai = 0; ai < indices.length; ai += 1) {
      for (let bi = ai + 1; bi < indices.length; bi += 1) {
        const aIndex = indices[ai];
        const bIndex = indices[bi];
        if (aIndex === bIndex) continue;
        const pairKey = aIndex < bIndex ? `${aIndex}:${bIndex}` : `${bIndex}:${aIndex}`;
        if (visited.has(pairKey)) continue;
        visited.add(pairKey);
        const a = candidates[aIndex];
        const b = candidates[bIndex];
        if (angleDelta(angle(a), angle(b)) > options.parallelToleranceRadians) continue;
        const metrics = pairMetrics(a, b);
        if (metrics.overlapRatio < options.minOverlapRatio) continue;
        if (metrics.separation < options.minWallThickness || metrics.separation > options.maxWallThickness) continue;
        const centerline = midpointLine(a, b, metrics);
        if (length(centerline) < options.minWallLength) continue;
        detections.push({
          ...centerline,
          sourcePage: a.sourcePage,
          sourceObjectId: `${a.sourceObjectId || "vector"}+${b.sourceObjectId || "vector"}`,
          strokeWidth: metrics.separation,
          confidence: Math.min(0.98, 0.68 + metrics.overlapRatio * 0.22 + Math.min(0.08, length(centerline) / 100)),
        });
      }
    }
  }

  const deduplicated = suppressNestedWallDetections(detections, options);
  const structural = suppressRepetitiveRasterWallArtifacts(deduplicated, options);
  const merged = mergeCollinearSegments(structural, {
    snapTolerance: 0.08,
    collinearToleranceRadians: Math.PI / 180 * 2,
    minLength: options.minWallLength,
    wallThickness: 0.1524,
    wallHeight: 2.4384,
  });
  const anchored = suppressUnsupportedShortRasterFragments(merged);
  return repairDetectedWallJunctions(anchored);
}

export function scaleSegmentsToMeters(segments: BosRawSegment[], drawingUnitsPerMeter: number): BosRawSegment[] {
  if (!Number.isFinite(drawingUnitsPerMeter) || drawingUnitsPerMeter <= 0) throw new Error("A verified drawing scale is required before vector geometry can be converted to meters.");
  const factor = 1 / drawingUnitsPerMeter;
  return segments.map((segment) => ({
    ...segment,
    start: { x: segment.start.x * factor, y: segment.start.y * factor },
    end: { x: segment.end.x * factor, y: segment.end.y * factor },
    strokeWidth: segment.strokeWidth === undefined ? undefined : segment.strokeWidth * factor,
  }));
}
