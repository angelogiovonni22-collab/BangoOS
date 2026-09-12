import type { BosDimension, BosScale, BosSourceEvidence } from "./building-graph";

const FEET_TO_METERS = 0.3048;
const INCH_TO_METERS = 0.0254;

export type BosTextToken = {
  text: string;
  page: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
};

function parseMixedNumber(value: string | undefined) {
  if (!value) return 0;
  const normalized = value.trim();
  if (!normalized) return 0;
  const mixed = normalized.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixed) {
    const whole = Number(mixed[1]);
    const numerator = Number(mixed[2]);
    const denominator = Number(mixed[3]);
    if (Number.isFinite(whole) && Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) {
      const fraction = numerator / denominator;
      return whole < 0 ? whole - fraction : whole + fraction;
    }
  }
  const fraction = normalized.match(/^(-?\d+)\s*\/\s*(\d+)$/);
  if (fraction) {
    const numerator = Number(fraction[1]);
    const denominator = Number(fraction[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
  }
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : Number.NaN;
}

export function parseArchitecturalLength(text: string): number | null {
  const normalized = text.trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/\s+/g, " ");
  if (!normalized) return null;

  const feetInches = normalized.match(/^(-?\d+(?:\.\d+)?)\s*'\s*-?\s*(?:(\d+(?:\.\d+)?|\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*(?:"|in)?)?$/i);
  if (feetInches) {
    const feet = Number(feetInches[1]);
    const inches = parseMixedNumber(feetInches[2]);
    if (Number.isFinite(feet) && Number.isFinite(inches)) return feet * FEET_TO_METERS + inches * INCH_TO_METERS;
  }

  const feetOnly = normalized.match(/^(-?\d+(?:\.\d+)?)\s*(?:ft|feet)$/i);
  if (feetOnly) return Number(feetOnly[1]) * FEET_TO_METERS;

  const inchesOnly = normalized.match(/^(-?\d+(?:\.\d+)?|\d+\s+\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*(?:"|in|inch|inches)$/i);
  if (inchesOnly) {
    const inches = parseMixedNumber(inchesOnly[1]);
    return Number.isFinite(inches) ? inches * INCH_TO_METERS : null;
  }

  const meters = normalized.match(/^(-?\d+(?:\.\d+)?)\s*m$/i);
  if (meters) return Number(meters[1]);

  return null;
}

export function parsePrintedScale(text: string): BosScale | null {
  const normalized = text.replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/\s+/g, " ").trim();
  const architectural = normalized.match(/(\d+(?:\s*\/\s*\d+)?(?:\.\d+)?)\s*"\s*=\s*(\d+(?:\.\d+)?)\s*'/);
  if (architectural) {
    const drawingInches = parseFraction(architectural[1]);
    const realFeet = Number(architectural[2]);
    if (drawingInches > 0 && realFeet > 0) {
      const realMetersPerPoint = realFeet * FEET_TO_METERS / (drawingInches * 72);
      return {
        source: "printed",
        drawingUnitsPerMeter: 1 / realMetersPerPoint,
        printedLabel: normalized,
        confidence: 0.98,
      };
    }
  }

  const metric = normalized.match(/1\s*:\s*(\d+(?:\.\d+)?)/);
  if (metric) {
    const ratio = Number(metric[1]);
    if (ratio > 0) {
      const drawingMetersPerPoint = INCH_TO_METERS / 72;
      const realMetersPerPoint = drawingMetersPerPoint * ratio;
      return { source: "printed", drawingUnitsPerMeter: 1 / realMetersPerPoint, printedLabel: normalized, confidence: 0.96 };
    }
  }
  return null;
}

function parseFraction(value: string) {
  const compact = value.replace(/\s+/g, "");
  const parts = compact.split("/");
  if (parts.length === 2) {
    const numerator = Number(parts[0]);
    const denominator = Number(parts[1]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator !== 0) return numerator / denominator;
  }
  const number = Number(compact);
  return Number.isFinite(number) ? number : 0;
}

export function detectScale(tokens: BosTextToken[]) {
  const candidates = tokens.map((token) => ({ token, scale: parsePrintedScale(token.text) })).filter((entry) => entry.scale !== null);
  if (!candidates.length) return { source: "unknown", drawingUnitsPerMeter: null, confidence: 0 } satisfies BosScale;
  candidates.sort((a, b) => (b.scale?.confidence || 0) - (a.scale?.confidence || 0));
  return candidates[0].scale as BosScale;
}

export function detectPrintedDimensions(tokens: BosTextToken[], levelId: string): BosDimension[] {
  const dimensions: BosDimension[] = [];
  for (const token of tokens) {
    const value = parseArchitecturalLength(token.text);
    if (value === null || value <= 0 || value > 500) continue;
    const evidence: BosSourceEvidence = {
      id: `dimension-text-${token.page}-${dimensions.length + 1}`,
      page: token.page,
      kind: "pdf_text",
      text: token.text,
      bbox: token.x === undefined || token.y === undefined ? undefined : {
        x: token.x,
        y: token.y,
        width: token.width || 0,
        height: token.height || 0,
      },
      score: 0.9,
    };
    dimensions.push({
      id: `dimension-${levelId}-${dimensions.length + 1}`,
      levelId,
      page: token.page,
      value,
      unit: "m",
      rawText: token.text,
      confidence: 0.9,
      evidence: [evidence],
    });
  }
  return dimensions;
}

export function inferScaleFromDimensionPairs(input: Array<{ drawingLength: number; realLengthMeters: number; confidence?: number }>): BosScale {
  const valid = input.filter((item) => item.drawingLength > 0 && item.realLengthMeters > 0 && Number.isFinite(item.drawingLength) && Number.isFinite(item.realLengthMeters));
  if (!valid.length) return { source: "unknown", drawingUnitsPerMeter: null, confidence: 0 };
  const ratios = valid.map((item) => item.drawingLength / item.realLengthMeters).sort((a, b) => a - b);
  const median = ratios[Math.floor(ratios.length / 2)];
  const deviations = ratios.map((ratio) => Math.abs(ratio - median) / median);
  const consistency = 1 - Math.min(1, deviations.reduce((sum, value) => sum + value, 0) / deviations.length);
  const evidence = valid.reduce((sum, item) => sum + (item.confidence ?? 0.75), 0) / valid.length;
  return {
    source: "dimension_solved",
    drawingUnitsPerMeter: median,
    confidence: Math.max(0, Math.min(0.94, consistency * 0.65 + evidence * 0.35)),
  };
}
