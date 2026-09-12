import type { BosRawSegment } from "./geometry";
import type { BosParsedPage, BosPdfPathCommand, BosPdfVectorPrimitive } from "./plan-parser";
import type { BosTextToken } from "./dimensions";

type Matrix = [number, number, number, number, number, number];
type OperatorList = { fnArray: number[]; argsArray: unknown[][] };
type PdfOps = Record<string, number>;

type VectorExtraction = {
  segments: BosRawSegment[];
  primitives: BosPdfVectorPrimitive[];
};

function multiply(left: Matrix, right: Matrix): Matrix {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function transformPoint(matrix: Matrix, x: number, y: number) {
  return { x: matrix[0] * x + matrix[2] * y + matrix[4], y: matrix[1] * x + matrix[3] * y + matrix[5] };
}

function asNumbers(value: unknown): number[] {
  if (Array.isArray(value)) return value.filter((item): item is number => typeof item === "number" && Number.isFinite(item));
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>).filter(Number.isFinite);
  return [];
}

function readTextItems(content: { items?: unknown[] }, pageNumber: number): BosTextToken[] {
  const output: BosTextToken[] = [];
  for (const raw of content.items || []) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;
    if (typeof item.str !== "string" || !item.str.trim()) continue;
    const matrix = asNumbers(item.transform);
    output.push({
      text: item.str.trim(),
      page: pageNumber,
      x: matrix.length >= 6 ? matrix[4] : undefined,
      y: matrix.length >= 6 ? matrix[5] : undefined,
      width: typeof item.width === "number" ? item.width : undefined,
      height: typeof item.height === "number" ? item.height : undefined,
    });
  }
  return output;
}

/**
 * Extract native PDF path evidence without collapsing it to wall candidates. The legacy straight
 * segments remain available for the current reconstruction path, while vectorPrimitives retain
 * transformed path commands and stroke metadata for exact source reproduction/classification.
 */
export function extractPdfPathGeometry(operatorList: OperatorList, ops: PdfOps, pageNumber: number): VectorExtraction {
  const segments: BosRawSegment[] = [];
  const primitives: BosPdfVectorPrimitive[] = [];
  const matrixStack: Array<{ ctm: Matrix; lineWidth: number; dashArray: number[]; dashPhase: number }> = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let lineWidth = 0;
  let dashArray: number[] = [];
  let dashPhase = 0;

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] || [];
    if (fn === ops.save) {
      matrixStack.push({ ctm: [...ctm] as Matrix, lineWidth, dashArray: [...dashArray], dashPhase });
      continue;
    }
    if (fn === ops.restore) {
      const restored = matrixStack.pop();
      ctm = restored?.ctm || [1, 0, 0, 1, 0, 0];
      lineWidth = restored?.lineWidth || 0;
      dashArray = restored?.dashArray || [];
      dashPhase = restored?.dashPhase || 0;
      continue;
    }
    if (fn === ops.transform) {
      const values = asNumbers(args);
      if (values.length >= 6) ctm = multiply(ctm, values.slice(0, 6) as Matrix);
      continue;
    }
    if (fn === ops.setLineWidth) {
      const values = asNumbers(args);
      lineWidth = values[0] || 0;
      continue;
    }
    if (fn === ops.setDash) {
      dashArray = asNumbers(args[0]);
      const phase = asNumbers(args[1]);
      dashPhase = phase[0] || (typeof args[1] === "number" ? args[1] : 0);
      continue;
    }
    if (fn !== ops.constructPath) continue;

    const pathOps = asNumbers(args[0]);
    const coords = asNumbers(args[1]);
    if (!pathOps.length) continue;
    let cursor = 0;
    let current: { x: number; y: number } | null = null;
    let subpathStart: { x: number; y: number } | null = null;
    const commands: BosPdfPathCommand[] = [];
    const sourceObjectId = `pdf-path-${pageNumber}-${index}`;

    const emit = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const start = transformPoint(ctm, from.x, from.y);
      const end = transformPoint(ctm, to.x, to.y);
      if (Math.hypot(end.x - start.x, end.y - start.y) < 0.25) return;
      segments.push({
        start,
        end,
        sourcePage: pageNumber,
        sourceObjectId,
        strokeWidth: lineWidth || undefined,
        confidence: 0.96,
      });
    };

    for (const pathOp of pathOps) {
      if (pathOp === ops.moveTo) {
        if (cursor + 1 >= coords.length) break;
        current = { x: coords[cursor], y: coords[cursor + 1] };
        subpathStart = current;
        commands.push({ kind: "moveTo", point: transformPoint(ctm, current.x, current.y) });
        cursor += 2;
      } else if (pathOp === ops.lineTo) {
        if (!current || cursor + 1 >= coords.length) break;
        const next = { x: coords[cursor], y: coords[cursor + 1] };
        emit(current, next);
        commands.push({ kind: "lineTo", point: transformPoint(ctm, next.x, next.y) });
        current = next;
        cursor += 2;
      } else if (pathOp === ops.rectangle) {
        if (cursor + 3 >= coords.length) break;
        const x = coords[cursor];
        const y = coords[cursor + 1];
        const width = coords[cursor + 2];
        const height = coords[cursor + 3];
        const p1 = { x, y };
        const p2 = { x: x + width, y };
        const p3 = { x: x + width, y: y + height };
        const p4 = { x, y: y + height };
        emit(p1, p2); emit(p2, p3); emit(p3, p4); emit(p4, p1);
        commands.push({
          kind: "rectangle",
          points: [
            transformPoint(ctm, p1.x, p1.y),
            transformPoint(ctm, p2.x, p2.y),
            transformPoint(ctm, p3.x, p3.y),
            transformPoint(ctm, p4.x, p4.y),
          ],
        });
        current = p1;
        subpathStart = p1;
        cursor += 4;
      } else if (pathOp === ops.closePath) {
        if (current && subpathStart) emit(current, subpathStart);
        commands.push({ kind: "closePath" });
        current = subpathStart;
      } else if (pathOp === ops.curveTo) {
        if (cursor + 5 >= coords.length) break;
        const control1 = { x: coords[cursor], y: coords[cursor + 1] };
        const control2 = { x: coords[cursor + 2], y: coords[cursor + 3] };
        const point = { x: coords[cursor + 4], y: coords[cursor + 5] };
        commands.push({
          kind: "curveTo",
          control1: transformPoint(ctm, control1.x, control1.y),
          control2: transformPoint(ctm, control2.x, control2.y),
          point: transformPoint(ctm, point.x, point.y),
        });
        current = point;
        cursor += 6;
      } else if (pathOp === ops.curveTo2 || pathOp === ops.curveTo3) {
        if (cursor + 3 >= coords.length) break;
        const control = { x: coords[cursor], y: coords[cursor + 1] };
        const point = { x: coords[cursor + 2], y: coords[cursor + 3] };
        commands.push({
          kind: pathOp === ops.curveTo2 ? "curveTo2" : "curveTo3",
          control: transformPoint(ctm, control.x, control.y),
          point: transformPoint(ctm, point.x, point.y),
        });
        current = point;
        cursor += 4;
      }
    }

    if (commands.length) {
      primitives.push({
        id: sourceObjectId,
        page: pageNumber,
        commands,
        lineWidth: lineWidth || undefined,
        dashArray: dashArray.length ? [...dashArray] : undefined,
        dashPhase: dashArray.length ? dashPhase : undefined,
      });
    }
  }
  return { segments, primitives };
}

export async function parsePdfVectorPlan(buffer: Buffer): Promise<BosParsedPage[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const document = await loadingTask.promise;
  const pages: BosParsedPage[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const [textContent, rawOperators] = await Promise.all([page.getTextContent(), page.getOperatorList()]);
      const operators = rawOperators as unknown as OperatorList;
      const text = readTextItems(textContent as unknown as { items?: unknown[] }, pageNumber);
      const vector = extractPdfPathGeometry(operators, pdfjs.OPS as unknown as PdfOps, pageNumber);
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        text,
        vectorSegments: vector.segments,
        vectorPrimitives: vector.primitives,
        rasterRequired: vector.segments.length < 8,
      });
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pages;
}
