import type { BosSourceWallFacePair } from "./source-wall-face-mask";

export type BosSourceWallPairConsolidationOptions = {
  centerlineToleranceMeters?: number;
  minimumOverlapRatio?: number;
  thicknessToleranceMeters?: number;
  clusteringMode?: "single_link" | "complete_link";
};

export type BosSourceWallPairConsolidationCluster = {
  representativePairId: string;
  memberPairIds: string[];
  members: BosSourceWallFacePair[];
};

export type BosSourceWallPairConsolidation = {
  wallFacePairs: BosSourceWallFacePair[];
  rejectedDuplicatePairIds: string[];
  clusterCount: number;
  clusters: BosSourceWallPairConsolidationCluster[];
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

function compatible(a: MeterPair, b: MeterPair, centerlineToleranceMeters: number, thicknessToleranceMeters: number, minimumOverlapRatio: number) {
  return a.orientation === b.orientation
    && Math.abs(a.fixedMeters - b.fixedMeters) <= centerlineToleranceMeters
    && Math.abs(a.separationMeters - b.separationMeters) <= thicknessToleranceMeters
    && overlapRatio(a, b) >= minimumOverlapRatio;
}

function singleLinkGroups(pairs: MeterPair[], centerlineToleranceMeters: number, thicknessToleranceMeters: number, minimumOverlapRatio: number) {
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
      if (compatible(pairs[left], pairs[right], centerlineToleranceMeters, thicknessToleranceMeters, minimumOverlapRatio)) union(left, right);
    }
  }
  const groups = new Map<number, MeterPair[]>();
  pairs.forEach((pair, index) => {
    const root = find(index);
    groups.set(root, [...(groups.get(root) || []), pair]);
  });
  return [...groups.values()];
}

function completeLinkGroups(pairs: MeterPair[], centerlineToleranceMeters: number, thicknessToleranceMeters: number, minimumOverlapRatio: number) {
  const ordered = [...pairs].sort((a, b) =>
    a.orientation.localeCompare(b.orientation)
    || a.fixedMeters - b.fixedMeters
    || a.separationMeters - b.separationMeters
    || a.startMeters - b.startMeters
    || a.endMeters - b.endMeters
    || a.id.localeCompare(b.id));
  const groups: MeterPair[][] = [];
  for (const pair of ordered) {
    const eligible = groups
      .map((group, index) => ({ group, index }))
      .filter(({ group }) => group.every((member) => compatible(pair, member, centerlineToleranceMeters, thicknessToleranceMeters, minimumOverlapRatio)))
      .sort((left, right) => {
        const leftDistance = Math.min(...left.group.map((member) => Math.abs(member.fixedMeters - pair.fixedMeters)));
        const rightDistance = Math.min(...right.group.map((member) => Math.abs(member.fixedMeters - pair.fixedMeters)));
        return leftDistance - rightDistance || left.index - right.index;
      });
    if (eligible.length) eligible[0].group.push(pair);
    else groups.push([pair]);
  }
  return groups;
}

/**
 * Collapses near-identical rendered-pixel wall-pair candidates that describe the same physical wall.
 * It selects an existing evidence pair as the representative; it never invents or averages geometry.
 * Every original pair remains exposed inside its read-only evidence family for downstream diagnostics.
 * The default single-link mode is unchanged. Complete-link mode is available for read-only simulation
 * and requires every pair inside a cluster to satisfy the original pairwise tolerances with every other member.
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
    return { wallFacePairs: [], rejectedDuplicatePairIds: [], clusterCount: 0, clusters: [], diagnostics: ["Source wall-pair consolidator received no pairs."] };
  }
  const centerlineToleranceMeters = input.options?.centerlineToleranceMeters ?? 0.06;
  const minimumOverlapRatio = input.options?.minimumOverlapRatio ?? 0.72;
  const thicknessToleranceMeters = input.options?.thicknessToleranceMeters ?? 0.08;
  const clusteringMode = input.options?.clusteringMode ?? "single_link";
  const pxPerMeterX = input.sourcePixelWidth / input.sourceWidthMeters;
  const pxPerMeterY = input.sourcePixelHeight / input.sourceHeightMeters;
  const pairs = input.wallFacePairs.map((pair) => toMeters(pair, pxPerMeterX, pxPerMeterY));
  const groups = clusteringMode === "complete_link"
    ? completeLinkGroups(pairs, centerlineToleranceMeters, thicknessToleranceMeters, minimumOverlapRatio)
    : singleLinkGroups(pairs, centerlineToleranceMeters, thicknessToleranceMeters, minimumOverlapRatio);

  const originalById = new Map(input.wallFacePairs.map((pair) => [pair.id, pair]));
  const retainedIds = new Set<string>();
  const representatives: BosSourceWallFacePair[] = [];
  const clusters: BosSourceWallPairConsolidationCluster[] = [];
  for (const group of groups) {
    const targetThickness = median(group.map((pair) => pair.separationMeters));
    const representative = [...group].sort((a, b) => {
      const thicknessDelta = Math.abs(a.separationMeters - targetThickness) - Math.abs(b.separationMeters - targetThickness);
      if (Math.abs(thicknessDelta) > 1e-9) return thicknessDelta;
      return b.lengthMeters - a.lengthMeters || a.id.localeCompare(b.id);
    })[0];
    const representativePair = originalById.get(representative.id) || representative;
    const members = group.map((member) => originalById.get(member.id) || member);
    retainedIds.add(representative.id);
    representatives.push(representativePair);
    clusters.push({
      representativePairId: representative.id,
      memberPairIds: members.map((member) => member.id),
      members,
    });
  }
  const rejectedDuplicatePairIds = input.wallFacePairs.filter((pair) => !retainedIds.has(pair.id)).map((pair) => pair.id);
  return {
    wallFacePairs: representatives,
    rejectedDuplicatePairIds,
    clusterCount: groups.length,
    clusters,
    diagnostics: [
      `Source wall-pair consolidation retained ${representatives.length} of ${input.wallFacePairs.length} rendered-source pairs across ${groups.length} evidence clusters.`,
      `${rejectedDuplicatePairIds.length} near-identical raster-row pair combinations were removed without moving or synthesizing source geometry.`,
      `Duplicate clustering requires centerlines within ${centerlineToleranceMeters.toFixed(2)} m, thickness within ${thicknessToleranceMeters.toFixed(2)} m, and ${(minimumOverlapRatio * 100).toFixed(0)}% span overlap.`,
      clusteringMode === "complete_link"
        ? "Complete-link simulation requires every member of an evidence family to satisfy those pairwise tolerances with every other member; no synthetic geometry is created."
        : "Single-link production clustering is unchanged; transitive compatible pairs may belong to the same evidence family.",
      "Every original source-pair member remains available inside its consolidation family for read-only fidelity diagnostics.",
    ],
  };
}
