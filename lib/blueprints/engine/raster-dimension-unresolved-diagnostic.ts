import type { BosDimension, BosLine2, BosPoint2 } from "./building-graph";
import type { BosRawSegment } from "./geometry";
import type { BosRasterDimensionEvidenceAssociation } from "./raster-dimension-evidence-associator";

export type BosRasterDimensionDiagnosticReason =
  | "matched_global_constraint"
  | "source_axis_resolved_global_unmatched"
  | "invalid_or_low_confidence_dimension"
  | "missing_label_bbox"
  | "no_nearby_orientation_axis"
  | "no_single_span_length_match"
  | "length_match_not_near_label"
  | "missing_start_witness"
  | "missing_end_witness"
  | "missing_both_witnesses"
  | "witness_pair_not_on_same_axis"
  | "ambiguous_source_axis"
  | "source_axis_unresolved_after_chain_rules";

export type BosRasterDimensionDiagnostic = {
  dimensionId: string;
  rawText?: string;
  value: number;
  page: number;
  reason: BosRasterDimensionDiagnosticReason;
  sourceAssociationMode?: BosRasterDimensionEvidenceAssociation["evidenceMode"];
  orientationCompatibleSegmentCount: number;
  nearbyOrientationSegmentCount: number;
  lengthCompatibleSegmentCount: number;
  lengthAndLabelCompatibleSegmentCount: number;
  twoWitnessSegmentCount: number;
};

export type BosRasterDimensionDiagnosticResult = {
  dimensions: BosRasterDimensionDiagnostic[];
  reasonCounts: Record<BosRasterDimensionDiagnosticReason, number>;
  dominantUnresolvedReason: BosRasterDimensionDiagnosticReason | null;
  diagnostics: string[];
};

export type BosRasterDimensionDiagnosticOptions = {
  maxRelativeLengthError?: number;
  maxLabelDistanceMeters?: number;
  witnessEndpointToleranceMeters?: number;
  witnessAngleToleranceRadians?: number;
};

function distance(a: BosPoint2, b: BosPoint2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function length(line: BosLine2) { return distance(line.start, line.end); }
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
function normalizedSegment(segment: BosRawSegment): BosRawSegment {
  const horizontal = orientation(segment) === "horizontal";
  if (horizontal) return segment.start.x <= segment.end.x ? segment : { ...segment, start: { ...segment.end }, end: { ...segment.start } };
  return segment.start.y <= segment.end.y ? segment : { ...segment, start: { ...segment.end }, end: { ...segment.start } };
}

function dimensionLabel(dimension: BosDimension, drawingUnitsPerMeter: number) {
  const bbox = dimension.evidence.find((evidence) => evidence.bbox)?.bbox;
  if (!bbox) return null;
  const horizontal = Math.abs(bbox.width) >= Math.abs(bbox.height);
  return {
    center: { x: (bbox.x + bbox.width / 2) / drawingUnitsPerMeter, y: (bbox.y + bbox.height / 2) / drawingUnitsPerMeter },
    orientation: horizontal ? "horizontal" as const : "vertical" as const,
    aspectRatio: Math.max(Math.abs(bbox.width), Math.abs(bbox.height)) / Math.max(1, Math.min(Math.abs(bbox.width), Math.abs(bbox.height))),
  };
}

function witnessSupport(input: {
  endpoint: BosPoint2;
  dimensionAngle: number;
  segments: readonly BosRawSegment[];
  sourcePage: number;
  endpointTolerance: number;
  angleTolerance: number;
  excludedSegment?: BosRawSegment;
}) {
  for (const source of input.segments) {
    if (source === input.excludedSegment || source.sourcePage !== input.sourcePage) continue;
    const segment = normalizedSegment(source);
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

const ALL_REASONS: BosRasterDimensionDiagnosticReason[] = [
  "matched_global_constraint",
  "source_axis_resolved_global_unmatched",
  "invalid_or_low_confidence_dimension",
  "missing_label_bbox",
  "no_nearby_orientation_axis",
  "no_single_span_length_match",
  "length_match_not_near_label",
  "missing_start_witness",
  "missing_end_witness",
  "missing_both_witnesses",
  "witness_pair_not_on_same_axis",
  "ambiguous_source_axis",
  "source_axis_unresolved_after_chain_rules",
];

/**
 * Read-only diagnostic for printed dimensions that fail source-axis or global wall association.
 * It never creates dimension geometry and never changes wall systems; it only classifies the evidence
 * already available to the raster dimension associator and global constraint stage.
 */
export function diagnoseRasterDimensions(input: {
  segments: readonly BosRawSegment[];
  dimensions: readonly BosDimension[];
  drawingUnitsPerMeter: number;
  associations: readonly BosRasterDimensionEvidenceAssociation[];
  matchedDimensionIds: ReadonlySet<string>;
  options?: BosRasterDimensionDiagnosticOptions;
}): BosRasterDimensionDiagnosticResult {
  if (!(input.drawingUnitsPerMeter > 0)) throw new Error("Raster dimension diagnostics require a verified drawing scale.");
  const maxRelativeLengthError = input.options?.maxRelativeLengthError ?? 0.14;
  const maxLabelDistanceMeters = input.options?.maxLabelDistanceMeters ?? 0.9;
  const witnessEndpointToleranceMeters = input.options?.witnessEndpointToleranceMeters ?? 0.24;
  const witnessAngleToleranceRadians = input.options?.witnessAngleToleranceRadians ?? Math.PI / 180 * 7;
  const associationByDimension = new Map(input.associations.map((association) => [association.dimensionId, association]));

  const dimensions = input.dimensions.map((dimension): BosRasterDimensionDiagnostic => {
    const matched = input.matchedDimensionIds.has(dimension.id);
    const association = associationByDimension.get(dimension.id);
    if (matched) {
      return { dimensionId: dimension.id, rawText: dimension.rawText, value: dimension.value, page: dimension.page, reason: "matched_global_constraint", sourceAssociationMode: association?.evidenceMode, orientationCompatibleSegmentCount: 0, nearbyOrientationSegmentCount: 0, lengthCompatibleSegmentCount: 0, lengthAndLabelCompatibleSegmentCount: 0, twoWitnessSegmentCount: 0 };
    }
    if (association) {
      return { dimensionId: dimension.id, rawText: dimension.rawText, value: dimension.value, page: dimension.page, reason: "source_axis_resolved_global_unmatched", sourceAssociationMode: association.evidenceMode, orientationCompatibleSegmentCount: 0, nearbyOrientationSegmentCount: 0, lengthCompatibleSegmentCount: 0, lengthAndLabelCompatibleSegmentCount: 0, twoWitnessSegmentCount: 0 };
    }
    if (!(dimension.value > 0) || dimension.confidence < 0.7) {
      return { dimensionId: dimension.id, rawText: dimension.rawText, value: dimension.value, page: dimension.page, reason: "invalid_or_low_confidence_dimension", orientationCompatibleSegmentCount: 0, nearbyOrientationSegmentCount: 0, lengthCompatibleSegmentCount: 0, lengthAndLabelCompatibleSegmentCount: 0, twoWitnessSegmentCount: 0 };
    }
    const label = dimensionLabel(dimension, input.drawingUnitsPerMeter);
    if (!label) {
      return { dimensionId: dimension.id, rawText: dimension.rawText, value: dimension.value, page: dimension.page, reason: "missing_label_bbox", orientationCompatibleSegmentCount: 0, nearbyOrientationSegmentCount: 0, lengthCompatibleSegmentCount: 0, lengthAndLabelCompatibleSegmentCount: 0, twoWitnessSegmentCount: 0 };
    }

    const pageSegments = input.segments.filter((segment) => segment.sourcePage === dimension.page).map(normalizedSegment);
    const oriented = pageSegments.filter((segment) => label.aspectRatio < 1.35 || orientation(segment) === label.orientation);
    const nearby = oriented.filter((segment) => pointLineDistance(label.center, segment) <= maxLabelDistanceMeters);
    const lengthCompatible = oriented.filter((segment) => Math.abs(length(segment) - dimension.value) / Math.max(dimension.value, 0.001) <= maxRelativeLengthError);
    const joint = lengthCompatible.filter((segment) => pointLineDistance(label.center, segment) <= maxLabelDistanceMeters);
    const witnessStates = joint.map((segment) => {
      const dimensionAngle = angle(segment);
      const start = witnessSupport({ endpoint: segment.start, dimensionAngle, segments: input.segments, sourcePage: dimension.page, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, excludedSegment: segment });
      const end = witnessSupport({ endpoint: segment.end, dimensionAngle, segments: input.segments, sourcePage: dimension.page, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, excludedSegment: segment });
      return { start, end };
    });
    const twoWitnessSegmentCount = witnessStates.filter((state) => state.start && state.end).length;

    let reason: BosRasterDimensionDiagnosticReason;
    if (!nearby.length) reason = "no_nearby_orientation_axis";
    else if (!lengthCompatible.length) reason = "no_single_span_length_match";
    else if (!joint.length) reason = "length_match_not_near_label";
    else if (twoWitnessSegmentCount > 1) reason = "ambiguous_source_axis";
    else if (twoWitnessSegmentCount === 1) reason = "source_axis_unresolved_after_chain_rules";
    else {
      const anyStart = witnessStates.some((state) => state.start);
      const anyEnd = witnessStates.some((state) => state.end);
      if (!anyStart && !anyEnd) reason = "missing_both_witnesses";
      else if (!anyStart) reason = "missing_start_witness";
      else if (!anyEnd) reason = "missing_end_witness";
      else reason = "witness_pair_not_on_same_axis";
    }

    return {
      dimensionId: dimension.id,
      rawText: dimension.rawText,
      value: dimension.value,
      page: dimension.page,
      reason,
      orientationCompatibleSegmentCount: oriented.length,
      nearbyOrientationSegmentCount: nearby.length,
      lengthCompatibleSegmentCount: lengthCompatible.length,
      lengthAndLabelCompatibleSegmentCount: joint.length,
      twoWitnessSegmentCount,
    };
  });

  const reasonCounts = Object.fromEntries(ALL_REASONS.map((reason) => [reason, dimensions.filter((item) => item.reason === reason).length])) as Record<BosRasterDimensionDiagnosticReason, number>;
  const unresolvedReasons = ALL_REASONS.filter((reason) => reason !== "matched_global_constraint");
  const dominantUnresolvedReason = unresolvedReasons.sort((a, b) => reasonCounts[b] - reasonCounts[a])[0] || null;
  const matchedCount = reasonCounts.matched_global_constraint;
  const sourceResolvedGlobalUnmatchedCount = reasonCounts.source_axis_resolved_global_unmatched;

  return {
    dimensions,
    reasonCounts,
    dominantUnresolvedReason: dominantUnresolvedReason && reasonCounts[dominantUnresolvedReason] > 0 ? dominantUnresolvedReason : null,
    diagnostics: [
      `Dimension failure diagnostic classified all ${dimensions.length} printed dimensions without changing source or candidate geometry.`,
      `${matchedCount} dimensions reached a global wall constraint; ${sourceResolvedGlobalUnmatchedCount} resolved a source axis but did not reach a unique global wall constraint.`,
      dominantUnresolvedReason && reasonCounts[dominantUnresolvedReason] > 0
        ? `Dominant unresolved dimension class is ${dominantUnresolvedReason} (${reasonCounts[dominantUnresolvedReason]} dimensions).`
        : "No unresolved dimension class remains.",
      "Direct single-span probe counts are diagnostic evidence only; chain association remains governed by the production raster dimension associator.",
    ],
  };
}
