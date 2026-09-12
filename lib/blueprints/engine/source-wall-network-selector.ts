import type { BosSourceWallFacePair } from "./source-wall-face-mask";

export type BosSourceWallNetworkSelection = {
  wallFacePairs: BosSourceWallFacePair[];
  rejectedPairIds: string[];
  componentCount: number;
  retainedComponentCount: number;
  repetitiveArtifactCount: number;
  totalRetainedLengthMeters: number;
  diagnostics: string[];
};

export type BosSourceWallNetworkOptions = {
  junctionToleranceMeters?: number;
  openingContinuityMeters?: number;
  collinearToleranceMeters?: number;
  minRetainedComponentLengthMeters?: number;
  relativeComponentLengthFloor?: number;
};

type MeterPair = BosSourceWallFacePair & {
  axisStart: number;
  axisEnd: number;
  fixedMeters: number;
};

function toMeterPair(pair: BosSourceWallFacePair, pixelsPerMeterX: number, pixelsPerMeterY: number): MeterPair {
  const horizontal = pair.orientation === "horizontal";
  return {
    ...pair,
    axisStart: pair.startPixel / (horizontal ? pixelsPerMeterX : pixelsPerMeterY),
    axisEnd: pair.endPixel / (horizontal ? pixelsPerMeterX : pixelsPerMeterY),
    fixedMeters: pair.centerFixedPixel / (horizontal ? pixelsPerMeterY : pixelsPerMeterX),
  };
}

function intervalGap(a0: number, a1: number, b0: number, b1: number) {
  const left = Math.max(Math.min(a0, a1), Math.min(b0, b1));
  const right = Math.min(Math.max(a0, a1), Math.max(b0, b1));
  return left <= right ? 0 : left - right;
}

function intervalsOverlap(a0: number, a1: number, b0: number, b1: number) {
  return Math.max(Math.min(a0, a1), Math.min(b0, b1)) <= Math.min(Math.max(a0, a1), Math.max(b0, b1));
}

function connected(a: MeterPair, b: MeterPair, junction: number, opening: number, collinear: number) {
  if (a.orientation === b.orientation) {
    return Math.abs(a.fixedMeters - b.fixedMeters) <= collinear
      && intervalGap(a.axisStart, a.axisEnd, b.axisStart, b.axisEnd) <= opening;
  }
  const horizontal = a.orientation === "horizontal" ? a : b;
  const vertical = a.orientation === "vertical" ? a : b;
  const x = vertical.fixedMeters;
  const y = horizontal.fixedMeters;
  const horizontalDistance = x < horizontal.axisStart ? horizontal.axisStart - x : x > horizontal.axisEnd ? x - horizontal.axisEnd : 0;
  const verticalDistance = y < vertical.axisStart ? vertical.axisStart - y : y > vertical.axisEnd ? y - vertical.axisEnd : 0;
  return Math.hypot(horizontalDistance, verticalDistance) <= junction;
}

function repetitiveShortParallel(candidate: MeterPair, pairs: readonly MeterPair[]) {
  if (candidate.lengthMeters > 1.5) return false;
  let family = 1;
  for (const other of pairs) {
    if (other.id === candidate.id || other.orientation !== candidate.orientation || other.lengthMeters > 1.5) continue;
    const ratio = other.lengthMeters / Math.max(candidate.lengthMeters, 0.001);
    if (ratio < 0.62 || ratio > 1.62) continue;
    if (!intervalsOverlap(candidate.axisStart, candidate.axisEnd, other.axisStart, other.axisEnd)) continue;
    if (Math.abs(candidate.fixedMeters - other.fixedMeters) > 1.05) continue;
    family += 1;
    if (family >= 4) return true;
  }
  return false;
}

/**
 * Selects building-scale connected components from independently rendered source wall-face pairs.
 * This validator-side network selection is intentionally separate from reconstructed-wall selection:
 * it never sees candidate wall IDs or candidate topology and cannot manufacture geometry across gaps.
 */
export function selectSourceWallNetwork(input: {
  wallFacePairs: readonly BosSourceWallFacePair[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  options?: BosSourceWallNetworkOptions;
}): BosSourceWallNetworkSelection {
  const pixelsPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pixelsPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const junction = input.options?.junctionToleranceMeters ?? 0.28;
  const opening = input.options?.openingContinuityMeters ?? 1.2;
  const collinear = input.options?.collinearToleranceMeters ?? 0.16;
  const minComponent = input.options?.minRetainedComponentLengthMeters ?? 4;
  const relativeFloor = input.options?.relativeComponentLengthFloor ?? 0.12;
  const pairs = input.wallFacePairs.map((pair) => toMeterPair(pair, pixelsPerMeterX, pixelsPerMeterY));
  const repetitive = new Set(pairs.filter((pair) => repetitiveShortParallel(pair, pairs)).map((pair) => pair.id));
  const structural = pairs.filter((pair) => !repetitive.has(pair.id));
  if (!structural.length) {
    return {
      wallFacePairs: [], rejectedPairIds: pairs.map((pair) => pair.id), componentCount: 0,
      retainedComponentCount: 0, repetitiveArtifactCount: repetitive.size, totalRetainedLengthMeters: 0,
      diagnostics: ["Rendered-source wall network selector retained no building-scale wall-face pairs."],
    };
  }

  const parent = structural.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) { parent[current] = parent[parent[current]]; current = parent[current]; }
    return current;
  };
  const union = (a: number, b: number) => { const left = find(a); const right = find(b); if (left !== right) parent[right] = left; };
  for (let left = 0; left < structural.length; left += 1) {
    for (let right = left + 1; right < structural.length; right += 1) {
      if (connected(structural[left], structural[right], junction, opening, collinear)) union(left, right);
    }
  }
  const groups = new Map<number, MeterPair[]>();
  structural.forEach((pair, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), pair]);
  });
  const components = [...groups.values()].map((wallFacePairs) => ({
    wallFacePairs,
    totalLength: wallFacePairs.reduce((sum, pair) => sum + pair.lengthMeters, 0),
  })).sort((a, b) => b.totalLength - a.totalLength);
  const largest = components[0]?.totalLength || 0;
  const retained = components.filter((component, index) => index === 0 || (
    component.totalLength >= minComponent && component.totalLength >= largest * relativeFloor
  ));
  const retainedIds = new Set(retained.flatMap((component) => component.wallFacePairs.map((pair) => pair.id)));
  const wallFacePairs = input.wallFacePairs.filter((pair) => retainedIds.has(pair.id));
  const totalRetainedLengthMeters = wallFacePairs.reduce((sum, pair) => sum + pair.lengthMeters, 0);
  return {
    wallFacePairs,
    rejectedPairIds: input.wallFacePairs.filter((pair) => !retainedIds.has(pair.id)).map((pair) => pair.id),
    componentCount: components.length,
    retainedComponentCount: retained.length,
    repetitiveArtifactCount: repetitive.size,
    totalRetainedLengthMeters,
    diagnostics: [
      `Rendered-source wall network retained ${wallFacePairs.length} of ${input.wallFacePairs.length} paired wall-face candidates across ${retained.length} of ${components.length} connected components.`,
      `Rendered-source wall network rejected ${repetitive.size} repetitive short parallel pairs before component selection.`,
      `Largest independent source-wall component spans ${largest.toFixed(2)} m of paired wall evidence; opening continuity is limited to ${opening.toFixed(2)} m.`,
    ],
  };
}
