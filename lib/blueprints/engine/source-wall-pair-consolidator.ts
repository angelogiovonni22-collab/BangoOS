import type { BosSourceWallFacePair } from "./source-wall-face-mask";

export type BosSourceWallPairConsolidationOptions = {
  centerlineToleranceMeters?: number;
  minimumOverlapRatio?: number;
  thicknessToleranceMeters?: number;
};

export type BosSourceWallPairConsolidation = {
  wallFacePairs: BosSourceWallFacePair[];
  rejectedDuplicatePairIds: string[];
  clusterCount: number;
  diagnostics: string[];
};

type MeterPair = BosSourceWallFacePair & {
  fixedMeters: number;
  startMeters: number;
  endMeters: number;
};

function toMeters(pair: BosSourceWallFacePair, pxPerMeterX: number, pxPerMeterY: number): MeterPair {
  const horizontal = pair.orientation === "horizontal";
  const movingScale = horizontal ? pxPerMeterX : pxPerMeterY;
  const fixedScale = horizontal ? pxPerMeterY : pxPerMeterX;
  return {
    ...pair,
    fixedMeters: pair.centerFixedPixel / fixedScale,
    startMeters: pair.startPixel / movingScale,
    endMeters: pair.endPixel / movingScale,
  };
}

function overlapRatio(a: MeterPair, b: MeterPair) {
  const overlap = Math.max(0, Math.min(a.endMeters, b.endMeters) - Math.max(a.startMeters, b.startMeters));
  return overlap / Math.max(0.001, Math.min(a.endMeters - a.startMeters, b.endMeters - b.startMeters));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/**
 * Collapses near-identical rendered-pixel wall-pair candidates that describe the same physical wall.
 * It selects an existing evidence pair as the representative; it never invents or averages geometry.
 */
export function consolidateSourceWallPairs(input: {
  wallFacePairs: readonly BosSourceWallFacePair[];
  sourcePixelWidth: number;
  sourcePixelHeight: number;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  options?: BosSourceWallPairConsolidationOptions;
}): BosSourceWallPairConsolidation {
  if (!input.wallFacePairs.length) {
    return { wallFacePairs: [], rejectedDuplicatePairIds: [], clusterCount: 0, diagnostics: ["Source wall-pair consolidator received no pairs."] };
  }
  const centerlineToleranceMeters = input.options?.centerlineToleranceMeters ?? 0.06;
  const minimumOverlapRatio = input.options?.minimumOverlapRatio ?? 0.72;
  const thicknessToleranceMeters = input.options?.thicknessToleranceMeters ?? 0.08;
  const pxPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pxPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const pairs = input.wallFacePairs.map((pair) => toMeters(pair, pxPerMeterX, pxPerMeterY));
  const parent = pairs.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) { parent[current] = parent[parent[current]]; current = parent[current]; }
    return current;
  };
  const union = (leftIndex: number, rightIndex: number) => {
    const left = find(leftIndex);
    const right = find(rightIndex);
    if (left !== right) parent[right] = left;
  };

  for (let left = 0; left < pairs.length; left += 1) {
    for (let right = left + 1; right < pairs.length; right += 1) {
      const a = pairs[left];
      const b = pairs[right];
      if (a.orientation !== b.orientation) continue;
      if (Math.abs(a.fixedMeters - b.fixedMeters) > centerlineToleranceMeters) continue;
      if (Math.abs(a.separationMeters - b.separationMeters) > thicknessToleranceMeters) continue;
      if (overlapRatio(a, b) < minimumOverlapRatio) continue;
      union(left, right);
    }
  }

  const groups = new Map<number, MeterPair[]>();
  pairs.forEach((pair, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), pair]);
  });

  const retainedIds = new Set<string>();
  const representatives: BosSourceWallFacePair[] = [];
  for (const group of groups.values()) {
    const targetThickness = median(group.map((pair) => pair.separationMeters));
    const representative = [...group].sort((a, b) => {
      const thicknessDelta = Math.abs(a.separationMeters - targetThickness) - Math.abs(b.separationMeters - targetThickness);
      if (Math.abs(thicknessDelta) > 1e-9) return thicknessDelta;
      return b.lengthMeters - a.lengthMeters;
    })[0];
    retainedIds.add(representative.id);
    representatives.push(input.wallFacePairs.find((pair) => pair.id === representative.id) || representative);
  }
  const rejectedDuplicatePairIds = input.wallFacePairs.filter((pair) => !retainedIds.has(pair.id)).map((pair) => pair.id);
  return {
    wallFacePairs: representatives,
    rejectedDuplicatePairIds,
    clusterCount: groups.size,
    diagnostics: [
      `Source wall-pair consolidation retained ${representatives.length} of ${input.wallFacePairs.length} rendered-source pairs across ${groups.size} evidence clusters.`,
      `${rejectedDuplicatePairIds.length} near-identical raster-row pair combinations were removed without moving or synthesizing source geometry.`,
      `Duplicate clustering requires centerlines within ${centerlineToleranceMeters.toFixed(2)} m, thickness within ${thicknessToleranceMeters.toFixed(2)} m, and ${(minimumOverlapRatio * 100).toFixed(0)}% span overlap.`,
    ],
  };
}
