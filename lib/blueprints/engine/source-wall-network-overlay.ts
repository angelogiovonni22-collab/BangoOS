import type { BosLine2 } from "./building-graph";
import { buildSourceWallFaceMask, paintSourceWallFacePairs, type BosSourceWallFaceMaskOptions } from "./source-wall-face-mask";
import { consolidateSourceWallPairs, type BosSourceWallPairConsolidationOptions } from "./source-wall-pair-consolidator";
import { selectSourceWallNetwork, type BosSourceWallNetworkOptions } from "./source-wall-network-selector";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosIndependentSourceWallNetworkEvidence = {
  faces: ReturnType<typeof buildSourceWallFaceMask>;
  consolidated: ReturnType<typeof consolidateSourceWallPairs>;
  network: ReturnType<typeof selectSourceWallNetwork>;
};

export type BosSourceWallNetworkOverlayReport = {
  rawPairCount: number;
  consolidatedPairCount: number;
  duplicateRejectedPairCount: number;
  retainedPairCount: number;
  rejectedPairCount: number;
  componentCount: number;
  retainedComponentCount: number;
  repetitiveArtifactCount: number;
  sourceNetworkPixelCount: number;
  coveredSourceNetworkPixelCount: number;
  recall: number;
  f1: number;
  totalRetainedLengthMeters: number;
  diagnostics: string[];
};

function lineLength(line: BosLine2) { return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y); }
function sampleLine(line: BosLine2) {
  const count = Math.max(2, Math.ceil(lineLength(line)) + 1);
  return Array.from({ length: count }, (_, index) => {
    const t = index / (count - 1);
    return { x: line.start.x + (line.end.x - line.start.x) * t, y: line.start.y + (line.end.y - line.start.y) * t };
  });
}
function candidateCoverageMask(input: { image: { width: number; height: number }; wallSystems: readonly BosWallSystemCandidate[]; sourceWidthMeters: number; sourceHeightMeters: number; radiusPixels: number }) {
  const mask = new Uint8Array(input.image.width * input.image.height);
  const pxX = input.image.width / input.sourceWidthMeters;
  const pxY = input.image.height / input.sourceHeightMeters;
  for (const system of input.wallSystems) for (const face of [system.faceA.line, system.faceB.line]) {
    const pixelLine: BosLine2 = { start: { x: face.start.x * pxX, y: face.start.y * pxY }, end: { x: face.end.x * pxX, y: face.end.y * pxY } };
    for (const point of sampleLine(pixelLine)) {
      const cx = Math.round(point.x); const cy = Math.round(point.y);
      for (let dy = -input.radiusPixels; dy <= input.radiusPixels; dy += 1) for (let dx = -input.radiusPixels; dx <= input.radiusPixels; dx += 1) {
        if (dx * dx + dy * dy > input.radiusPixels * input.radiusPixels) continue;
        const x = cx + dx; const y = cy + dy;
        if (x >= 0 && y >= 0 && x < input.image.width && y < input.image.height) mask[y * input.image.width + x] = 1;
      }
    }
  }
  return mask;
}

/** Builds the independent rendered-source wall network once so multiple read-only diagnostics can reuse it. */
export function buildIndependentSourceWallNetworkEvidence(input: {
  image: { data: Uint8Array; width: number; height: number };
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  faceOptions?: BosSourceWallFaceMaskOptions;
  consolidationOptions?: BosSourceWallPairConsolidationOptions;
  networkOptions?: BosSourceWallNetworkOptions;
}): BosIndependentSourceWallNetworkEvidence {
  const faces = buildSourceWallFaceMask({ image: input.image, sourceWidthMeters: input.sourceWidthMeters, sourceHeightMeters: input.sourceHeightMeters, options: input.faceOptions });
  const consolidated = consolidateSourceWallPairs({
    wallFacePairs: faces.wallFacePairs,
    sourcePixelWidth: input.image.width,
    sourcePixelHeight: input.image.height,
    sourceWidthMeters: input.sourceWidthMeters,
    sourceHeightMeters: input.sourceHeightMeters,
    options: input.consolidationOptions,
  });
  const network = selectSourceWallNetwork({
    wallFacePairs: consolidated.wallFacePairs,
    sourcePixelWidth: input.image.width,
    sourcePixelHeight: input.image.height,
    sourceWidthMeters: input.sourceWidthMeters,
    sourceHeightMeters: input.sourceHeightMeters,
    options: input.networkOptions,
  });
  return { faces, consolidated, network };
}

/** Independent building-scale source-wall network coverage after duplicate raster-row consolidation. */
export function assessSourceWallNetworkOverlay(input: {
  image: { data: Uint8Array; width: number; height: number };
  wallSystems: readonly BosWallSystemCandidate[];
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  predictedPrecision: number;
  faceOptions?: BosSourceWallFaceMaskOptions;
  consolidationOptions?: BosSourceWallPairConsolidationOptions;
  networkOptions?: BosSourceWallNetworkOptions;
  coverageRadiusPixels?: number;
  evidence?: BosIndependentSourceWallNetworkEvidence;
}): BosSourceWallNetworkOverlayReport {
  const evidence = input.evidence ?? buildIndependentSourceWallNetworkEvidence(input);
  const { faces, consolidated, network } = evidence;
  const sourceMask = new Uint8Array(input.image.width * input.image.height);
  paintSourceWallFacePairs(sourceMask, input.image, network.wallFacePairs);
  const candidateMask = candidateCoverageMask({ image: input.image, wallSystems: input.wallSystems, sourceWidthMeters: input.sourceWidthMeters, sourceHeightMeters: input.sourceHeightMeters, radiusPixels: input.coverageRadiusPixels ?? 3 });
  let sourceNetworkPixelCount = 0;
  let coveredSourceNetworkPixelCount = 0;
  for (let index = 0; index < sourceMask.length; index += 1) if (sourceMask[index]) {
    sourceNetworkPixelCount += 1;
    if (candidateMask[index]) coveredSourceNetworkPixelCount += 1;
  }
  const recall = sourceNetworkPixelCount ? coveredSourceNetworkPixelCount / sourceNetworkPixelCount : 0;
  const f1 = input.predictedPrecision + recall > 0 ? 2 * input.predictedPrecision * recall / (input.predictedPrecision + recall) : 0;
  return {
    rawPairCount: faces.wallFacePairs.length,
    consolidatedPairCount: consolidated.wallFacePairs.length,
    duplicateRejectedPairCount: consolidated.rejectedDuplicatePairIds.length,
    retainedPairCount: network.wallFacePairs.length,
    rejectedPairCount: consolidated.wallFacePairs.length - network.wallFacePairs.length,
    componentCount: network.componentCount,
    retainedComponentCount: network.retainedComponentCount,
    repetitiveArtifactCount: network.repetitiveArtifactCount,
    sourceNetworkPixelCount,
    coveredSourceNetworkPixelCount,
    recall,
    f1,
    totalRetainedLengthMeters: network.totalRetainedLengthMeters,
    diagnostics: [
      `Candidate wall faces cover ${(recall * 100).toFixed(1)}% of consolidated, building-scale independent source-wall pixels (network F1 ${f1.toFixed(3)}).`,
      ...consolidated.diagnostics,
      ...network.diagnostics,
      "Source-wall consolidation and network selection use only rendered-source wall-face pairs and never consult reconstructed candidate topology.",
    ],
  };
}
