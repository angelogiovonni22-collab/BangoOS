import type { BosRawSegment } from "./geometry";

export type RasterLineOptions = {
  maxDimension: number;
  threshold: number;
  minRunPixels: number;
  gapPixels: number;
  mergeBandPixels: number;
};

export const DEFAULT_RASTER_LINE_OPTIONS: RasterLineOptions = {
  maxDimension: 2400,
  threshold: 184,
  minRunPixels: 34,
  gapPixels: 3,
  mergeBandPixels: 3,
};

type GrayImage = { data: Uint8Array; width: number; height: number; sourceScale: number };

type SharpImage = {
  greyscale(): SharpImage;
  normalize(): SharpImage;
  metadata(): Promise<{ width?: number; height?: number }>;
  resize(options: { width: number; height: number; fit: "fill" }): SharpImage;
  raw(): SharpImage;
  toBuffer(options: { resolveWithObject: true }): Promise<{ data: Uint8Array; info: { width: number; height: number } }>;
};

type SharpFactory = (buffer: Buffer, options: { failOn: "none" }) => SharpImage;

async function loadSharp(): Promise<SharpFactory> {
  // Next.js installs sharp as an optional server dependency in production builds. Keep the
  // module name indirect so TypeScript does not require a direct application dependency while
  // the raster path remains server-only and can fail closed when the optional decoder is absent.
  const moduleName = "sharp";
  try {
    const sharpModule = await import(moduleName) as { default?: SharpFactory } & Partial<SharpFactory>;
    const factory = sharpModule.default || (sharpModule as unknown as SharpFactory);
    if (typeof factory !== "function") throw new Error("invalid sharp module");
    return factory;
  } catch {
    throw new Error("Raster Blueprint decoding is unavailable on this deployment.");
  }
}

async function decodeGray(buffer: Buffer, options: RasterLineOptions): Promise<GrayImage> {
  const sharp = await loadSharp();
  const image = sharp(buffer, { failOn: "none" }).greyscale().normalize();
  const metadata = await image.metadata();
  const width = metadata.width || 0;
  const height = metadata.height || 0;
  if (!width || !height) throw new Error("B.O.S. could not decode the raster Blueprint image.");
  const largest = Math.max(width, height);
  const sourceScale = largest > options.maxDimension ? options.maxDimension / largest : 1;
  const resized = sourceScale < 1
    ? image.resize({ width: Math.round(width * sourceScale), height: Math.round(height * sourceScale), fit: "fill" })
    : image;
  const { data, info } = await resized.raw().toBuffer({ resolveWithObject: true });
  return { data: new Uint8Array(data), width: info.width, height: info.height, sourceScale };
}

function isInk(value: number, threshold: number) {
  return value <= threshold;
}

function findRuns(values: boolean[], minRun: number, gap: number) {
  const runs: Array<[number, number]> = [];
  let start = -1;
  let lastInk = -1;
  for (let i = 0; i < values.length; i += 1) {
    if (values[i]) {
      if (start < 0) start = i;
      lastInk = i;
      continue;
    }
    if (start >= 0 && i - lastInk > gap) {
      if (lastInk - start + 1 >= minRun) runs.push([start, lastInk]);
      start = -1;
      lastInk = -1;
    }
  }
  if (start >= 0 && lastInk - start + 1 >= minRun) runs.push([start, lastInk]);
  return runs;
}

function lineKey(segment: BosRawSegment, band: number) {
  const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
  return horizontal
    ? `h:${Math.round(segment.start.y / band)}:${Math.round(Math.min(segment.start.x, segment.end.x) / band)}:${Math.round(Math.max(segment.start.x, segment.end.x) / band)}`
    : `v:${Math.round(segment.start.x / band)}:${Math.round(Math.min(segment.start.y, segment.end.y) / band)}:${Math.round(Math.max(segment.start.y, segment.end.y) / band)}`;
}

function dedupeBands(segments: BosRawSegment[], band: number) {
  const selected = new Map<string, BosRawSegment>();
  for (const segment of segments) {
    const key = lineKey(segment, band);
    const current = selected.get(key);
    const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
    const currentLength = current ? Math.hypot(current.end.x - current.start.x, current.end.y - current.start.y) : 0;
    if (!current || length > currentLength) selected.set(key, segment);
  }
  return [...selected.values()];
}

export async function extractRasterLineSegments(
  buffer: Buffer,
  input: { page: number; drawingUnitsPerMeter?: number | null; options?: Partial<RasterLineOptions> },
): Promise<{ segments: BosRawSegment[]; width: number; height: number; diagnostics: string[] }> {
  const options = { ...DEFAULT_RASTER_LINE_OPTIONS, ...(input.options || {}) };
  const image = await decodeGray(buffer, options);
  const segments: BosRawSegment[] = [];
  const factor = input.drawingUnitsPerMeter && input.drawingUnitsPerMeter > 0
    ? 1 / (input.drawingUnitsPerMeter * image.sourceScale)
    : 1 / image.sourceScale;

  for (let y = 0; y < image.height; y += 1) {
    const row = new Array<boolean>(image.width);
    const offset = y * image.width;
    for (let x = 0; x < image.width; x += 1) row[x] = isInk(image.data[offset + x], options.threshold);
    for (const [start, end] of findRuns(row, options.minRunPixels, options.gapPixels)) {
      segments.push({
        sourcePage: input.page,
        start: { x: start * factor, y: y * factor },
        end: { x: end * factor, y: y * factor },
        sourceObjectId: `raster-h-${y}-${start}`,
        confidence: 0.62,
      });
    }
  }

  for (let x = 0; x < image.width; x += 1) {
    const column = new Array<boolean>(image.height);
    for (let y = 0; y < image.height; y += 1) column[y] = isInk(image.data[y * image.width + x], options.threshold);
    for (const [start, end] of findRuns(column, options.minRunPixels, options.gapPixels)) {
      segments.push({
        sourcePage: input.page,
        start: { x: x * factor, y: start * factor },
        end: { x: x * factor, y: end * factor },
        sourceObjectId: `raster-v-${x}-${start}`,
        confidence: 0.62,
      });
    }
  }

  const deduped = dedupeBands(segments, Math.max(1, options.mergeBandPixels) * factor);
  return {
    segments: deduped,
    width: image.width * factor,
    height: image.height * factor,
    diagnostics: [
      `Raster line extraction produced ${deduped.length} orthogonal candidates from ${image.width}×${image.height} pixels.`,
      input.drawingUnitsPerMeter ? "Raster coordinates were normalized to meters using the verified drawing scale." : "Raster coordinates remain in source-image units until scale reconciliation succeeds.",
    ],
  };
}