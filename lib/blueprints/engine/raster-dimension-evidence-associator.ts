import type { BosDimension, BosLine2, BosPoint2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";

export type BosRasterDimensionEvidenceMode = "single_segment" | "label_gap_chain" | "fragment_chain" | "witness_span";

export type BosRasterDimensionEvidenceAssociation = {
  dimensionId: string;
  sourceSegmentId: string;
  sourceSegmentIds: string[];
  start: BosPoint2;
  end: BosPoint2;
  orientation: "horizontal" | "vertical";
  evidenceMode: BosRasterDimensionEvidenceMode;
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
  fragmentChainAssociationCount: number;
  witnessSpanAssociationCount: number;
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
  fragmentGapToleranceMeters?: number;
  maxFragmentChainSegments?: number;
  witnessSpanMinWitnessLengthMeters?: number;
  witnessSpanMaxWitnessLengthMeters?: number;
  witnessSpanBaselineAlignmentToleranceMeters?: number;
  witnessSpanLabelPaddingMeters?: number;
};

type AxisCandidate = {
  segment: BosLine2;
  sourceSegmentId: string;
  sourceSegmentIds: string[];
  segmentOrientation: "horizontal" | "vertical";
  evidenceMode: BosRasterDimensionEvidenceMode;
  relativeLengthError: number;
  labelDistanceMeters: number;
  score: number;
};

type SourceSegment = { segment: BosRawSegment; id: string };

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
function sourceId(segment: BosRawSegment, index: number, page: number) { return segment.sourceObjectId || `raster-dimension-segment-${page}-${index}`; }
function axisCoordinate(point: BosPoint2, axis: "horizontal" | "vertical") { return axis === "horizontal" ? point.x : point.y; }
function fixedCoordinate(point: BosPoint2, axis: "horizontal" | "vertical") { return axis === "horizontal" ? point.y : point.x; }
function fixedCoordinateOfLine(line: BosLine2, axis: "horizontal" | "vertical") { return (fixedCoordinate(line.start, axis) + fixedCoordinate(line.end, axis)) / 2; }

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

function pageSegments(input: { segments: readonly BosRawSegment[]; page: number }) {
  return input.segments.map((segment, index): SourceSegment => ({ segment: normalizedSegment(segment), id: sourceId(segment, index, input.page) }))
    .filter((item) => item.segment.sourcePage === input.page);
}

function buildSingleCandidates(input: {
  segments: readonly BosRawSegment[];
  dimension: BosDimension;
  label: NonNullable<ReturnType<typeof dimensionLabel>>;
  maxRelativeLengthError: number;
  maxLabelDistanceMeters: number;
}) {
  return pageSegments({ segments: input.segments, page: input.dimension.page }).flatMap((source): AxisCandidate[] => {
    const segmentOrientation = orientation(source.segment);
    if (input.label.aspectRatio >= 1.35 && segmentOrientation !== input.label.orientation) return [];
    const scored = scoreCandidate({ segment: source.segment, dimension: input.dimension, label: input.label, maxRelativeLengthError: input.maxRelativeLengthError, maxLabelDistanceMeters: input.maxLabelDistanceMeters });
    if (!scored) return [];
    return [{ segment: source.segment, sourceSegmentId: source.id, sourceSegmentIds: [source.id], segmentOrientation, evidenceMode: "single_segment", ...scored }];
  });
}

function labelOccupiesGap(input: {
  gapStart: number;
  gapEnd: number;
  labelAxis: number;
  labelSpan: number;
  padding: number;
}) {
  const gap = input.gapEnd - input.gapStart;
  return gap >= 0
    && gap <= input.labelSpan + input.padding
    && input.labelAxis >= input.gapStart - input.padding
    && input.labelAxis <= input.gapEnd + input.padding;
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
  const items = pageSegments({ segments: input.segments, page: input.dimension.page });
  const output: AxisCandidate[] = [];
  for (let leftIndex = 0; leftIndex < items.length; leftIndex += 1) for (let rightIndex = leftIndex + 1; rightIndex < items.length; rightIndex += 1) {
    const leftRaw = items[leftIndex]; const rightRaw = items[rightIndex];
    const axis = orientation(leftRaw.segment);
    if (orientation(rightRaw.segment) !== axis) continue;
    if (input.label.aspectRatio >= 1.35 && axis !== input.label.orientation) continue;
    if (Math.abs(fixedCoordinateOfLine(leftRaw.segment, axis) - fixedCoordinateOfLine(rightRaw.segment, axis)) > input.collinearToleranceMeters) continue;
    const ordered = axisCoordinate(leftRaw.segment.start, axis) <= axisCoordinate(rightRaw.segment.start, axis) ? [leftRaw, rightRaw] as const : [rightRaw, leftRaw] as const;
    const firstEnd = axisCoordinate(ordered[0].segment.end, axis);
    const secondStart = axisCoordinate(ordered[1].segment.start, axis);
    const labelAxis = axisCoordinate(input.label.center, axis);
    if (!labelOccupiesGap({ gapStart: firstEnd, gapEnd: secondStart, labelAxis, labelSpan: input.label.alongSpanMeters, padding: input.labelGapPaddingMeters })) continue;
    const segment: BosLine2 = { start: { ...ordered[0].segment.start }, end: { ...ordered[1].segment.end } };
    const scored = scoreCandidate({ segment, dimension: input.dimension, label: input.label, maxRelativeLengthError: input.maxRelativeLengthError, maxLabelDistanceMeters: input.maxLabelDistanceMeters, modePenalty: 0.015 });
    if (!scored) continue;
    const ids = [ordered[0].id, ordered[1].id];
    output.push({ segment, sourceSegmentId: ids.join("+"), sourceSegmentIds: ids, segmentOrientation: axis, evidenceMode: "label_gap_chain", ...scored });
  }
  return output;
}

function buildFragmentChainCandidates(input: {
  segments: readonly BosRawSegment[];
  dimension: BosDimension;
  label: NonNullable<ReturnType<typeof dimensionLabel>>;
  maxRelativeLengthError: number;
  maxLabelDistanceMeters: number;
  collinearToleranceMeters: number;
  labelGapPaddingMeters: number;
  fragmentGapToleranceMeters: number;
  maxSegments: number;
}) {
  const items = pageSegments({ segments: input.segments, page: input.dimension.page })
    .filter((item) => {
      const axis = orientation(item.segment);
      if (input.label.aspectRatio >= 1.35 && axis !== input.label.orientation) return false;
      return pointLineDistance(input.label.center, item.segment) <= input.maxLabelDistanceMeters;
    });
  const output: AxisCandidate[] = [];

  for (const axis of ["horizontal", "vertical"] as const) {
    const oriented = items.filter((item) => orientation(item.segment) === axis)
      .sort((a, b) => axisCoordinate(a.segment.start, axis) - axisCoordinate(b.segment.start, axis));
    for (let startIndex = 0; startIndex < oriented.length; startIndex += 1) {
      const chain: SourceSegment[] = [oriented[startIndex]];
      let usedLabelGap = false;
      for (let nextIndex = startIndex + 1; nextIndex < oriented.length && chain.length < input.maxSegments; nextIndex += 1) {
        const previous = chain[chain.length - 1];
        const candidate = oriented[nextIndex];
        if (Math.abs(fixedCoordinateOfLine(previous.segment, axis) - fixedCoordinateOfLine(candidate.segment, axis)) > input.collinearToleranceMeters) break;
        const previousEnd = axisCoordinate(previous.segment.end, axis);
        const candidateStart = axisCoordinate(candidate.segment.start, axis);
        const gap = candidateStart - previousEnd;
        if (gap < -input.collinearToleranceMeters) continue;
        const labelAxis = axisCoordinate(input.label.center, axis);
        const isLabelGap = labelOccupiesGap({ gapStart: previousEnd, gapEnd: candidateStart, labelAxis, labelSpan: input.label.alongSpanMeters, padding: input.labelGapPaddingMeters });
        const isTinyFragmentGap = gap <= input.fragmentGapToleranceMeters;
        if (!isTinyFragmentGap && !isLabelGap) break;
        if (isLabelGap) {
          if (usedLabelGap) break;
          usedLabelGap = true;
        }
        chain.push(candidate);
        if (chain.length < 3 || !usedLabelGap) continue;
        const segment: BosLine2 = { start: { ...chain[0].segment.start }, end: { ...chain[chain.length - 1].segment.end } };
        const scored = scoreCandidate({ segment, dimension: input.dimension, label: input.label, maxRelativeLengthError: input.maxRelativeLengthError, maxLabelDistanceMeters: input.maxLabelDistanceMeters, modePenalty: 0.025 + chain.length * 0.003 });
        if (!scored) continue;
        const ids = chain.map((item) => item.id);
        output.push({ segment, sourceSegmentId: ids.join("+"), sourceSegmentIds: ids, segmentOrientation: axis, evidenceMode: "fragment_chain", ...scored });
      }
    }
  }
  return output;
}

function endpointAlongValues(line: BosLine2, witnessOrientation: "horizontal" | "vertical") {
  return witnessOrientation === "vertical" ? [line.start.y, line.end.y] : [line.start.x, line.end.x];
}

function buildWitnessSpanCandidates(input: {
  segments: readonly BosRawSegment[];
  dimension: BosDimension;
  label: NonNullable<ReturnType<typeof dimensionLabel>>;
  maxRelativeLengthError: number;
  maxLabelDistanceMeters: number;
  minWitnessLengthMeters: number;
  maxWitnessLengthMeters: number;
  baselineAlignmentToleranceMeters: number;
  labelPaddingMeters: number;
}) {
  const pageItems = pageSegments({ segments: input.segments, page: input.dimension.page });
  const output: AxisCandidate[] = [];
  const allowedDimensionAxes: Array<"horizontal" | "vertical"> = input.label.aspectRatio >= 1.35
    ? [input.label.orientation]
    : ["horizontal", "vertical"];

  for (const dimensionAxis of allowedDimensionAxes) {
    const witnessOrientation = dimensionAxis === "horizontal" ? "vertical" : "horizontal";
    const witnesses = pageItems.filter((item) => {
      if (orientation(item.segment) !== witnessOrientation) return false;
      const witnessLength = length(item.segment);
      return witnessLength >= input.minWitnessLengthMeters && witnessLength <= input.maxWitnessLengthMeters;
    }).sort((a, b) => fixedCoordinateOfLine(a.segment, witnessOrientation) - fixedCoordinateOfLine(b.segment, witnessOrientation));
    const minSpacing = input.dimension.value * (1 - input.maxRelativeLengthError);
    const maxSpacing = input.dimension.value * (1 + input.maxRelativeLengthError);

    for (let leftIndex = 0; leftIndex < witnesses.length; leftIndex += 1) {
      const left = witnesses[leftIndex];
      const leftFixed = fixedCoordinateOfLine(left.segment, witnessOrientation);
      for (let rightIndex = leftIndex + 1; rightIndex < witnesses.length; rightIndex += 1) {
        const right = witnesses[rightIndex];
        const rightFixed = fixedCoordinateOfLine(right.segment, witnessOrientation);
        const spacing = rightFixed - leftFixed;
        if (spacing < minSpacing) continue;
        if (spacing > maxSpacing) break;
        const labelAxis = axisCoordinate(input.label.center, dimensionAxis);
        if (labelAxis < leftFixed - input.labelPaddingMeters || labelAxis > rightFixed + input.labelPaddingMeters) continue;

        const leftEndpoints = endpointAlongValues(left.segment, witnessOrientation);
        const rightEndpoints = endpointAlongValues(right.segment, witnessOrientation);
        let baseline: number | null = null;
        let baselineError = Number.POSITIVE_INFINITY;
        for (const leftEndpoint of leftEndpoints) for (const rightEndpoint of rightEndpoints) {
          const alignmentError = Math.abs(leftEndpoint - rightEndpoint);
          if (alignmentError > input.baselineAlignmentToleranceMeters) continue;
          const candidateBaseline = (leftEndpoint + rightEndpoint) / 2;
          const labelPerpendicular = fixedCoordinate(input.label.center, dimensionAxis);
          const labelDistance = Math.abs(candidateBaseline - labelPerpendicular);
          if (labelDistance > input.maxLabelDistanceMeters) continue;
          const combinedError = alignmentError + labelDistance * 0.2;
          if (combinedError < baselineError) {
            baselineError = combinedError;
            baseline = candidateBaseline;
          }
        }
        if (baseline === null) continue;

        const segment: BosLine2 = dimensionAxis === "horizontal"
          ? { start: { x: leftFixed, y: baseline }, end: { x: rightFixed, y: baseline } }
          : { start: { x: baseline, y: leftFixed }, end: { x: baseline, y: rightFixed } };
        const scored = scoreCandidate({
          segment,
          dimension: input.dimension,
          label: input.label,
          maxRelativeLengthError: input.maxRelativeLengthError,
          maxLabelDistanceMeters: input.maxLabelDistanceMeters,
          modePenalty: 0.045 + Math.min(0.04, baselineError * 0.05),
        });
        if (!scored) continue;
        const ids = [left.id, right.id];
        output.push({
          segment,
          sourceSegmentId: ids.join("+"),
          sourceSegmentIds: ids,
          segmentOrientation: dimensionAxis,
          evidenceMode: "witness_span",
          ...scored,
        });
      }
    }
  }
  return output;
}

/**
 * Resolves printed dimension text to source raster axes only when source evidence supports both measured ends.
 * Baseline rules may be intact or bounded fragments, while witness-span mode can derive the measured span from
 * two aligned source extension-line endpoints when no baseline segment itself carries the full printed length.
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
  const fragmentGapToleranceMeters = input.options?.fragmentGapToleranceMeters ?? 0.18;
  const maxFragmentChainSegments = Math.max(3, Math.min(5, input.options?.maxFragmentChainSegments ?? 4));
  const witnessSpanMinWitnessLengthMeters = input.options?.witnessSpanMinWitnessLengthMeters ?? 0.18;
  const witnessSpanMaxWitnessLengthMeters = input.options?.witnessSpanMaxWitnessLengthMeters ?? 3;
  const witnessSpanBaselineAlignmentToleranceMeters = input.options?.witnessSpanBaselineAlignmentToleranceMeters ?? 0.24;
  const witnessSpanLabelPaddingMeters = input.options?.witnessSpanLabelPaddingMeters ?? 0.35;
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
      ...buildFragmentChainCandidates({ segments: input.segments, dimension, label, maxRelativeLengthError, maxLabelDistanceMeters, collinearToleranceMeters: chainCollinearToleranceMeters, labelGapPaddingMeters: chainLabelGapPaddingMeters, fragmentGapToleranceMeters, maxSegments: maxFragmentChainSegments }),
      ...buildWitnessSpanCandidates({ segments: input.segments, dimension, label, maxRelativeLengthError, maxLabelDistanceMeters, minWitnessLengthMeters: witnessSpanMinWitnessLengthMeters, maxWitnessLengthMeters: witnessSpanMaxWitnessLengthMeters, baselineAlignmentToleranceMeters: witnessSpanBaselineAlignmentToleranceMeters, labelPaddingMeters: witnessSpanLabelPaddingMeters }),
    ];
    const candidates = rawCandidates.flatMap((candidate): Array<AxisCandidate & { startWitnessSupport: boolean; endWitnessSupport: boolean }> => {
      if (candidate.evidenceMode === "witness_span") {
        return [{ ...candidate, startWitnessSupport: true, endWitnessSupport: true }];
      }
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
    const modeFactor = best.evidenceMode === "single_segment" ? 0.96
      : best.evidenceMode === "label_gap_chain" ? 0.93
        : best.evidenceMode === "fragment_chain" ? 0.9
          : 0.88;
    const confidence = Math.min(dimension.confidence, Math.max(0, 1 - best.relativeLengthError * 2) * modeFactor);
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
  const fragmentChainAssociationCount = associations.filter((item) => item.evidenceMode === "fragment_chain").length;
  const witnessSpanAssociationCount = associations.filter((item) => item.evidenceMode === "witness_span").length;
  return {
    dimensions,
    associations,
    unresolvedDimensionIds,
    singleSegmentAssociationCount,
    labelGapChainAssociationCount,
    fragmentChainAssociationCount,
    witnessSpanAssociationCount,
    diagnostics: [
      `Raster dimension evidence associator resolved ${associations.length} of ${dimensions.length} printed dimensions (${singleSegmentAssociationCount} single source lines, ${labelGapChainAssociationCount} label-gap chains, ${fragmentChainAssociationCount} bounded fragment chains, ${witnessSpanAssociationCount} witness spans) with source-supported measured ends.`,
      `${unresolvedDimensionIds.length} dimensions remain unresolved rather than being inferred from text position alone.`,
      `Fragment chains allow at most ${maxFragmentChainSegments} collinear source pieces, tiny breaks up to ${fragmentGapToleranceMeters.toFixed(2)} m, and one larger gap only where the printed label occupies it.`,
      `Witness spans require two perpendicular source extension lines ${witnessSpanMinWitnessLengthMeters.toFixed(2)}–${witnessSpanMaxWitnessLengthMeters.toFixed(2)} m long with aligned endpoints within ${witnessSpanBaselineAlignmentToleranceMeters.toFixed(2)} m and printed-value spacing.`,
      "Arbitrary geometric gaps are never bridged and resolved dimension axes do not move wall geometry in this stage.",
    ],
  };
}
