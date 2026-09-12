import type { BosDimension, BosLine2, BosPoint2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";

export type BosRasterDimensionEvidenceAssociation = {
  dimensionId: string;
  sourceSegmentId: string;
  sourceSegmentIds: string[];
  start: BosPoint2;
  end: BosPoint2;
  orientation: "horizontal" | "vertical";
  evidenceMode: "single_segment" | "label_gap_chain";
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
  singleSegmentAssociationCount: number;
  labelGapChainAssociationCount: number;
  diagnostics: string[];
};

export type BosRasterDimensionEvidenceAssociationOptions = {
  maxRelativeLengthError?: number;
  maxLabelDistanceMeters?: number;
  witnessEndpointToleranceMeters?: number;
  witnessAngleToleranceRadians?: number;
  ambiguityScoreGap?: number;
  chainCollinearToleranceMeters?: number;
  chainLabelGapPaddingMeters?: number;
};

type AxisCandidate = {
  segment: BosLine2;
  sourceSegmentId: string;
  sourceSegmentIds: string[];
  segmentOrientation: "horizontal" | "vertical";
  evidenceMode: "single_segment" | "label_gap_chain";
  relativeLengthError: number;
  labelDistanceMeters: number;
  score: number;
};

function distance(a: BosPoint2, b: BosPoint2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function length(line: BosLine2) { return distance(line.start, line.end); }
function midpoint(line: BosLine2) { return { x: (line.start.x + line.end.x) / 2, y: (line.start.y + line.end.y) / 2 }; }
function orientation(line: BosLine2): "horizontal" | "vertical" {
  return Math.abs(line.end.x - line.start.x) >= Math.abs(line.end.y - line.start.y) ? "horizontal" : "vertical";
}
function angle(line: BosLine2) {
  let value = Math.atan2(line.end.y - line.start.y, line.end.x - line.start.x);
  while (value < 0) value += Math.PI;
  while (value >= Math.PI) value -= Math.PI;
  return value;
}
function angleDelta(a: number, b: number) { const raw = Math.abs(a - b); return Math.min(raw, Math.PI - raw); }
function pointLineDistance(point: BosPoint2, line: BosLine2) {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  const denom = Math.hypot(dx, dy);
  if (denom <= Number.EPSILON) return distance(point, line.start);
  return Math.abs(dy * point.x - dx * point.y + line.end.x * line.start.y - line.end.y * line.start.x) / denom;
}
function nearestEndpointDistance(point: BosPoint2, line: BosLine2) { return Math.min(distance(point, line.start), distance(point, line.end)); }

function dimensionLabel(dimension: BosDimension, drawingUnitsPerMeter: number) {
  const bbox = dimension.evidence.find((evidence) => evidence.bbox)?.bbox;
  if (!bbox) return null;
  const horizontal = Math.abs(bbox.width) >= Math.abs(bbox.height);
  return {
    center: { x: (bbox.x + bbox.width / 2) / drawingUnitsPerMeter, y: (bbox.y + bbox.height / 2) / drawingUnitsPerMeter },
    orientation: horizontal ? "horizontal" as const : "vertical" as const,
    aspectRatio: Math.max(Math.abs(bbox.width), Math.abs(bbox.height)) / Math.max(1, Math.min(Math.abs(bbox.width), Math.abs(bbox.height))),
    alongSpanMeters: Math.max(Math.abs(horizontal ? bbox.width : bbox.height) / drawingUnitsPerMeter, 0.05),
  };
}

function normalizedSegment(segment: BosRawSegment): BosRawSegment {
  const horizontal = orientation(segment) === "horizontal";
  if (horizontal) return segment.start.x <= segment.end.x ? segment : { ...segment, start: { ...segment.end }, end: { ...segment.start } };
  return segment.start.y <= segment.end.y ? segment : { ...segment, start: { ...segment.end }, end: { ...segment.start } };
}

function sourceId(segment: BosRawSegment, index: number, page: number) {
  return segment.sourceObjectId || `raster-dimension-segment-${page}-${index}`;
}

function axisCoordinate(point: BosPoint2, axis: "horizontal" | "vertical") { return axis === "horizontal" ? point.x : point.y; }
function fixedCoordinate(point: BosPoint2, axis: "horizontal" | "vertical") { return axis === "horizontal" ? point.y : point.x; }

function witnessSupport(input: {
  endpoint: BosPoint2;
  dimensionAngle: number;
  segments: readonly BosRawSegment[];
  sourcePage: number;
  endpointTolerance: number;
  angleTolerance: number;
  excludedSourceSegmentIds: ReadonlySet<string>;
}) {
  for (let index = 0; index < input.segments.length; index += 1) {
    const segment = input.segments[index];
    const id = sourceId(segment, index, input.sourcePage);
    if (segment.sourcePage !== input.sourcePage || input.excludedSourceSegmentIds.has(id)) continue;
    const delta = angleDelta(angle(segment), input.dimensionAngle);
    if (Math.abs(delta - Math.PI / 2) > input.angleTolerance) continue;
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

function scoreCandidate(input: {
  segment: BosLine2;
  dimension: BosDimension;
  label: NonNullable<ReturnType<typeof dimensionLabel>>;
  maxRelativeLengthError: number;
  maxLabelDistanceMeters: number;
  modePenalty?: number;
}) {
  const segmentLength = length(input.segment);
  const relativeLengthError = Math.abs(segmentLength - input.dimension.value) / Math.max(input.dimension.value, 0.001);
  if (relativeLengthError > input.maxRelativeLengthError) return null;
  const labelDistanceMeters = pointLineDistance(input.label.center, input.segment);
  if (labelDistanceMeters > input.maxLabelDistanceMeters) return null;
  const midpointDistance = distance(input.label.center, midpoint(input.segment));
  if (midpointDistance > Math.max(1.25, input.dimension.value * 0.34)) return null;
  const score = relativeLengthError * 2.4
    + labelDistanceMeters / Math.max(input.maxLabelDistanceMeters, 0.001) * 0.45
    + midpointDistance / Math.max(1.25, input.dimension.value * 0.34) * 0.35
    + (input.modePenalty || 0);
  return { relativeLengthError, labelDistanceMeters, score };
}

function buildSingleCandidates(input: {
  segments: readonly BosRawSegment[];
  dimension: BosDimension;
  label: NonNullable<ReturnType<typeof dimensionLabel>>;
  maxRelativeLengthError: number;
  maxLabelDistanceMeters: number;
}) {
  return input.segments.flatMap((source, index): AxisCandidate[] => {
    if (source.sourcePage !== input.dimension.page) return [];
    const segment = normalizedSegment(source);
    const segmentOrientation = orientation(segment);
    if (input.label.aspectRatio >= 1.35 && segmentOrientation !== input.label.orientation) return [];
    const scored = scoreCandidate({ segment, dimension: input.dimension, label: input.label, maxRelativeLengthError: input.maxRelativeLengthError, maxLabelDistanceMeters: input.maxLabelDistanceMeters });
    if (!scored) return [];
    const id = sourceId(source, index, input.dimension.page);
    return [{ segment, sourceSegmentId: id, sourceSegmentIds: [id], segmentOrientation, evidenceMode: "single_segment", ...scored }];
  });
}

function buildLabelGapChainCandidates(input: {
  segments: readonly BosRawSegment[];
  dimension: BosDimension;
  label: NonNullable<ReturnType<typeof dimensionLabel>>;
  maxRelativeLengthError: number;
  maxLabelDistanceMeters: number;
  collinearToleranceMeters: number;
  labelGapPaddingMeters: number;
}) {
  const pageSegments = input.segments.map((segment, index) => ({ segment: normalizedSegment(segment), id: sourceId(segment, index, input.dimension.page) }))
    .filter((item) => item.segment.sourcePage === input.dimension.page);
  const output: AxisCandidate[] = [];
  for (let leftIndex = 0; leftIndex < pageSegments.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < pageSegments.length; rightIndex += 1) {
    const leftRaw = pageSegments[leftIndex]; const rightRaw = pageSegments[rightIndex];
    const axis = orientation(leftRaw.segment);
    if (orientation(rightRaw.segment) !== axis) continue;
    if (input.label.aspectRatio >= 1.35 && axis !== input.label.orientation) continue;
    const leftFixed = (fixedCoordinate(leftRaw.segment.start, axis) + fixedCoordinate(leftRaw.segment.end, axis)) / 2;
    const rightFixed = (fixedCoordinate(rightRaw.segment.start, axis) + fixedCoordinate(rightRaw.segment.end, axis)) / 2;
    if (Math.abs(leftFixed - rightFixed) > input.collinearToleranceMeters) continue;
    const ordered = axisCoordinate(leftRaw.segment.start, axis) <= axisCoordinate(rightRaw.segment.start, axis)
      ? [leftRaw, rightRaw] as const : [rightRaw, leftRaw] as const;
    const firstEnd = axisCoordinate(ordered[0].segment.end, axis);
    const secondStart = axisCoordinate(ordered[1].segment.start, axis);
    const gap = secondStart - firstEnd;
    if (gap < -input.collinearToleranceMeters) continue;
    if (gap > input.label.alongSpanMeters + input.labelGapPaddingMeters) continue;
    const labelAxis = axisCoordinate(input.label.center, axis);
    if (labelAxis < firstEnd - input.labelGapPaddingMeters || labelAxis > secondStart + input.labelGapPaddingMeters) continue;
    const segment: BosLine2 = { start: { ...ordered[0].segment.start }, end: { ...ordered[1].segment.end } };
    const scored = scoreCandidate({ segment, dimension: input.dimension, label: input.label, maxRelativeLengthError: input.maxRelativeLengthError, maxLabelDistanceMeters: input.maxLabelDistanceMeters, modePenalty: 0.015 });
    if (!scored) continue;
    const ids = [ordered[0].id, ordered[1].id];
    output.push({
      segment,
      sourceSegmentId: ids.join("+"),
      sourceSegmentIds: ids,
      segmentOrientation: axis,
      evidenceMode: "label_gap_chain",
      ...scored,
    });
  }
  return output;
}

/**
 * Resolves printed dimension text to source raster axes only when both measured ends have perpendicular
 * witness evidence. A dimension line split by its printed label may be reassembled only across that
 * label-bounded collinear gap; unsupported geometric gaps are never bridged.
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
  const chainCollinearToleranceMeters = input.options?.chainCollinearToleranceMeters ?? 0.06;
  const chainLabelGapPaddingMeters = input.options?.chainLabelGapPaddingMeters ?? 0.35;
  const dimensions = input.dimensions.map((dimension) => ({ ...dimension, start: dimension.start ? { ...dimension.start } : undefined, end: dimension.end ? { ...dimension.end } : undefined, evidence: [...dimension.evidence] }));
  const associations: BosRasterDimensionEvidenceAssociation[] = [];
  const unresolvedDimensionIds: string[] = [];

  for (const dimension of dimensions) {
    if (!(dimension.value > 0) || dimension.confidence < 0.7) { unresolvedDimensionIds.push(dimension.id); continue; }
    const label = dimensionLabel(dimension, input.drawingUnitsPerMeter);
    if (!label) { unresolvedDimensionIds.push(dimension.id); continue; }
    const rawCandidates = [
      ...buildSingleCandidates({ segments: input.segments, dimension, label, maxRelativeLengthError, maxLabelDistanceMeters }),
      ...buildLabelGapChainCandidates({ segments: input.segments, dimension, label, maxRelativeLengthError, maxLabelDistanceMeters, collinearToleranceMeters: chainCollinearToleranceMeters, labelGapPaddingMeters: chainLabelGapPaddingMeters }),
    ];
    const candidates = rawCandidates.flatMap((candidate): Array<AxisCandidate & { startWitnessSupport: boolean; endWitnessSupport: boolean }> => {
      const dimensionAngle = angle(candidate.segment);
      const excluded = new Set(candidate.sourceSegmentIds);
      const startWitnessSupport = witnessSupport({ endpoint: candidate.segment.start, dimensionAngle, segments: input.segments, sourcePage: dimension.page, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, excludedSourceSegmentIds: excluded });
      const endWitnessSupport = witnessSupport({ endpoint: candidate.segment.end, dimensionAngle, segments: input.segments, sourcePage: dimension.page, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, excludedSourceSegmentIds: excluded });
      if (!startWitnessSupport || !endWitnessSupport) return [];
      return [{ ...candidate, startWitnessSupport, endWitnessSupport }];
    }).sort((a, b) => a.score - b.score);

    if (!candidates.length || (candidates[1] && candidates[1].sourceSegmentId !== candidates[0].sourceSegmentId && candidates[1].score - candidates[0].score < ambiguityScoreGap)) {
      unresolvedDimensionIds.push(dimension.id);
      continue;
    }
    const best = candidates[0];
    dimension.start = { ...best.segment.start };
    dimension.end = { ...best.segment.end };
    const confidence = Math.min(dimension.confidence, Math.max(0, 1 - best.relativeLengthError * 2) * (best.evidenceMode === "single_segment" ? 0.96 : 0.93));
    dimension.confidence = confidence;
    associations.push({
      dimensionId: dimension.id,
      sourceSegmentId: best.sourceSegmentId,
      sourceSegmentIds: [...best.sourceSegmentIds],
      start: { ...best.segment.start },
      end: { ...best.segment.end },
      orientation: best.segmentOrientation,
      evidenceMode: best.evidenceMode,
      relativeLengthError: best.relativeLengthError,
      labelDistanceMeters: best.labelDistanceMeters,
      startWitnessSupport: true,
      endWitnessSupport: true,
      confidence,
    });
  }

  const singleSegmentAssociationCount = associations.filter((item) => item.evidenceMode === "single_segment").length;
  const labelGapChainAssociationCount = associations.filter((item) => item.evidenceMode === "label_gap_chain").length;
  return {
    dimensions,
    associations,
    unresolvedDimensionIds,
    singleSegmentAssociationCount,
    labelGapChainAssociationCount,
    diagnostics: [
      `Raster dimension evidence associator resolved ${associations.length} of ${dimensions.length} printed dimensions (${singleSegmentAssociationCount} single source lines, ${labelGapChainAssociationCount} label-gap chains) with two-ended witness support.`,
      `${unresolvedDimensionIds.length} dimensions remain unresolved rather than being inferred from text position alone.`,
      "Label-gap chains bridge only collinear source segments whose gap is occupied by the printed dimension label; arbitrary geometric gaps are never bridged.",
      "Resolved dimension axes are source-supported measurements only; this stage does not move wall geometry.",
    ],
  };
}
