import type { BosRawSegment } from "./geometry";
import type { BosParsedPage } from "./plan-parser";
import type { BosTextToken } from "./dimensions";

type Matrix = [number, number, number, number, number, number];
type OperatorList = { fnArray: number[]; argsArray: unknown[][] };
type PdfOps = Record<string, number>;

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

function extractPathSegments(operatorList: OperatorList, ops: PdfOps, pageNumber: number): BosRawSegment[] {
  const output: BosRawSegment[] = [];
  const matrixStack: Matrix[] = [];
  let ctm: Matrix = [1, 0, 0, 1, 0, 0];
  let lineWidth = 0;

  for (let index = 0; index < operatorList.fnArray.length; index += 1) {
    const fn = operatorList.fnArray[index];
    const args = operatorList.argsArray[index] || [];
    if (fn === ops.save) {
      matrixStack.push([...ctm] as Matrix);
      continue;
    }
    if (fn === ops.restore) {
      ctm = matrixStack.pop() || [1, 0, 0, 1, 0, 0];
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
    if (fn !== ops.constructPath) continue;

    const pathOps = asNumbers(args[0]);
    const coords = asNumbers(args[1]);
    if (!pathOps.length || !coords.length) continue;
    let cursor = 0;
    let current: { x: number; y: number } | null = null;
    let subpathStart: { x: number; y: number } | null = null;

    const emit = (from: { x: number; y: number }, to: { x: number; y: number }) => {
      const start = transformPoint(ctm, from.x, from.y);
      const end = transformPoint(ctm, to.x, to.y);
      if (Math.hypot(end.x - start.x, end.y - start.y) < 0.25) return;
      output.push({
        start,
        end,
        sourcePage: pageNumber,
        sourceObjectId: `pdf-path-${pageNumber}-${index}`,
        strokeWidth: lineWidth || undefined,
        confidence: 0.96,
      });
    };

    for (const pathOp of pathOps) {
      if (pathOp === ops.moveTo) {
        if (cursor + 1 >= coords.length) break;
        current = { x: coords[cursor], y: coords[cursor + 1] };
        subpathStart = current;
        cursor += 2;
      } else if (pathOp === ops.lineTo) {
        if (!current || cursor + 1 >= coords.length) break;
        const next = { x: coords[cursor], y: coords[cursor + 1] };
        emit(current, next);
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
        current = p1;
        subpathStart = p1;
        cursor += 4;
      } else if (pathOp === ops.closePath) {
        if (current && subpathStart) emit(current, subpathStart);
        current = subpathStart;
      } else if (pathOp === ops.curveTo) {
        // Curves are not promoted to walls. Consume their six coordinates while retaining the endpoint.
        if (cursor + 5 >= coords.length) break;
        current = { x: coords[cursor + 4], y: coords[cursor + 5] };
        cursor += 6;
      } else if (pathOp === ops.curveTo2 || pathOp === ops.curveTo3) {
        if (cursor + 3 >= coords.length) break;
        current = { x: coords[cursor + 2], y: coords[cursor + 3] };
        cursor += 4;
      }
    }
  }
  return output;
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
      const vectorSegments = extractPathSegments(operators, pdfjs.OPS as unknown as PdfOps, pageNumber);
      pages.push({
        pageNumber,
        width: viewport.width,
        height: viewport.height,
        text,
        vectorSegments,
        rasterRequired: vectorSegments.length < 8,
      });
      page.cleanup();
    }
  } finally {
    await document.destroy();
  }
  return pages;
}
