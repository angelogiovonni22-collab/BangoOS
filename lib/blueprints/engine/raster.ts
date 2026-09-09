import type { BosRawSegment } from "./geometry";

export type RasterLineOptions = {
  maxDimension: number;
  threshold: number;
  minRunPixels: number;
  gapPixels: number;
  mergeBandPixels: number;
  density: number;
};

export const DEFAULT_RASTER_LINE_OPTIONS: RasterLineOptions = {
  maxDimension: 2400,
  threshold: 184,
  minRunPixels: 34,
  gapPixels: 3,
  mergeBandPixels: 3,
  density: 180,
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

type SharpFactory = (buffer: Buffer, options: { failOn: "none"; page?: number; density?: number }) => SharpImage;

type CanvasSurface = {
  getContext(type: "2d"): unknown;
  toBuffer(type: "image/png"): Buffer;
};

type CanvasModule = {
  createCanvas?: (width: number, height: number) => CanvasSurface;
};

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

export async function renderBlueprintPdfPage(buffer: Buffer, options: RasterLineOptions, pageNumber: number): Promise<Buffer> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  // pdfjs-dist already carries @napi-rs/canvas as its optional Node renderer. Keep this indirect
  // so B.O.S. does not introduce a second PDF renderer or dependency merely for raster fallback.
  const canvasModuleName = "@napi-rs/canvas";
  let canvasModule: CanvasModule;
  try {
    canvasModule = await import(canvasModuleName) as CanvasModule;
  } catch {
    throw new Error("PDF raster rendering is unavailable on this deployment.");
  }
  if (typeof canvasModule.createCanvas !== "function") throw new Error("PDF raster rendering is unavailable on this deployment.");

  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  try {
    if (pageNumber < 1 || pageNumber > document.numPages) throw new Error("Selected Blueprint PDF page is out of range.");
    const page = await document.getPage(pageNumber);
    const baseViewport = page.getViewport({ scale: 1 });
    const longest = Math.max(baseViewport.width, baseViewport.height);
    const scale = Math.max(1, Math.min(4, options.maxDimension / Math.max(1, longest)));
    const viewport = page.getViewport({ scale });
    const canvas = canvasModule.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    const canvasContext = canvas.getContext("2d");
    await page.render({ canvasContext, viewport } as never).promise;
    page.cleanup();
    return canvas.toBuffer("image/png");
  } finally {
    await document.destroy();
  }
}

async function decodeGray(buffer: Buffer, options: RasterLineOptions, page: number): Promise<GrayImage> {
  const sharp = await loadSharp();
  const isPdf = buffer.subarray(0, 5).toString("ascii") === "%PDF-";
  const sourceBuffer = isPdf ? await renderBlueprintPdfPage(buffer, options, page) : buffer;
  const image = sharp(sourceBuffer, {
    failOn: "none",
    page: isPdf ? undefined : Math.max(0, page - 1),
    density: options.density,
  }).greyscale().normalize();
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

function lineKey(segment: BosRawSegment, bandX: number, bandY: number) {
  const horizontal = Math.abs(segment.end.x - segment.start.x) >= Math.abs(segment.end.y - segment.start.y);
  return horizontal
    ? `h:${Math.round(segment.start.y / bandY)}:${Math.round(Math.min(segment.start.x, segment.end.x) / bandX)}:${Math.round(Math.max(segment.start.x, segment.end.x) / bandX)}`
    : `v:${Math.round(segment.start.x / bandX)}:${Math.round(Math.min(segment.start.y, segment.end.y) / bandY)}:${Math.round(Math.max(segment.start.y, segment.end.y) / bandY)}`;
}

function dedupeBands(segments: BosRawSegment[], bandX: number, bandY: number) {
  const selected = new Map<string, BosRawSegment>();
  for (const segment of segments) {
    const key = lineKey(segment, bandX, bandY);
    const current = selected.get(key);
    const length = Math.hypot(segment.end.x - segment.start.x, segment.end.y - segment.start.y);
    const currentLength = current ? Math.hypot(current.end.x - current.start.x, current.end.y - current.start.y) : 0;
    if (!current || length > currentLength) selected.set(key, segment);
  }
  return [...selected.values()];
}

export async function extractRasterLineSegments(
  buffer: Buffer,
  input: {
    page: number;
    drawingUnitsPerMeter?: number | null;
    sourceWidth?: number | null;
    sourceHeight?: number | null;
    options?: Partial<RasterLineOptions>;
  },
): Promise<{ segments: BosRawSegment[]; width: number; height: number; diagnostics: string[] }> {
  const options = { ...DEFAULT_RASTER_LINE_OPTIONS, ...(input.options || {}) };
  const image = await decodeGray(buffer, options, input.page);
  const segments: BosRawSegment[] = [];

  const sourceWidth = input.sourceWidth && input.sourceWidth > 0 ? input.sourceWidth : image.width / image.sourceScale;
  const sourceHeight = input.sourceHeight && input.sourceHeight > 0 ? input.sourceHeight : image.height / image.sourceScale;
  const sourcePerPixelX = sourceWidth / image.width;
  const sourcePerPixelY = sourceHeight / image.height;
  const drawingToMeters = input.drawingUnitsPerMeter && input.drawingUnitsPerMeter > 0 ? 1 / input.drawingUnitsPerMeter : 1;
  const factorX = sourcePerPixelX * drawingToMeters;
  const factorY = sourcePerPixelY * drawingToMeters;

  for (let y = 0; y < image.height; y += 1) {
    const row = new Array<boolean>(image.width);
    const offset = y * image.width;
    for (let x = 0; x < image.width; x += 1) row[x] = isInk(image.data[offset + x], options.threshold);
    for (const [start, end] of findRuns(row, options.minRunPixels, options.gapPixels)) {
      segments.push({
        sourcePage: input.page,
        start: { x: start * factorX, y: y * factorY },
        end: { x: end * factorX, y: y * factorY },
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
        start: { x: x * factorX, y: start * factorY },
        end: { x: x * factorX, y: end * factorY },
        sourceObjectId: `raster-v-${x}-${start}`,
        confidence: 0.62,
      });
    }
  }

  const bandPixels = Math.max(1, options.mergeBandPixels);
  const deduped = dedupeBands(segments, bandPixels * factorX, bandPixels * factorY);
  return {
    segments: deduped,
    width: image.width * factorX,
    height: image.height * factorY,
    diagnostics: [
      `Raster line extraction produced ${deduped.length} orthogonal candidates from selected page ${input.page} at ${image.width}×${image.height} pixels.`,
      input.drawingUnitsPerMeter
        ? "Raster coordinates were mapped back to the selected PDF page coordinate space and normalized to meters using the verified drawing scale."
        : "Raster coordinates remain unscaled and cannot be promoted to construction geometry until scale reconciliation succeeds.",
    ],
  };
}
