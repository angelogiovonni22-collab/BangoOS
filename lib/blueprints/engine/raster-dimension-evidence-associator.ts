import type { BosDimension, BosLine2, BosPoint2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";

export type BosRasterDimensionEvidenceAssociation = {
  dimensionId: string;
  sourceSegmentId: string;
  start: BosPoint2;
  end: BosPoint2;
  orientation: "horizontal" | "vertical";
  relativeLengthError: number;
  labelDistanceMeters: number;
  startWitnessSupport: boolean;
  endWitnessSupport: boolean;
  confidence: number;
};

export type BosRasterDimensionEvidenceAssociationResult = {
  dimensions: BosDimension[];
  associations: BosRasterDimensionEvidenceAssociation[];
  unresolvedDimensionIds: string[];
  diagnostics: string[];
};

export type BosRasterDimensionEvidenceAssociationOptions = {
  maxRelativeLengthError?: number;
  maxLabelDistanceMeters?: number;
  witnessEndpointToleranceMeters?: number;
  witnessAngleToleranceRadians?: number;
  ambiguityScoreGap?: number;
};

function distance(a: BosPoint2, b: BosPoint2) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function length(line: BosLine2) {
  return distance(line.start, line.end);
}

function midpoint(line: BosLine2) {
  return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 };
}

function orientation(line: BosLine2): "horizontal" | "vertical" {
  return Math.abs(line.end.x - line.start.x) >= Math.abs(line.end.y - line.start.y) ? "horizontal" : "vertical";
}

function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}

function angleDelta(a: number, b: number) {
  const raw = Math.abs(a - b);
  return Math.min(raw, Math.PI - raw);
}

function pointLineDistance(point: BosPoint2, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const denom = Math.hypot(dx, dy);
  if (denom <= Number.EPSILON) return distance(point, line.start);
  return Math.abs(dy * point.x - dx * point.y + line.end.x * line.start.y - line.end.y * line.start.x) / denom;
}

function nearestEndpointDistance(point: BosPoint2, line: BosLine2) {
  return Math.min(distance(point, line.start), distance(point, line.end));
}

function dimensionLabel(dimension: BosDimension, drawingUnitsPerMeter: number) {
  const bbox = dimension.evidence.find((evidence) => evidence.bbox)?.bbox;
  if (!bbox) return null;
  return {
    center: {
      x: (bbox.x + bbox.width / 2) / drawingUnitsPerMeter,
      y: (bbox.y + bbox.height / 2) / drawingUnitsPerMeter,
    },
    orientation: Math.abs(bbox.width) >= Math.abs(bbox.height) ? "horizontal" as const : "vertical" as const,
    aspectRatio: Math.max(Math.abs(bbox.width), Math.abs(bbox.height)) / Math.max(1, Math.min(Math.abs(bbox.width), Math.abs(bbox.height))),
  };
}

function normalizedSegment(segment: BosRawSegment) {
  const horizontal = orientation(segment) === "horizontal";
  if (horizontal) {
    return segment.start.x <= segment.end.x ? segment : { ...segment, start: segment.end, end: segment.start };
  }
  return segment.start.y <= segment.end.y ? segment : { ...segment, start: segment.end, end: segment.start };
}

function witnessSupport(input: {
  endpoint: BosPoint2;
  dimensionAngle: number;
  segments: readonly BosRawSegment[];
  sourcePage: number;
  endpointTolerance: number;
  angleTolerance: number;
  sourceSegmentId: string;
}) {
  for (const segment of input.segments) {
    if (segment.sourcePage !== input.sourcePage || segment.sourceObjectId === input.sourceSegmentId) continue;
    const delta = angleDelta(angle(segment), input.dimensionAngle);
    const perpendicularResidual = Math.abs(delta - Math.PI / 2);
    if (perpendicularResidual > input.angleTolerance) continue;
    if (nearestEndpointDistance(input.endpoint, segment) <= input.endpointTolerance) return true;
    if (pointLineDistance(input.endpoint, segment) <= input.endpointTolerance) {
      const minX = Math.min(segment.start.x, segment.end.x) - input.endpointTolerance;
      const maxX = Math.max(segment.start.x, segment.end.x) + input.endpointTolerance;
      const minY = Math.min(segment.start.y, segment.end.y) - input.endpointTolerance;
      const maxY = Math.max(segment.start.y, segment.end.y) + input.endpointTolerance;
      if (input.endpoint.x >= minX && input.endpoint.x <= maxX && input.endpoint.y >= minY && input.endpoint.y <= maxY) return true;
    }
  }
  return false;
}

/**
 * Resolves printed dimension text to an actual raster dimension line only when source geometry supports
 * both ends with perpendicular witness evidence. It never fabricates an axis from the text box alone.
 */
export function associateRasterDimensionEvidence(input: {
  segments: readonly BosRawSegment[];
  dimensions: readonly BosDimension[];
  drawingUnitsPerMeter: number;
  options?: BosRasterDimensionEvidenceAssociationOptions;
}): BosRasterDimensionEvidenceAssociationResult {
  if (!(input.drawingUnitsPerMeter > 0)) throw new Error("Raster dimension evidence association requires a verified drawing scale.");
  const maxRelativeLengthError = input.options?.maxRelativeLengthError ?? 0.14;
  const maxLabelDistanceMeters = input.options?.maxLabelDistanceMeters ?? 0.9;
  const witnessEndpointToleranceMeters = input.options?.witnessEndpointToleranceMeters ?? 0.24;
  const witnessAngleToleranceRadians = input.options?.witnessAngleToleranceRadians ?? Math.PI / 180 * 7;
  const ambiguityScoreGap = input.options?.ambiguityScoreGap ?? 0.08;
  const dimensions = input.dimensions.map((dimension) => ({ ...dimension, start: dimension.start ? { ...dimension.start } : undefined, end: dimension.end ? { ...dimension.end } : undefined, evidence: [...dimension.evidence] }));
  const associations: BosRasterDimensionEvidenceAssociation[] = [];
  const unresolvedDimensionIds: string[] = [];

  for (const dimension of dimensions) {
    if (!(dimension.value > 0) || dimension.confidence < 0.7) {
      unresolvedDimensionIds.push(dimension.id);
      continue;
    }
    const label = dimensionLabel(dimension, input.drawingUnitsPerMeter);
    if (!label) {
      unresolvedDimensionIds.push(dimension.id);
      continue;
    }
    const candidates = input.segments.flatMap((source, index) => {
      if (source.sourcePage !== dimension.page) return [];
      const segment = normalizedSegment(source);
      const segmentOrientation = orientation(segment);
      if (label.aspectRatio >= 1.35 && segmentOrientation !== label.orientation) return [];
      const segmentLength = length(segment);
      const relativeLengthError = Math.abs(segmentLength - dimension.value) / Math.max(dimension.value, 0.001);
      if (relativeLengthError > maxRelativeLengthError) return [];
      const labelDistanceMeters = pointLineDistance(label.center, segment);
      if (labelDistanceMeters > maxLabelDistanceMeters) return [];
      const midpointDistance = distance(label.center, midpoint(segment));
      if (midpointDistance > Math.max(1.25, dimension.value * 0.34)) return [];
      const dimensionAngle = angle(segment);
      const sourceSegmentId = source.sourceObjectId || `raster-dimension-segment-${dimension.page}-${index}`;
      const startWitnessSupport = witnessSupport({ endpoint: segment.start, dimensionAngle, segments: input.segments, sourcePage: dimension.page, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, sourceSegmentId });
      const endWitnessSupport = witnessSupport({ endpoint: segment.end, dimensionAngle, segments: input.segments, sourcePage: dimension.page, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, sourceSegmentId });
      if (!startWitnessSupport || !endWitnessSupport) return [];
      const score = relativeLengthError * 2.4 + labelDistanceMeters / Math.max(maxLabelDistanceMeters, 0.001) * 0.45 + midpointDistance / Math.max(1.25, dimension.value * 0.34) * 0.35;
      return [{ segment, sourceSegmentId, segmentOrientation, relativeLengthError, labelDistanceMeters, startWitnessSupport, endWitnessSupport, score }];
    }).sort((a, b) => a.score - b.score);

    if (!candidates.length || (candidates[1] && candidates[1].score - candidates[0].score < ambiguityScoreGap)) {
      unresolvedDimensionIds.push(dimension.id);
      continue;
    }
    const best = candidates[0];
    dimension.start = { ...best.segment.start };
    dimension.end = { ...best.segment.end };
    const confidence = Math.min(dimension.confidence, Math.max(0, 1 - best.relativeLengthError * 2) * 0.96);
    dimension.confidence = confidence;
    associations.push({
      dimensionId: dimension.id,
      sourceSegmentId: best.sourceSegmentId,
      start: { ...best.segment.start },
      end: { ...best.segment.end },
      orientation: best.segmentOrientation,
      relativeLengthError: best.relativeLengthError,
      labelDistanceMeters: best.labelDistanceMeters,
      startWitnessSupport: true,
      endWitnessSupport: true,
      confidence,
    });
  }

  return {
    dimensions,
    associations,
    unresolvedDimensionIds,
    diagnostics: [
      `Raster dimension evidence associator resolved ${associations.length} of ${dimensions.length} printed dimensions to unique source lines with two-ended witness support.`,
      `${unresolvedDimensionIds.length} dimensions remain unresolved rather than being inferred from text position alone.`,
      "Resolved dimension axes are source-supported measurements only; this stage does not move wall geometry.",
    ],
  };
}
