"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import { Expand, Hand, Maximize2, Minus, Plus, RotateCcw } from "lucide-react";

type Blueprint2dViewerProps = {
  fileUrl: string;
  fileName: string;
  previewType: "image" | "pdf";
};

const MIN_ZOOM = 50;
const MAX_ZOOM = 300;
const ZOOM_STEP = 25;

export function Blueprint2dViewer({ fileUrl, fileName, previewType }: Blueprint2dViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number; originX: number; originY: number } | null>(null);
  const [zoom, setZoom] = useState(100);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const updateZoom = (nextZoom: number) => {
    const boundedZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
    setZoom(boundedZoom);
    if (boundedZoom <= 100) setPosition({ x: 0, y: 0 });
  };

  const resetView = () => {
    setZoom(100);
    setPosition({ x: 0, y: 0 });
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (previewType !== "image" || zoom <= 100 || event.button !== 0) return;
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      originX: position.x,
      originY: position.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    setPosition({
      x: drag.originX + event.clientX - drag.x,
      y: drag.originY + event.clientY - drag.y,
    });
  };

  const stopDragging = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    if (previewType !== "image" || !event.ctrlKey) return;
    event.preventDefault();
    updateZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  const openFullscreen = async () => {
    if (!viewerRef.current?.requestFullscreen) return;
    try {
      await viewerRef.current.requestFullscreen();
    } catch {
      // The browser may deny fullscreen when the document is embedded or permission is unavailable.
    }
  };

  const pdfUrl = `${fileUrl}#zoom=${zoom}`;

  return (
    <div
      ref={viewerRef}
      className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-slate-950 shadow-inner"
      data-orion-region="blueprint-2d-viewer"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-slate-900 px-2.5 py-2 text-white">
        <div className="flex items-center gap-1.5">
          <ToolButton
            label="Zoom out"
            disabled={zoom <= MIN_ZOOM}
            onClick={() => updateZoom(zoom - ZOOM_STEP)}
          >
            <Minus size={15} aria-hidden="true" />
          </ToolButton>
          <span className="min-w-12 text-center text-xs font-semibold tabular-nums" aria-live="polite">
            {zoom}%
          </span>
          <ToolButton
            label="Zoom in"
            disabled={zoom >= MAX_ZOOM}
            onClick={() => updateZoom(zoom + ZOOM_STEP)}
          >
            <Plus size={15} aria-hidden="true" />
          </ToolButton>
          <ToolButton label="Reset view" onClick={resetView}>
            <RotateCcw size={14} aria-hidden="true" />
          </ToolButton>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-300">
          {previewType === "image" ? (
            <span className="hidden items-center gap-1 sm:inline-flex">
              <Hand size={13} aria-hidden="true" />
              Zoom, then drag to pan
            </span>
          ) : (
            <span className="hidden sm:inline">Scroll inside the plan to pan</span>
          )}
          <ToolButton label="View fullscreen" onClick={() => void openFullscreen()}>
            <Maximize2 size={15} aria-hidden="true" />
          </ToolButton>
        </div>
      </div>

      <div
        className={`relative flex h-80 items-center justify-center overflow-hidden bg-slate-800 sm:h-96 ${
          previewType === "image" && zoom > 100 ? (dragging ? "cursor-grabbing touch-none" : "cursor-grab touch-none") : ""
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopDragging}
        onPointerCancel={stopDragging}
        onWheel={handleWheel}
      >
        {previewType === "pdf" ? (
          <iframe
            key={pdfUrl}
            src={pdfUrl}
            title={`Interactive preview ${fileName}`}
            className="h-full w-full bg-white"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={fileUrl}
            alt={fileName}
            draggable={false}
            className="max-h-full max-w-full select-none object-contain will-change-transform"
            style={{
              transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${zoom / 100})`,
              transition: dragging ? "none" : "transform 140ms ease-out",
            }}
          />
        )}
      </div>

      <div className="flex items-center justify-between border-t border-white/10 bg-slate-900 px-3 py-1.5 text-[10px] font-medium text-slate-400">
        <span className="truncate">{fileName}</span>
        <span className="ml-3 inline-flex shrink-0 items-center gap-1">
          <Expand size={11} aria-hidden="true" /> Interactive 2D
        </span>
      </div>
    </div>
  );
}

function ToolButton({
  label,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-white/15 bg-white/10 text-white transition hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
