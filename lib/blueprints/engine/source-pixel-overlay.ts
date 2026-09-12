import type { BosLine2 } from "./building-graph";
import { DEFAULT_RASTER_LINE_OPTIONS, renderBlueprintPdfPage } from "./raster";
import type { BosWallSystemCandidate } from "./wall-system-builder";

export type BosGraySourceImage = {
  data: Uint8Array;
  width: number;
  height: number;
};

export type BosSourcePixelOverlayOptions = {
  threshold?: number;
  supportRadiusPixels?: number;
  architecturalRunPixels?: number;
  coverageRadiusPixels?: number;
  sampleStepPixels?: number;
};

export type BosSourcePixelOverlayReport = {
  predictedFaceSampleCount: number;
  supportedFaceSampleCount: number;
  predictedPrecision: number;
  architecturalInkPixelCount: number;
  coveredArchitecturalInkPixelCount: number;
  architecturalRecall: number;
  f1: number;
  unsupportedWallSystemCount: number;
  unsupportedWallSystemIds: string[];
  perWallSupport: Array<{ wallSystemId: string; support: number; samples: number }>;
  diagnostics: string[];
};

type SharpImage = {
  greyscale(): SharpImage;
  normalize(): SharpImage;
  raw(): SharpImage;
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Uint8Array; info: { width: number; height: number } }>;
};
type SharpFactory = (buffer: Buffer, options: { failOn: "none" }) => SharpImage;

async function loadSharp(): Promise<SharpFactory> {
  const moduleName = "sharp";
  try {
    const sharpModule = await import(moduleName) as { default?: SharpFactory } & Partial<SharpFactory>;
    const factory = sharpModule.default || (sharpModule as unknown as SharpFactory);
    if (typeof factory !== "function") throw new Error("invalid sharp module");
    return factory;
  } catch {
    throw new Error("Source-pixel Blueprint validation is unavailable on this deployment.");
  }
}

export async function renderBlueprintGraySource(buffer: Buffer, pageNumber: number): Promise<BosGraySourceImage> {
  const png = await renderBlueprintPdfPage(buffer, DEFAULT_RASTER_LINE_OPTIONS, pageNumber);
  const sharp = await loadSharp();
  const { data, info } = await sharp(png, { failOn: "none" }).greyscale().normalize().raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height };
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function lineLength(line: BosLine2) {
  return Math.hypot(line.end.x - line.start.x, line.end.y - line.start.y);
}

function isInk(image: BosGraySourceImage, x: number, y: number, threshold: number) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return false;
  return image.data[y * image.width + x] <= threshold;
}

function hasInkNear(image: BosGraySourceImage, x: number, y: number, threshold: number, radius: number) {
  const centerX = Math.round(x);
  const centerY = Math.round(y);
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      if (dx * dx + dy * dy > radius * radius) continue;
      if (isInk(image, centerX + dx, centerY + dy, threshold)) return true;
    }
  }
  return false;
}

function toPixelLine(line: BosLine2, widthMeters: number, heightMeters: number, image: BosGraySourceImage): BosLine2 {
  return {
    start: {
      x: line.start.x / widthMeters * image.width,
      y: line.start.y / heightMeters * image.height,
    },
    end: {
      x: line.end.x / widthMeters * image.width,
      y: line.end.y / heightMeters * image.height,
    },
  };
}

function sampleLine(line: BosLine2, stepPixels: number) {
  const length = lineLength(line);
  const count = Math.max(2, Math.ceil(length / Math.max(1, stepPixels)) + 1);
  return Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0 : index / (count - 1);
    return {
      x: line.start.x + (line.end.x - line.start.x) * t,
      y: line.start.y + (line.end.y - line.start.y) * t,
    };
  });
}

function sourceArchitecturalInkMask(image: BosGraySourceImage, threshold: number, minRunPixels: number) {
  const mask = new Uint8Array(image.width * image.height);
  const minRun = Math.max(4, Math.round(minRunPixels));

  for (let y = 0; y < image.height; y += 1) {
    let start = -1;
    for (let x = 0; x <= image.width; x += 1) {
      const ink = x < image.width && isInk(image, x, y, threshold);
      if (ink && start < 0) start = x;
      if ((!ink || x === image.width) && start >= 0) {
        const end = x - 1;
        if (end - start + 1 >= minRun) {
          for (let fill = start; fill <= end; fill += 1) mask[y * image.width + fill] = 1;
        }
        start = -1;
      }
    }
  }

  for (let x = 0; x < image.width; x += 1) {
    let start = -1;
    for (let y = 0; y <= image.height; y += 1) {
      const ink = y < image.height && isInk(image, x, y, threshold);
      if (ink && start < 0) start = y;
      if ((!ink || y === image.height) && start >= 0) {
        const end = y - 1;
        if (end - start + 1 >= minRun) {
          for (let fill = start; fill <= end; fill += 1) mask[fill * image.width + x] = 1;
        }
        start = -1;
      }
    }
  }
  return mask;
}

function candidateCoverageMask(
  systems: readonly BosWallSystemCandidate[],
  image: BosGraySourceImage,
  widthMeters: number,
  heightMeters: number,
  radius: number,
) {
  const mask = new Uint8Array(image.width * image.height);
  for (const system of systems) {
    for (const face of [system.faceA.line, system.faceB.line]) {
      const line = toPixelLine(face, widthMeters, heightMeters, image);
      const points = sampleLine(line, 1);
      for (const point of points) {
        const cx = Math.round(point.x);
        const cy = Math.round(point.y);
        for (let dy = -radius; dy <= radius; dy += 1) {
          for (let dx = -radius; dx <= radius; dx += 1) {
            if (dx * dx + dy * dy > radius * radius) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x < 0 || y < 0 || x >= image.width || y >= image.height) continue;
            mask[y * image.width + x] = 1;
          }
        }
      }
    }
  }
  return mask;
}

/**
 * Validates candidate wall geometry directly against rendered source pixels. It deliberately does
 * not accept extracted raster line segments as truth. Precision asks whether predicted wall faces
 * land on source ink; recall asks whether independently detected long horizontal/vertical source
 * ink is covered by predicted wall faces.
 */
export function assessSourcePixelOverlay(input: {
  image: BosGraySourceImage;
  wallSystems: readonly BosWallSystemCandidate[];
  sourceWidthMeters: number;
  sourceHeightMeters: number;
  options?: BosSourcePixelOverlayOptions;
}): BosSourcePixelOverlayReport {
  const threshold = input.options?.threshold ?? 184;
  const supportRadius = input.options?.supportRadiusPixels ?? 2;
  const architecturalRunPixels = input.options?.architecturalRunPixels ?? 24;
  const coverageRadius = input.options?.coverageRadiusPixels ?? 3;
  const sampleStep = input.options?.sampleStepPixels ?? 3;

  if (!input.image.width || !input.image.height || input.image.data.length !== input.image.width * input.image.height) {
    throw new Error("Source pixel overlay requires a valid grayscale source image.");
  }
  if (!(input.sourceWidthMeters > 0) || !(input.sourceHeightMeters > 0)) {
    throw new Error("Source pixel overlay requires positive source dimensions in meters.");
  }

  const perWallSupport: Array<{ wallSystemId: string; support: number; samples: number }> = [];
  let predictedFaceSampleCount = 0;
  let supportedFaceSampleCount = 0;

  for (const system of input.wallSystems) {
    let wallSamples = 0;
    let wallSupported = 0;
    for (const face of [system.faceA.line, system.faceB.line]) {
      const pixelLine = toPixelLine(face, input.sourceWidthMeters, input.sourceHeightMeters, input.image);
      for (const point of sampleLine(pixelLine, sampleStep)) {
        wallSamples += 1;
        predictedFaceSampleCount += 1;
        if (hasInkNear(input.image, point.x, point.y, threshold, supportRadius)) {
          wallSupported += 1;
          supportedFaceSampleCount += 1;
        }
      }
    }
    perWallSupport.push({
      wallSystemId: system.id,
      support: wallSamples ? wallSupported / wallSamples : 0,
      samples: wallSamples,
    });
  }

  const predictedPrecision = predictedFaceSampleCount ? supportedFaceSampleCount / predictedFaceSampleCount : 0;
  const architecturalMask = sourceArchitecturalInkMask(input.image, threshold, architecturalRunPixels);
  const coverageMask = candidateCoverageMask(
    input.wallSystems,
    input.image,
    input.sourceWidthMeters,
    input.sourceHeightMeters,
    coverageRadius,
  );
  let architecturalInkPixelCount = 0;
  let coveredArchitecturalInkPixelCount = 0;
  for (let index = 0; index < architecturalMask.length; index += 1) {
    if (!architecturalMask[index]) continue;
    architecturalInkPixelCount += 1;
    if (coverageMask[index]) coveredArchitecturalInkPixelCount += 1;
  }
  const architecturalRecall = architecturalInkPixelCount ? coveredArchitecturalInkPixelCount / architecturalInkPixelCount : 0;
  const f1 = predictedPrecision + architecturalRecall > 0
    ? 2 * predictedPrecision * architecturalRecall / (predictedPrecision + architecturalRecall)
    : 0;
  const unsupportedWallSystemIds = perWallSupport.filter((item) => item.support < 0.7).map((item) => item.wallSystemId);

  return {
    predictedFaceSampleCount,
    supportedFaceSampleCount,
    predictedPrecision: clamp(predictedPrecision, 0, 1),
    architecturalInkPixelCount,
    coveredArchitecturalInkPixelCount,
    architecturalRecall: clamp(architecturalRecall, 0, 1),
    f1: clamp(f1, 0, 1),
    unsupportedWallSystemCount: unsupportedWallSystemIds.length,
    unsupportedWallSystemIds,
    perWallSupport,
    diagnostics: [
      `Source-pixel overlay supports ${(predictedPrecision * 100).toFixed(1)}% of predicted wall-face samples directly on rendered source ink.`,
      `Candidate wall faces cover ${(architecturalRecall * 100).toFixed(1)}% of long horizontal/vertical architectural source-ink pixels (F1 ${f1.toFixed(3)}).`,
      `${unsupportedWallSystemIds.length} wall systems have less than 70% direct source-pixel support.`,
      "Source-pixel overlay is computed from the rendered Blueprint page, not from extracted raster segments or canonical Building Graph evidence.",
    ],
  };
}
