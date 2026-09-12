import type { BosTextToken } from "./dimensions";
import type { BosPdfPathCommand, BosPdfVectorPrimitive } from "./plan-parser";

export type BosArchitecturalPrimitiveClass =
  | "wall_face"
  | "dimension_line"
  | "dimension_witness"
  | "door_swing"
  | "window_symbol"
  | "stair"
  | "fixture"
  | "hatch"
  | "grid_reference"
  | "annotation"
  | "unknown";

export type BosClassifiedPrimitive = {
  primitive: BosPdfVectorPrimitive;
  classification: BosArchitecturalPrimitiveClass;
  confidence: number;
  reasons: string[];
};

type Point = { x: number; y: number };
type Segment = { start: Point; end: Point };

type PrimitiveFeatures = {
  bbox: { minX: number; minY: number; maxX: number; maxY: number } | null;
  segments: Segment[];
  totalLength: number;
  curveCount: number;
  lineCount: number;
  rectangleCount: number;
  closed: boolean;
  dominantOrientation: "horizontal" | "vertical" | "diagonal" | "none";
};

function distance(a: Point, b: Point) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function commandPoints(command: BosPdfPathCommand): Point[] {
  switch (command.kind) {
    case "moveTo":
    case "lineTo":
      return [command.point];
    case "rectangle":
      return command.points;
    case "curveTo":
      return [command.control1, command.control2, command.point];
    case "curveTo2":
    case "curveTo3":
      return [command.control, command.point];
    case "closePath":
      return [];
  }
}

function primitiveFeatures(primitive: BosPdfVectorPrimitive): PrimitiveFeatures {
  const points = primitive.commands.flatMap(commandPoints);
  const bbox = points.length ? {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  } : null;
  const segments: Segment[] = [];
  let current: Point | null = null;
  let subpathStart: Point | null = null;
  let curveCount = 0;
  let lineCount = 0;
  let rectangleCount = 0;
  let closed = false;

  for (const command of primitive.commands) {
    if (command.kind === "moveTo") {
      current = command.point;
      subpathStart = command.point;
    } else if (command.kind === "lineTo") {
      if (current) segments.push({ start: current, end: command.point });
      current = command.point;
      lineCount += 1;
    } else if (command.kind === "rectangle") {
      const [a, b, c, d] = command.points;
      segments.push({ start: a, end: b }, { start: b, end: c }, { start: c, end: d }, { start: d, end: a });
      current = a;
      subpathStart = a;
      rectangleCount += 1;
      lineCount += 4;
      closed = true;
    } else if (command.kind === "curveTo" || command.kind === "curveTo2" || command.kind === "curveTo3") {
      current = command.point;
      curveCount += 1;
    } else if (command.kind === "closePath") {
      if (current && subpathStart && distance(current, subpathStart) > 0.01) segments.push({ start: current, end: subpathStart });
      current = subpathStart;
      closed = true;
    }
  }

  const totalLength = segments.reduce((sum, segment) => sum + distance(segment.start, segment.end), 0);
  let horizontal = 0;
  let vertical = 0;
  let diagonal = 0;
  for (const segment of segments) {
    const dx = Math.abs(segment.end.x - segment.start.x);
    const dy = Math.abs(segment.end.y - segment.start.y);
    const length = Math.hypot(dx, dy);
    if (!length) continue;
    if (dy / length <= 0.08) horizontal += length;
    else if (dx / length <= 0.08) vertical += length;
    else diagonal += length;
  }
  const maximum = Math.max(horizontal, vertical, diagonal);
  const dominantOrientation = maximum <= 0
    ? "none"
    : maximum === horizontal
      ? "horizontal"
      : maximum === vertical
        ? "vertical"
        : "diagonal";

  return { bbox, segments, totalLength, curveCount, lineCount, rectangleCount, closed, dominantOrientation };
}

function textBBox(token: BosTextToken) {
  if (token.x === undefined || token.y === undefined) return null;
  return {
    minX: token.x,
    minY: token.y,
    maxX: token.x + (token.width || 0),
    maxY: token.y + (token.height || 0),
  };
}

function expandedIntersects(
  left: { minX: number; minY: number; maxX: number; maxY: number },
  right: { minX: number; minY: number; maxX: number; maxY: number },
  padding: number,
) {
  return left.minX <= right.maxX + padding
    && left.maxX >= right.minX - padding
    && left.minY <= right.maxY + padding
    && left.maxY >= right.minY - padding;
}

function architecturalDimensionToken(token: BosTextToken) {
  const text = token.text.trim().replace(/[’′]/g, "'").replace(/[”″]/g, '"');
  return /^\d+(?:\.\d+)?\s*'\s*-?\s*(?:\d+(?:\s+\d+\/\d+|\/\d+)?\s*")?$/i.test(text)
    || /^\d+(?:\s+\d+\/\d+|\/\d+)?\s*"$/i.test(text);
}

function classifyOne(primitive: BosPdfVectorPrimitive, text: BosTextToken[]): BosClassifiedPrimitive {
  const features = primitiveFeatures(primitive);
  const reasons: string[] = [];
  const bbox = features.bbox;
  const nearbyDimensions = bbox
    ? text.filter((token) => token.page === primitive.page && architecturalDimensionToken(token) && textBBox(token))
      .filter((token) => expandedIntersects(bbox, textBBox(token)!, 18))
    : [];

  if (features.curveCount > 0 && features.totalLength <= 72 && features.lineCount <= 3) {
    reasons.push("compact curved path consistent with an architectural swing symbol");
    return { primitive, classification: "door_swing", confidence: 0.72, reasons };
  }

  if (nearbyDimensions.length && features.lineCount > 0) {
    if (features.totalLength <= 48 && features.dominantOrientation !== "diagonal") {
      reasons.push("short straight primitive is anchored to printed dimension text");
      return { primitive, classification: "dimension_witness", confidence: 0.84, reasons };
    }
    if (features.totalLength > 48 && (primitive.lineWidth === undefined || primitive.lineWidth <= 1.25)) {
      reasons.push("thin straight run is anchored to printed dimension text");
      return { primitive, classification: "dimension_line", confidence: 0.79, reasons };
    }
  }

  if (primitive.dashArray?.length && features.totalLength >= 72) {
    reasons.push("long dashed vector run is more consistent with reference/grid geometry than a wall face");
    return { primitive, classification: "grid_reference", confidence: 0.7, reasons };
  }

  if (features.rectangleCount >= 3 && features.totalLength <= 260) {
    reasons.push("repeated compact rectangles are more consistent with fixture/window/stair symbols than wall faces");
    return { primitive, classification: "fixture", confidence: 0.68, reasons };
  }

  if (features.lineCount >= 5 && features.totalLength <= 220 && features.closed) {
    reasons.push("dense closed short-line path is treated as symbolic/fixture geometry");
    return { primitive, classification: "fixture", confidence: 0.64, reasons };
  }

  if (
    features.curveCount === 0
    && features.lineCount > 0
    && features.totalLength >= 54
    && !primitive.dashArray?.length
    && (primitive.lineWidth === undefined || primitive.lineWidth >= 0.35)
  ) {
    reasons.push("substantial solid straight vector geometry is eligible as wall-face evidence");
    return { primitive, classification: "wall_face", confidence: 0.66, reasons };
  }

  reasons.push("insufficient deterministic architectural evidence");
  return { primitive, classification: "unknown", confidence: 0.35, reasons };
}

/**
 * Classifies preserved PDF primitives without mutating or inventing geometry. Low-confidence
 * evidence remains explicit `unknown` so downstream wall reconstruction can fail closed.
 */
export function classifyArchitecturalPrimitives(
  primitives: readonly BosPdfVectorPrimitive[],
  text: readonly BosTextToken[],
): BosClassifiedPrimitive[] {
  return primitives.map((primitive) => classifyOne(primitive, [...text]));
}

export function summarizePrimitiveClasses(classified: readonly BosClassifiedPrimitive[]) {
  const summary: Record<BosArchitecturalPrimitiveClass, number> = {
    wall_face: 0,
    dimension_line: 0,
    dimension_witness: 0,
    door_swing: 0,
    window_symbol: 0,
    stair: 0,
    fixture: 0,
    hatch: 0,
    grid_reference: 0,
    annotation: 0,
    unknown: 0,
  };
  for (const item of classified) summary[item.classification] += 1;
  return summary;
}
