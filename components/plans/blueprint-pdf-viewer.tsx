"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";
import { BlueprintMarkupSurface } from "./blueprint-markup-surface";

type Props = {
  fileUrl: string; fileName: string; companyId: string; projectId: string;
  versionId: string; userId: string; discipline: string; zoom: number; position: { x: number; y: number };
  dragging: boolean; onToolChange: (isMarkingUp: boolean) => void;
};

export function BlueprintPdfViewer(props: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let loaded: PDFDocumentProxy | null = null;
    void import("pdfjs-dist").then(async (pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
      loaded = await pdfjs.getDocument({ url: props.fileUrl }).promise;
      if (!active) return loaded.destroy();
      setPdf(loaded);
      setError(null);
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not render this PDF plan.");
    });
    return () => { active = false; if (loaded) void loaded.destroy(); };
  }, [props.fileUrl]);

  useEffect(() => {
    if (!pdf || !canvasRef.current) return;
    let active = true;
    let task: RenderTask | null = null;
    void pdf.getPage(pageNumber).then((page) => {
      if (!active || !canvasRef.current) return;
      const viewport = page.getViewport({ scale: 1.6 });
      canvasRef.current.width = Math.floor(viewport.width);
      canvasRef.current.height = Math.floor(viewport.height);
      task = page.render({ canvas: canvasRef.current, viewport });
      return task.promise;
    }).catch((reason: unknown) => {
      if (active && (reason as { name?: string }).name !== "RenderingCancelledException") {
        setError(reason instanceof Error ? reason.message : "Could not render this PDF page.");
      }
    });
    return () => { active = false; task?.cancel(); };
  }, [pageNumber, pdf]);

  return (
    <BlueprintMarkupSurface
      companyId={props.companyId} projectId={props.projectId} versionId={props.versionId} userId={props.userId}
      discipline={props.discipline}
      pageNumber={pageNumber}
      toolbarExtra={
        <div className="flex items-center gap-1 rounded-md border border-white/15 bg-white/10 px-1 py-0.5">
          <button type="button" aria-label="Previous PDF page" disabled={pageNumber <= 1} onClick={() => setPageNumber((value) => Math.max(1, value - 1))} className="rounded p-0.5 hover:bg-white/15 disabled:opacity-35"><ChevronLeft size={14} /></button>
          <span className="min-w-16 text-center text-[10px] font-semibold">Page {pageNumber}/{pdf?.numPages ?? "…"}</span>
          <button type="button" aria-label="Next PDF page" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((value) => Math.min(pdf?.numPages ?? value, value + 1))} className="rounded p-0.5 hover:bg-white/15 disabled:opacity-35"><ChevronRight size={14} /></button>
        </div>
      }
      transform={`translate3d(${props.position.x}px, ${props.position.y}px, 0) scale(${props.zoom / 100})`}
      transition={props.dragging ? "none" : "transform 140ms ease-out"} onToolChange={props.onToolChange}
    >
      <div className="relative">
        <canvas ref={canvasRef} aria-label={`${props.fileName}, page ${pageNumber}`} className="block max-h-full max-w-full bg-white object-contain" />
        {!pdf && !error ? <div className="absolute inset-0 flex min-h-72 items-center justify-center bg-white text-sm font-semibold text-slate-600">Rendering PDF…</div> : null}
        {error ? <div className="absolute inset-0 flex min-h-72 items-center justify-center bg-red-50 p-4 text-center text-sm font-semibold text-red-800">{error}</div> : null}
      </div>
    </BlueprintMarkupSurface>
  );
}
