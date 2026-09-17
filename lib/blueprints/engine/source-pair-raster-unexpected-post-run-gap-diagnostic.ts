import type { BosRawSegment } from "./geometry";
import type { BosRasterDedupeGapDiagnostic } from "./source-pair-raster-dedupe-gap-diagnostic";

export type BosUnexpectedPostRunGapReason =
  | "adjacent_band_quantization"
  | "parallel_offset_mapping_gap"
  | "fragmented_run_mapping_gap"
  | "no_nearby_raster_run";

type ParsedBandKey = {
  orientation: "horizontal" | "vertical";
  fixed: number;
  start: number;
  end: number;
};

export type BosUnexpectedPostRunGapFace = {
  representativePairId: string;
  memberPairId: string;
  face: "a" | "b";
  expectedBandKey: string;
  reason: BosUnexpectedPostRunGapReason;
  nearestSegmentId: string | null;
  nearestBandKey: string | null;
  fixedBandDelta: number | null;
  startBandDelta: number | null;
  endBandDelta: number | null;
  spanOverlapRatio: number | null;
};

function parseBandKey(value: string): ParsedBandKey | null {
  const [prefix, fixedRaw, startRaw, endRaw] = value.split(":");
  if ((prefix !== "h" && prefix !== "v") || !fixedRaw || !startRaw || !endRaw) return null;
  const fixed = Number(fixedRaw);
  const start = Number(startRaw);
  const end = Number(endRaw);
  if (![fixed, start, end].every(Number.isFinite)) return null;
  return {
    orientation: prefix === "h" ? "horizontal" : "vertical",
    fixed,
    start: Math.min(start, end),
    end: Math.max(start, end),
  };
}

function orientationOf(segment: BosRawSegment) {
  return Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y)
    ? "horizontal" as const
    : "vertical" as const;
}

function segmentBandKey(input: {
  segment: BosRawSegment;
  rasterPixelWidth: number;
  rasterPixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  mergeBandPixels: number;
}) {
  const meterPerPixelX = input.sourceWidthMeters / input.rasterPixelWidth;
  const meterPerPixelY = input.sourceHeightMeters / input.rasterPixelHeight;
  const bandX = Math.max(1, input.mergeBandPixels) * meterPerPixelX;
  const bandY = Math.max(1, input.mergeBandPixels) * meterPerPixelY;
  const orientation = orientationOf(input.segment);
  const fixed = orientation === "horizontal"
    ? (input.segment.start.y + input.segment.end.y) / 2
    : (input.segment.start.x + input.segment.end.x) / 2;
  const start = orientation === "horizontal"
    ? Math.min(input.segment.start.x, input.segment.end.x)
    : Math.min(input.segment.start.y, input.segment.end.y);
  const end = orientation === "horizontal"
    ? Math.max(input.segment.start.x, input.segment.end.x)
    : Math.max(input.segment.start.y, input.segment.end.y);
  return orientation === "horizontal"
    ? `h:${Math.round(fixed / bandY)}:${Math.round(start / bandX)}:${Math.round(end / bandX)}`
    : `v:${Math.round(fixed / bandX)}:${Math.round(start / bandY)}:${Math.round(end / bandY)}`;
}

function overlapRatio(a: ParsedBandKey, b: ParsedBandKey) {
  const overlap = Math.max(0, Math.min(a.end, b.end) - Math.max(a.start, b.start));
  const expectedSpan = Math.max(1, a.end - a.start);
  return overlap / expectedSpan;
}

function classify(input: {
  expected: ParsedBandKey;
  nearest: ParsedBandKey | null;
}) : BosUnexpectedPostRunGapReason {
  if (!input.nearest) return "no_nearby_raster_run";
  const fixedDelta = Math.abs(input.expected.fixed - input.nearest.fixed);
  const startDelta = Math.abs(input.expected.start - input.nearest.start);
  const endDelta = Math.abs(input.expected.end - input.nearest.end);
  const overlap = overlapRatio(input.expected, input.nearest);

  if (fixedDelta <= 1 && startDelta <= 1 && endDelta <= 1) return "adjacent_band_quantization";
  if (fixedDelta <= 2 && overlap >= 0.8) return "parallel_offset_mapping_gap";
  if (fixedDelta <= 1 && overlap >= 0.35) return "fragmented_run_mapping_gap";
  return "no_nearby_raster_run";
}

/**
 * Read-only second-stage audit for faces already proven to survive min-run filtering and to have no
 * retained same-band de-duplication competitor. It looks only for nearby production raster runs in
 * the exact production merge-band coordinate system. This does not synthesize or select geometry.
 */
export function diagnoseUnexpectedPostRunGaps(input: {
  dedupeGapDiagnostic: BosRasterDedupeGapDiagnostic;
  rawSegments: readonly BosRawSegment[];
  rasterPixelWidth: number;
  rasterPixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  mergeBandPixels?: number;
}) {
  const mergeBandPixels = Math.max(1, input.mergeBandPixels ?? 3);
  const indexedSegments = input.rawSegments.map((segment) => {
    const key = segmentBandKey({ ...input, segment, mergeBandPixels });
    return {
      segment,
      key,
      parsed: parseBandKey(key),
    };
  });

  const faces: BosUnexpectedPostRunGapFace[] = [];
  for (const member of input.dedupeGapDiagnostic.members) {
    for (const face of member.failedFaces) {
      if (face.reason !== "unexpected_post_run_gap" || !face.expectedBandKey) continue;
      const expected = parseBandKey(face.expectedBandKey);
      if (!expected) continue;
      const candidates = indexedSegments
        .filter((item) => item.parsed?.orientation === expected.orientation)
        .map((item) => {
          const parsed = item.parsed!;
          const fixedDelta = Math.abs(expected.fixed - parsed.fixed);
          const startDelta = Math.abs(expected.start - parsed.start);
          const endDelta = Math.abs(expected.end - parsed.end);
          const overlap = overlapRatio(expected, parsed);
          const score = fixedDelta * 8 + (1 - Math.min(1, overlap)) * 12 + Math.min(12, startDelta + endDelta) * 0.25;
          return { item, parsed, fixedDelta, startDelta, endDelta, overlap, score };
        })
        .filter((candidate) => candidate.fixedDelta <= 4 && candidate.overlap >= 0.15)
        .sort((a, b) => a.score - b.score || a.item.key.localeCompare(b.item.key));
      const nearest = candidates[0] || null;
      faces.push({
        representativePairId: member.representativePairId,
        memberPairId: member.memberPairId,
        face: face.face,
        expectedBandKey: face.expectedBandKey,
        reason: classify({ expected, nearest: nearest?.parsed || null }),
        nearestSegmentId: nearest ? String(nearest.item.segment.sourceObjectId || "unknown") : null,
        nearestBandKey: nearest?.item.key || null,
        fixedBandDelta: nearest?.fixedDelta ?? null,
        startBandDelta: nearest?.startDelta ?? null,
        endBandDelta: nearest?.endDelta ?? null,
        spanOverlapRatio: nearest?.overlap ?? null,
      });
    }
  }

  const reasonFaceCounts: Record<BosUnexpectedPostRunGapReason, number> = {
    adjacent_band_quantization: 0,
    parallel_offset_mapping_gap: 0,
    fragmented_run_mapping_gap: 0,
    no_nearby_raster_run: 0,
  };
  const familiesByReason: Record<BosUnexpectedPostRunGapReason, Set<string>> = {
    adjacent_band_quantization: new Set(),
    parallel_offset_mapping_gap: new Set(),
    fragmented_run_mapping_gap: new Set(),
    no_nearby_raster_run: new Set(),
  };
  for (const face of faces) {
    reasonFaceCounts[face.reason] += 1;
    familiesByReason[face.reason].add(face.representativePairId);
  }
  const reasonFamilyCounts = Object.fromEntries(
    Object.entries(familiesByReason).map(([reason, families]) => [reason, families.size]),
  ) as Record<BosUnexpectedPostRunGapReason, number>;

  return {
    mode: "read_only_unexpected_post_run_gap_diagnostic" as const,
    faceCount: faces.length,
    familyCount: new Set(faces.map((face) => face.representativePairId)).size,
    reasonFaceCounts,
    reasonFamilyCounts,
    faces,
    safeToConsiderPromotion: false,
    diagnostics: [
      `${faces.length} post-run source face gap(s) were compared with nearby retained raster runs in the unchanged production merge-band coordinate system.`,
      `${reasonFaceCounts.adjacent_band_quantization} face(s) differ only by an adjacent merge-band quantization step and require isolated replay before any extraction behavior can change.`,
      `${reasonFaceCounts.parallel_offset_mapping_gap} face(s) have a strongly overlapping nearby parallel run but a larger fixed-band offset.`,
      `${reasonFaceCounts.fragmented_run_mapping_gap} face(s) have nearby same-line fragments that partially overlap the expected source span.`,
      `${reasonFaceCounts.no_nearby_raster_run} face(s) have no sufficiently nearby production raster run and remain fail-closed for deeper extraction evidence.`,
      "Read-only diagnostic only: no raster setting, selector default, wall, topology, persistence, canonical geometry, or 3D output changed.",
    ],
  };
}
