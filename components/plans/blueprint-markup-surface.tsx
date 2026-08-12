"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { ArrowUpRight, Hand, MapPin, Pencil, Ruler, ScanLine, SquareDashed, Trash2, Type } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  createBlueprintMarkup,
  deleteBlueprintMarkup,
  loadBlueprintMarkups,
  type BlueprintMarkup,
  type BlueprintMarkupType,
} from "@/lib/blueprints/markups";

type MarkupTool = "pan" | BlueprintMarkupType;
type Point = { x: number; y: number };

type BlueprintMarkupSurfaceProps = {
  companyId: string;
  projectId: string;
  versionId: string;
  userId: string;
  children: ReactNode;
  transform: string;
  transition: string;
  onToolChange: (isMarkingUp: boolean) => void;
  pageNumber?: number;
  toolbarExtra?: ReactNode;
};

const colors = ["#ef4444", "#f59e0b", "#2563eb", "#16a34a"];

export function BlueprintMarkupSurface({
  companyId,
  projectId,
  versionId,
  userId,
  children,
  transform,
  transition,
  onToolChange,
  pageNumber = 1,
  toolbarExtra,
}: BlueprintMarkupSurfaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const surfaceRef = useRef<SVGSVGElement>(null);
  const draftRef = useRef<{ pointerId: number; start: Point; points: Point[] } | null>(null);
  const [tool, setTool] = useState<MarkupTool>("pan");
  const [color, setColor] = useState(colors[0]);
  const [note, setNote] = useState("");
  const [knownLength, setKnownLength] = useState("10");
  const [measurementUnit, setMeasurementUnit] = useState<"ft" | "m">("ft");
  const [markups, setMarkups] = useState<BlueprintMarkup[]>([]);
  const [draft, setDraft] = useState<Point[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const identity = useMemo(() => ({ companyId, projectId, versionId }), [companyId, projectId, versionId]);

  const requestMarkups = useCallback(async () => {
    if (!supabase) throw new Error("Blueprint markup storage is unavailable.");
    return loadBlueprintMarkups(supabase, identity);
  }, [identity, supabase]);

  const reload = useCallback(async () => {
    setMarkups(await requestMarkups());
  }, [requestMarkups]);

  useEffect(() => {
    let active = true;
    void requestMarkups()
      .then((next) => {
        if (!active) return;
        setMarkups(next);
        setError(null);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load plan markups.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [requestMarkups]);

  const chooseTool = (nextTool: MarkupTool) => {
    setTool(nextTool);
    onToolChange(nextTool !== "pan");
    setError(null);
  };

  const pointFromEvent = (event: ReactPointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
      y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
    };
  };

  const persist = async (type: BlueprintMarkupType, geometry: Record<string, unknown>, content?: string) => {
    if (!supabase || saving) return;
    setSaving(true);
    setError(null);
    try {
      await createBlueprintMarkup(supabase, { ...identity, userId, type, color, geometry: { ...geometry, page: pageNumber }, content });
      await reload();
      if (type === "pin" || type === "text") setNote("");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this markup.");
    } finally {
      setSaving(false);
      setDraft([]);
      draftRef.current = null;
    }
  };

  const handlePointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "pan" || saving || event.button !== 0) return;
    const point = pointFromEvent(event);

    if (tool === "pin" || tool === "text") {
      if (!note.trim()) {
        setError(`Enter ${tool === "pin" ? "an issue note" : "text"} before placing it.`);
        return;
      }
      void persist(tool, point, note);
      return;
    }

    draftRef.current = { pointerId: event.pointerId, start: point, points: [point] };
    setDraft([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const activeDraft = draftRef.current;
    if (!activeDraft || activeDraft.pointerId !== event.pointerId) return;
    const point = pointFromEvent(event);
    const points = tool === "arrow" || tool === "calibration" || tool === "distance" || tool === "area"
      ? [activeDraft.start, point]
      : [...activeDraft.points, point];
    activeDraft.points = points;
    setDraft(points);
  };

  const handlePointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    const activeDraft = draftRef.current;
    if (!activeDraft || activeDraft.pointerId !== event.pointerId || !["freehand", "arrow", "calibration", "distance", "area"].includes(tool)) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    const points = activeDraft.points;
    if (points.length > 1) {
      const line = { x1: points[0].x, y1: points[0].y, x2: points.at(-1)!.x, y2: points.at(-1)!.y };
      if (tool === "calibration") {
        const realLength = Number(knownLength);
        const drawingLength = normalizedDistance(line);
        if (!Number.isFinite(realLength) || realLength <= 0 || drawingLength <= 0) {
          setError("Enter a valid known length before calibrating.");
          setDraft([]);
          draftRef.current = null;
          return;
        }
        void persist(tool, { ...line, realLength, unit: measurementUnit, unitsPerDrawingUnit: realLength / drawingLength });
      } else if (tool === "distance") {
        const calibration = currentCalibration(markups, pageNumber);
        if (!calibration) {
          setError("Calibrate this page before measuring distance.");
          setDraft([]);
          draftRef.current = null;
          return;
        }
        void persist(tool, { ...line, value: normalizedDistance(line) * calibration.unitsPerDrawingUnit, unit: calibration.unit });
      } else if (tool === "area") {
        const calibration = currentCalibration(markups, pageNumber);
        if (!calibration) {
          setError("Calibrate this page before measuring area.");
          setDraft([]);
          draftRef.current = null;
          return;
        }
        const normalizedArea = Math.abs((line.x2 - line.x1) * (line.y2 - line.y1));
        void persist(tool, { ...line, value: normalizedArea * calibration.unitsPerDrawingUnit ** 2, unit: `${calibration.unit}²` });
      } else {
        const drawingTool: BlueprintMarkupType = tool === "arrow" ? "arrow" : "freehand";
        void persist(drawingTool, drawingTool === "arrow" ? line : { points: points.map((point) => [point.x, point.y]) });
      }
    } else {
      setDraft([]);
      draftRef.current = null;
    }
  };

  const removeMarkup = async (markup: BlueprintMarkup) => {
    if (!supabase || markup.createdBy !== userId || !window.confirm("Delete this markup from the plan revision?")) return;
    setSaving(true);
    try {
      await deleteBlueprintMarkup(supabase, { ...identity, markupId: markup.id });
      await reload();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Could not delete this markup.");
    } finally {
      setSaving(false);
    }
  };

  const visibleMarkups = markups.filter((markup) => Number(markup.geometry.page ?? 1) === pageNumber);
  const calibration = currentCalibration(markups, pageNumber);
  const lastOwnedMarkup = [...visibleMarkups].reverse().find((markup) => markup.createdBy === userId);

  return (
    <div className="flex h-full w-full flex-col">
      <div
        className="flex flex-wrap items-center gap-1.5 border-b border-white/10 bg-slate-950 px-2.5 py-2 text-white"
        data-orion-region="blueprint-markup-toolbar"
        data-blueprint-controls
        onPointerDown={(event) => event.stopPropagation()}
      >
        <MarkupButton label="Pan" active={tool === "pan"} onClick={() => chooseTool("pan")}><Hand size={14} /></MarkupButton>
        <MarkupButton label="Draw" active={tool === "freehand"} onClick={() => chooseTool("freehand")}><Pencil size={14} /></MarkupButton>
        <MarkupButton label="Arrow" active={tool === "arrow"} onClick={() => chooseTool("arrow")}><ArrowUpRight size={14} /></MarkupButton>
        <MarkupButton label="Text" active={tool === "text"} onClick={() => chooseTool("text")}><Type size={14} /></MarkupButton>
        <MarkupButton label="Issue pin" active={tool === "pin"} onClick={() => chooseTool("pin")}><MapPin size={14} /></MarkupButton>
        <MarkupButton label="Calibrate" active={tool === "calibration"} onClick={() => chooseTool("calibration")}><ScanLine size={14} /></MarkupButton>
        <MarkupButton label="Distance" active={tool === "distance"} onClick={() => chooseTool("distance")}><Ruler size={14} /></MarkupButton>
        <MarkupButton label="Area" active={tool === "area"} onClick={() => chooseTool("area")}><SquareDashed size={14} /></MarkupButton>
        <div className="mx-1 h-5 w-px bg-white/15" />
        {colors.map((option) => (
          <button key={option} type="button" aria-label={`Use ${option} markup color`} onClick={() => setColor(option)} className={`h-5 w-5 rounded-full border-2 ${color === option ? "border-white" : "border-transparent"}`} style={{ backgroundColor: option }} />
        ))}
        {tool === "pin" || tool === "text" ? (
          <input value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder={tool === "pin" ? "Issue note…" : "Plan note…"} className="ml-1 min-w-36 flex-1 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white placeholder:text-slate-400 focus:border-blue-400 focus:outline-none" />
        ) : null}
        {tool === "calibration" ? (
          <div className="flex items-center gap-1">
            <input aria-label="Known calibration length" type="number" min="0.01" step="0.01" value={knownLength} onChange={(event) => setKnownLength(event.target.value)} className="w-20 rounded-md border border-white/15 bg-white/10 px-2 py-1 text-xs text-white focus:border-blue-400 focus:outline-none" />
            <select aria-label="Measurement unit" value={measurementUnit} onChange={(event) => setMeasurementUnit(event.target.value as "ft" | "m")} className="rounded-md border border-white/15 bg-slate-900 px-1 py-1 text-xs text-white"><option value="ft">ft</option><option value="m">m</option></select>
          </div>
        ) : null}
        <button
          type="button"
          disabled={!lastOwnedMarkup || saving}
          onClick={() => lastOwnedMarkup && void removeMarkup(lastOwnedMarkup)}
          className="inline-flex h-7 items-center gap-1 rounded-md border border-white/15 bg-white/10 px-2 text-[11px] font-semibold text-slate-200 hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-35"
          title="Delete your most recent markup"
        >
          <Trash2 size={13} aria-hidden="true" />
          <span className="hidden sm:inline">Undo last</span>
        </button>
        <span className="ml-auto text-[10px] text-slate-400">{saving ? "Saving…" : loading ? "Loading…" : calibration ? `Calibrated · ${visibleMarkups.length} items` : `${visibleMarkups.length} markup${visibleMarkups.length === 1 ? "" : "s"}`}</span>
        {toolbarExtra}
      </div>

      {error ? <div className="border-b border-red-400/30 bg-red-950 px-3 py-2 text-xs text-red-100" role="alert">{error}</div> : null}

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <div className="relative inline-flex max-h-full max-w-full" style={{ transform, transition }}>
          {children}
          <svg
          ref={surfaceRef}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          aria-label="Blueprint markup layer"
          className={`absolute inset-0 h-full w-full ${tool === "pan" ? "pointer-events-none" : "cursor-crosshair touch-none"}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            <marker id="blueprint-arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L8,4 L0,8 Z" fill="context-stroke" />
            </marker>
          </defs>
          {visibleMarkups.map((markup) => <MarkupShape key={markup.id} markup={markup} />)}
          {draft.length > 1 ? <DraftShape tool={tool} points={draft} color={color} /> : null}
          </svg>
        </div>
      </div>
    </div>
  );
}

function MarkupShape({ markup }: { markup: BlueprintMarkup }) {
  const geometry = markup.geometry as Record<string, unknown>;
  if (markup.type === "freehand") {
    const points = (geometry.points as number[][] | undefined) ?? [];
    return <polyline points={points.map(([x, y]) => `${x * 1000},${y * 1000}`).join(" ")} fill="none" stroke={markup.color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
  }
  if (markup.type === "arrow") {
    return <line x1={Number(geometry.x1) * 1000} y1={Number(geometry.y1) * 1000} x2={Number(geometry.x2) * 1000} y2={Number(geometry.y2) * 1000} stroke={markup.color} strokeWidth="7" markerEnd="url(#blueprint-arrowhead)" vectorEffect="non-scaling-stroke" />;
  }
  if (markup.type === "calibration" || markup.type === "distance") {
    const x1 = Number(geometry.x1) * 1000; const y1 = Number(geometry.y1) * 1000;
    const x2 = Number(geometry.x2) * 1000; const y2 = Number(geometry.y2) * 1000;
    const label = markup.type === "calibration" ? `Scale: ${formatMeasurement(Number(geometry.realLength))} ${String(geometry.unit)}` : `${formatMeasurement(Number(geometry.value))} ${String(geometry.unit)}`;
    return <g><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={markup.type === "calibration" ? "#22d3ee" : markup.color} strokeWidth="6" strokeDasharray={markup.type === "calibration" ? "14 10" : undefined} vectorEffect="non-scaling-stroke" /><text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 14} textAnchor="middle" fontSize="30" fontWeight="700" fill={markup.type === "calibration" ? "#0891b2" : markup.color} stroke="white" strokeWidth="5" paintOrder="stroke">{label}</text></g>;
  }
  if (markup.type === "area") {
    const x = Math.min(Number(geometry.x1), Number(geometry.x2)) * 1000; const y = Math.min(Number(geometry.y1), Number(geometry.y2)) * 1000;
    const width = Math.abs(Number(geometry.x2) - Number(geometry.x1)) * 1000; const height = Math.abs(Number(geometry.y2) - Number(geometry.y1)) * 1000;
    return <g><rect x={x} y={y} width={width} height={height} fill={`${markup.color}25`} stroke={markup.color} strokeWidth="6" strokeDasharray="12 8" vectorEffect="non-scaling-stroke" /><text x={x + width / 2} y={y + height / 2} textAnchor="middle" fontSize="30" fontWeight="700" fill={markup.color} stroke="white" strokeWidth="5" paintOrder="stroke">{formatMeasurement(Number(geometry.value))} {String(geometry.unit)}</text></g>;
  }
  const x = Number(geometry.x) * 1000;
  const y = Number(geometry.y) * 1000;
  return (
    <g role="img" aria-label={markup.content || markup.type}>
      {markup.type === "pin" ? <><circle cx={x} cy={y} r="24" fill={markup.color} /><text x={x} y={y + 8} textAnchor="middle" fontSize="24" fontWeight="700" fill="white">!</text></> : <text x={x} y={y} fontSize="34" fontWeight="700" fill={markup.color} stroke="white" strokeWidth="4" paintOrder="stroke">{markup.content}</text>}
      {markup.type === "pin" && markup.content ? <text x={x + 34} y={y + 9} fontSize="28" fontWeight="700" fill={markup.color} stroke="white" strokeWidth="4" paintOrder="stroke">{markup.content}</text> : null}
    </g>
  );
}

function DraftShape({ tool, points, color }: { tool: MarkupTool; points: Point[]; color: string }) {
  if (tool === "area") { const end = points.at(-1)!; return <rect x={Math.min(points[0].x, end.x) * 1000} y={Math.min(points[0].y, end.y) * 1000} width={Math.abs(end.x - points[0].x) * 1000} height={Math.abs(end.y - points[0].y) * 1000} fill={`${color}25`} stroke={color} strokeWidth="6" strokeDasharray="12 8" vectorEffect="non-scaling-stroke" />; }
  if (["arrow", "calibration", "distance"].includes(tool)) return <line x1={points[0].x * 1000} y1={points[0].y * 1000} x2={points.at(-1)!.x * 1000} y2={points.at(-1)!.y * 1000} stroke={tool === "calibration" ? "#22d3ee" : color} strokeWidth="7" markerEnd={tool === "arrow" ? "url(#blueprint-arrowhead)" : undefined} strokeDasharray={tool === "calibration" ? "14 10" : undefined} vectorEffect="non-scaling-stroke" />;
  return <polyline points={points.map((point) => `${point.x * 1000},${point.y * 1000}`).join(" ")} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />;
}

function normalizedDistance(line: { x1: number; y1: number; x2: number; y2: number }) { return Math.hypot(line.x2 - line.x1, line.y2 - line.y1); }
function currentCalibration(markups: BlueprintMarkup[], page: number) {
  const markup = [...markups].reverse().find((item) => item.type === "calibration" && Number(item.geometry.page ?? 1) === page);
  if (!markup) return null;
  return { unitsPerDrawingUnit: Number(markup.geometry.unitsPerDrawingUnit), unit: String(markup.geometry.unit) };
}
function formatMeasurement(value: number) { return Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "0"; }

function MarkupButton({ label, active, onClick, children }: { label: string; active: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" aria-label={label} title={label} aria-pressed={active} onClick={onClick} className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold ${active ? "border-blue-300 bg-blue-600 text-white" : "border-white/15 bg-white/10 text-slate-200 hover:bg-white/20"}`}>{children}<span className="hidden sm:inline">{label}</span></button>;
}
