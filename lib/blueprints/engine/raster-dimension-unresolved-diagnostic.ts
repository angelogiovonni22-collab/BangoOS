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

type AxisOrientation = "horizontal" | "vertical";
type SegmentMeta = {
  source: BosRawSegment;
  line: BosRawSegment;
  orientation: AxisOrientation;
  angle: number;
  length: number;
  fixed: number;
  minAlong: number;
  maxAlong: number;
};
type PageIndex = {
  all: SegmentMeta[];
  horizontal: SegmentMeta[];
  vertical: SegmentMeta[];
  horizontalBuckets: Map<number, SegmentMeta[]>;
  verticalBuckets: Map<number, SegmentMeta[]>;
};

function distance(a: BosPoint2, b: BosPoint2) { return Math.hypot(a.x - b.x, a.y - b.y); }
function length(line: BosLine2) { return distance(line.start, line.end); }
function orientation(line: BosLine2): AxisOrientation {
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
function normalizedSegment(segment: BosRawSegment): BosRawSegment {
  const horizontal = orientation(segment) === "horizontal";
  if (horizontal) return segment.start.x <= segment.end.x ? segment : { ...segment, start: { ...segment.end }, end: { ...segment.start } };
  return segment.start.y <= segment.end.y ? segment : { ...segment, start: { ...segment.end }, end: { ...segment.start } };
}
function segmentMeta(source: BosRawSegment): SegmentMeta {
  const line = normalizedSegment(source);
  const axis = orientation(line);
  return {
    source,
    line,
    orientation: axis,
    angle: angle(line),
    length: length(line),
    fixed: axis === "horizontal" ? (line.start.y + line.end.y) / 2 : (line.start.x + line.end.x) / 2,
    minAlong: axis === "horizontal" ? Math.min(line.start.x, line.end.x) : Math.min(line.start.y, line.end.y),
    maxAlong: axis === "horizontal" ? Math.max(line.start.x, line.end.x) : Math.max(line.start.y, line.end.y),
  };
}
function bucketKey(value: number, bucketSize: number) { return Math.floor(value / bucketSize); }
function addBucket(map: Map<number, SegmentMeta[]>, key: number, segment: SegmentMeta) {
  const list = map.get(key);
  if (list) list.push(segment);
  else map.set(key, [segment]);
}
function buildPageIndexes(segments: readonly BosRawSegment[], bucketSize: number) {
  const pages = new Map<number, PageIndex>();
  for (const source of segments) {
    const page = source.sourcePage ?? 1;
    let index = pages.get(page);
    if (!index) {
      index = { all: [], horizontal: [], vertical: [], horizontalBuckets: new Map(), verticalBuckets: new Map() };
      pages.set(page, index);
    }
    const meta = segmentMeta(source);
    index.all.push(meta);
    if (meta.orientation === "horizontal") {
      index.horizontal.push(meta);
      addBucket(index.horizontalBuckets, bucketKey(meta.fixed, bucketSize), meta);
    } else {
      index.vertical.push(meta);
      addBucket(index.verticalBuckets, bucketKey(meta.fixed, bucketSize), meta);
    }
  }
  return pages;
}
function nearbyFixedCandidates(map: Map<number, SegmentMeta[]>, fixed: number, tolerance: number, bucketSize: number) {
  const first = bucketKey(fixed - tolerance, bucketSize);
  const last = bucketKey(fixed + tolerance, bucketSize);
  const result: SegmentMeta[] = [];
  for (let key = first; key <= last; key += 1) result.push(...(map.get(key) ?? []));
  return result;
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
  dimensionOrientation: AxisOrientation;
  pageIndex: PageIndex;
  endpointTolerance: number;
  angleTolerance: number;
  bucketSize: number;
  excludedSource?: BosRawSegment;
}) {
  const witnessOrientation: AxisOrientation = input.dimensionOrientation === "horizontal" ? "vertical" : "horizontal";
  const fixed = input.dimensionOrientation === "horizontal" ? input.endpoint.x : input.endpoint.y;
  const along = input.dimensionOrientation === "horizontal" ? input.endpoint.y : input.endpoint.x;
  const buckets = witnessOrientation === "vertical" ? input.pageIndex.verticalBuckets : input.pageIndex.horizontalBuckets;
  const candidates = nearbyFixedCandidates(buckets, fixed, input.endpointTolerance, input.bucketSize);
  for (const candidate of candidates) {
    if (candidate.source === input.excludedSource) continue;
    const delta = angleDelta(candidate.angle, input.dimensionAngle);
    if (Math.abs(delta - Math.PI / 2) > input.angleTolerance) continue;
    if (Math.abs(candidate.fixed - fixed) > input.endpointTolerance) continue;
    if (along >= candidate.minAlong - input.endpointTolerance && along <= candidate.maxAlong + input.endpointTolerance) return true;
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
  const witnessBucketSize = Math.max(witnessEndpointToleranceMeters, 0.05);
  const pageIndexes = buildPageIndexes(input.segments, witnessBucketSize);
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

    const pageIndex = pageIndexes.get(dimension.page) ?? { all: [], horizontal: [], vertical: [], horizontalBuckets: new Map(), verticalBuckets: new Map() };
    const oriented = label.aspectRatio < 1.35 ? pageIndex.all : label.orientation === "horizontal" ? pageIndex.horizontal : pageIndex.vertical;
    const nearby = oriented.filter((segment) => pointLineDistance(label.center, segment.line) <= maxLabelDistanceMeters);
    const lengthCompatible = oriented.filter((segment) => Math.abs(segment.length - dimension.value) / Math.max(dimension.value, 0.001) <= maxRelativeLengthError);
    const joint = lengthCompatible.filter((segment) => pointLineDistance(label.center, segment.line) <= maxLabelDistanceMeters);
    const witnessStates = joint.map((segment) => {
      const start = witnessSupport({ endpoint: segment.line.start, dimensionAngle: segment.angle, dimensionOrientation: segment.orientation, pageIndex, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, bucketSize: witnessBucketSize, excludedSource: segment.source });
      const end = witnessSupport({ endpoint: segment.line.end, dimensionAngle: segment.angle, dimensionOrientation: segment.orientation, pageIndex, endpointTolerance: witnessEndpointToleranceMeters, angleTolerance: witnessAngleToleranceRadians, bucketSize: witnessBucketSize, excludedSource: segment.source });
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
      "Witness probes use page-local fixed-coordinate buckets so read-only diagnostics remain bounded on dense raster drawings.",
      "Direct single-span probe counts are diagnostic evidence only; chain association remains governed by the production raster dimension associator.",
    ],
  };
}
