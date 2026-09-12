export type BosSourceWallFaceMaskOptions = {
  threshold?: number;
  minRunPixels?: number;
  minWallThicknessMeters?: number;
  maxWallThicknessMeters?: number;
  minOverlapRatio?: number;
  sheetFrameEdgeRatio?: number;
  sheetFrameSpanRatio?: number;
};

export type BosSourceWallFacePair = {
  id: string;
  orientation: "horizontal" | "vertical";
  faceAFixedPixel: number;
  faceBFixedPixel: number;
  startPixel: number;
  endPixel: number;
  centerFixedPixel: number;
  lengthMeters: number;
  separationMeters: number;
};

export type BosSourceWallFaceMaskReport = {
  mask: Uint8Array;
  wallFacePairs: BosSourceWallFacePair[];
  wallFacePixelCount: number;
  pairedRunCount: number;
  horizontalPairCount: number;
  verticalPairCount: number;
  candidateRunCount: number;
  rejectedSheetFrameRunCount: number;
  diagnostics: string[];
};

type GrayImage = { data: Uint8Array; width: number; height: number };
type Run = { fixed: number; start: number; end: number; length: number };

function isInk(image: GrayImage, x: number, y: number, threshold: number) {
  return x >= 0 && y >= 0 && x < image.width && y < image.height && image.data[y * image.width + x] <= threshold;
}

function extractRuns(image: GrayImage, horizontal: boolean, threshold: number, minRun: number) {
  const fixedCount = horizontal ? image.height : image.width;
  const movingCount = horizontal ? image.width : image.height;
  const runs: Run[][] = Array.from({ length: fixedCount }, () => []);
  for (let fixed = 0; fixed < fixedCount; fixed += 1) {
    let start = -1;
    for (let moving = 0; moving <= movingCount; moving += 1) {
      const ink = moving < movingCount && (horizontal ? isInk(image, moving, fixed, threshold) : isInk(image, fixed, moving, threshold));
      if (ink && start < 0) start = moving;
      if ((!ink || moving === movingCount) && start >= 0) {
        const end = moving - 1;
        const length = end - start + 1;
        if (length >= minRun) runs[fixed].push({ fixed, start, end, length });
        start = -1;
      }
    }
  }
  return runs;
}

function overlap(a: Run, b: Run) {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return { start, end, length: Math.max(0, end - start + 1) };
}

function isSheetFrameRun(run: Run, horizontal: boolean, image: GrayImage, edgeRatio: number, spanRatio: number) {
  if (horizontal) {
    const nearEdge = run.fixed <= image.height * edgeRatio || run.fixed >= image.height * (1 - edgeRatio);
    return nearEdge && run.length >= image.width * spanRatio;
  }
  const nearEdge = run.fixed <= image.width * edgeRatio || run.fixed >= image.width * (1 - edgeRatio);
  return nearEdge && run.length >= image.height * spanRatio;
}

export function paintSourceWallFacePairs(mask: Uint8Array, image: GrayImage, pairs: readonly BosSourceWallFacePair[]) {
  for (const pair of pairs) {
    for (let moving = pair.startPixel; moving <= pair.endPixel; moving += 1) {
      if (pair.orientation === "horizontal") {
        mask[pair.faceAFixedPixel * image.width + moving] = 1;
        mask[pair.faceBFixedPixel * image.width + moving] = 1;
      } else {
        mask[moving * image.width + pair.faceAFixedPixel] = 1;
        mask[moving * image.width + pair.faceBFixedPixel] = 1;
      }
    }
  }
}

function pairRuns(input: {
  image: GrayImage;
  runs: Run[][];
  horizontal: boolean;
  minSeparation: number;
  maxSeparation: number;
  minOverlapRatio: number;
  minRun: number;
  edgeRatio: number;
  spanRatio: number;
  pixelsPerMeterMoving: number;
  pixelsPerMeterFixed: number;
}) {
  const pairs: BosSourceWallFacePair[] = [];
  let candidateRunCount = 0;
  let rejectedSheetFrameRunCount = 0;
  const frameRejected = new Set<string>();
  for (let fixed = 0; fixed < input.runs.length; fixed += 1) {
    for (const run of input.runs[fixed]) {
      if (isSheetFrameRun(run, input.horizontal, input.image, input.edgeRatio, input.spanRatio)) {
        const key = `${fixed}:${run.start}:${run.end}`;
        if (!frameRejected.has(key)) { frameRejected.add(key); rejectedSheetFrameRunCount += 1; }
        continue;
      }
      candidateRunCount += 1;
      const maxTarget = Math.min(input.runs.length - 1, fixed + input.maxSeparation);
      for (let targetFixed = fixed + input.minSeparation; targetFixed <= maxTarget; targetFixed += 1) {
        for (const other of input.runs[targetFixed]) {
          if (isSheetFrameRun(other, input.horizontal, input.image, input.edgeRatio, input.spanRatio)) continue;
          const shared = overlap(run, other);
          if (shared.length < input.minRun) continue;
          const overlapRatio = shared.length / Math.max(1, Math.min(run.length, other.length));
          if (overlapRatio < input.minOverlapRatio) continue;
          const orientation = input.horizontal ? "horizontal" : "vertical";
          pairs.push({
            id: `source-${orientation}-${fixed}-${targetFixed}-${shared.start}-${shared.end}`,
            orientation,
            faceAFixedPixel: fixed,
            faceBFixedPixel: targetFixed,
            startPixel: shared.start,
            endPixel: shared.end,
            centerFixedPixel: (fixed + targetFixed) / 2,
            lengthMeters: shared.length / input.pixelsPerMeterMoving,
            separationMeters: (targetFixed - fixed) / input.pixelsPerMeterFixed,
          });
        }
      }
    }
  }
  return { pairs, candidateRunCount, rejectedSheetFrameRunCount };
}

/** Independent rendered-pixel two-face wall evidence. */
export function buildSourceWallFaceMask(input: {
  image: GrayImage;
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  options?: BosSourceWallFaceMaskOptions;
}): BosSourceWallFaceMaskReport {
  const threshold = input.options?.threshold ?? 184;
  const minRun = Math.max(4, Math.round(input.options?.minRunPixels ?? 24));
  const minThicknessMeters = input.options?.minWallThicknessMeters ?? 0.07;
  const maxThicknessMeters = input.options?.maxWallThicknessMeters ?? 0.45;
  const minOverlapRatio = input.options?.minOverlapRatio ?? 0.45;
  const edgeRatio = input.options?.sheetFrameEdgeRatio ?? 0.07;
  const spanRatio = input.options?.sheetFrameSpanRatio ?? 0.55;
  if (!(input.sourceWidthMeters > 0) || !(input.sourceHeightMeters > 0)) throw new Error("Source wall-face masking requires positive source dimensions in meters.");
  if (!input.image.width || !input.image.height || input.image.data.length !== input.image.width * input.image.height) throw new Error("Source wall-face masking requires a valid grayscale source image.");

  const pixelsPerMeterX = input.image.width / input.sourceWidthMeters;
  const pixelsPerMeterY = input.image.height / input.sourceHeightMeters;
  const horizontalRuns = extractRuns(input.image, true, threshold, minRun);
  const verticalRuns = extractRuns(input.image, false, threshold, minRun);
  const horizontal = pairRuns({
    image: input.image, runs: horizontalRuns, horizontal: true,
    minSeparation: Math.max(2, Math.round(minThicknessMeters * pixelsPerMeterY)),
    maxSeparation: Math.max(2, Math.round(maxThicknessMeters * pixelsPerMeterY)),
    minOverlapRatio, minRun, edgeRatio, spanRatio,
    pixelsPerMeterMoving: pixelsPerMeterX, pixelsPerMeterFixed: pixelsPerMeterY,
  });
  const vertical = pairRuns({
    image: input.image, runs: verticalRuns, horizontal: false,
    minSeparation: Math.max(2, Math.round(minThicknessMeters * pixelsPerMeterX)),
    maxSeparation: Math.max(2, Math.round(maxThicknessMeters * pixelsPerMeterX)),
    minOverlapRatio, minRun, edgeRatio, spanRatio,
    pixelsPerMeterMoving: pixelsPerMeterY, pixelsPerMeterFixed: pixelsPerMeterX,
  });
  const wallFacePairs = [...horizontal.pairs, ...vertical.pairs];
  const mask = new Uint8Array(input.image.width * input.image.height);
  paintSourceWallFacePairs(mask, input.image, wallFacePairs);
  let wallFacePixelCount = 0;
  for (const value of mask) if (value) wallFacePixelCount += 1;
  return {
    mask, wallFacePairs, wallFacePixelCount,
    pairedRunCount: wallFacePairs.length,
    horizontalPairCount: horizontal.pairs.length,
    verticalPairCount: vertical.pairs.length,
    candidateRunCount: horizontal.candidateRunCount + vertical.candidateRunCount,
    rejectedSheetFrameRunCount: horizontal.rejectedSheetFrameRunCount + vertical.rejectedSheetFrameRunCount,
    diagnostics: [
      `Rendered-source wall-face mask identified ${wallFacePixelCount} pixels across ${wallFacePairs.length} parallel run pairs.`,
      `Wall-face pairing used ${minThicknessMeters.toFixed(2)}–${maxThicknessMeters.toFixed(2)} m real-world separation and ${(minOverlapRatio * 100).toFixed(0)}% minimum overlap.`,
      `${horizontal.rejectedSheetFrameRunCount + vertical.rejectedSheetFrameRunCount} majority-page perimeter runs were excluded before wall-face pairing.`,
      "Rendered-source wall-face evidence is derived directly from source pixels and does not reuse reconstructed wall geometry or raster segment IDs.",
    ],
  };
}
