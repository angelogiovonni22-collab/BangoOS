"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertTriangle, Check, LoaderCircle, RefreshCw, Save, Trash2 } from "lucide-react";
import type { BosBuildingGraph, BosOpening, BosPoint2, BosRoom, BosWall } from "@/lib/blueprints/engine/building-graph";

type CorrectionResponse = {
  graph: BosBuildingGraph | null;
  engineStatus?: string | null;
  corrections?: Array<{ id: string; correction_type: string; object_id?: string | null; created_at?: string }>;
  error?: string;
};

type Props = { versionId: string };

function formNumber(data: FormData, name: string) {
  const value = Number(data.get(name));
  return Number.isFinite(value) ? value : null;
}

function parsePoints(value: FormDataEntryValue | null): BosPoint2[] | null {
  if (typeof value !== "string") return null;
  const points = value.split(";").map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [xText, yText] = entry.split(",").map((part) => part.trim());
    const x = Number(xText);
    const y = Number(yText);
    return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
  });
  return points.length >= 3 && points.every(Boolean) ? points as BosPoint2[] : null;
}

function NumericField({ name, label, value }: { name: string; label: string; value?: number | null }) {
  return (
    <label className="space-y-1 text-[11px] font-semibold text-slate-300">
      <span>{label}</span>
      <input name={name} defaultValue={value ?? ""} inputMode="decimal" className="h-8 w-full rounded-md border border-white/15 bg-slate-900 px-2 text-xs text-white outline-none focus:border-cyan-400" />
    </label>
  );
}

function actionClass(primary = false) {
  return primary
    ? "inline-flex items-center gap-1.5 rounded-md bg-cyan-500 px-2.5 py-1.5 text-[11px] font-bold text-slate-950 disabled:opacity-50"
    : "inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white disabled:opacity-50";
}

export function BlueprintGraphReviewPanel({ versionId }: Props) {
  const [payload, setPayload] = useState<CorrectionResponse>({ graph: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const endpoint = `/api/blueprints/${encodeURIComponent(versionId)}/generated-3d/corrections`;
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const next = await response.json() as CorrectionResponse;
      setPayload(response.ok ? next : { graph: null, error: next.error || "Unable to load the Building Graph." });
    } catch (error) {
      setPayload({ graph: null, error: error instanceof Error ? error.message : "Unable to load the Building Graph." });
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const postCorrection = async (correction: Record<string, unknown>) => {
    setSaving(true);
    setNotice(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correction: { id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...correction } }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Unable to save Blueprint correction.");
      setNotice("Correction saved. Regenerate 3D to replay it against the source plan.");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save Blueprint correction.");
    } finally {
      setSaving(false);
    }
  };

  const graph = payload.graph;
  const selectedWall = graph?.walls.find((wall) => wall.id === selectedWallId) || null;
  const selectedOpening = graph?.openings.find((opening) => opening.id === selectedOpeningId)
    || graph?.doors.find((opening) => opening.id === selectedOpeningId)
    || graph?.windows.find((opening) => opening.id === selectedOpeningId)
    || null;
  const selectedRoom = graph?.rooms.find((room) => room.id === selectedRoomId) || null;
  const selectedObject = selectedWall || selectedOpening || selectedRoom;

  const map = useMemo(() => {
    if (!graph?.walls.length) return null;
    const xs = graph.walls.flatMap((wall) => [wall.centerline.start.x, wall.centerline.end.x]);
    const ys = graph.walls.flatMap((wall) => [wall.centerline.start.y, wall.centerline.end.y]);
    const minX = Math.min(...xs); const maxX = Math.max(...xs);
    const minY = Math.min(...ys); const maxY = Math.max(...ys);
    const width = Math.max(0.1, maxX - minX); const height = Math.max(0.1, maxY - minY);
    return {
      x: (value: number) => 12 + (value - minX) / width * 296,
      y: (value: number) => 188 - (value - minY) / height * 176,
    };
  }, [graph]);

  const submitWallMove = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedWall) return;
    const data = new FormData(event.currentTarget);
    const startX = formNumber(data, "startX"); const startY = formNumber(data, "startY");
    const endX = formNumber(data, "endX"); const endY = formNumber(data, "endY");
    if (startX === null || startY === null || endX === null || endY === null) { setNotice("Wall coordinates must be valid numbers."); return; }
    void postCorrection({ type: "move_wall", wallId: selectedWall.id, start: { x: startX, y: startY }, end: { x: endX, y: endY } });
  };

  const submitAddWall = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!graph?.levels[0]) return;
    const data = new FormData(event.currentTarget);
    const startX = formNumber(data, "startX"); const startY = formNumber(data, "startY");
    const endX = formNumber(data, "endX"); const endY = formNumber(data, "endY");
    if (startX === null || startY === null || endX === null || endY === null) { setNotice("New wall coordinates must be valid numbers."); return; }
    const id = `wall-manual-${crypto.randomUUID()}`;
    const wall: BosWall = {
      id, levelId: graph.levels[0].id, type: "unknown",
      centerline: { start: { x: startX, y: startY }, end: { x: endX, y: endY } },
      thickness: 0.1524, height: 2.4384, confidence: 1, sourcePage: graph.metadata.sourcePage,
      evidence: [], provenance: { createdBy: "manual", algorithm: "manual:add_wall", algorithmVersion: "1.0.0", evidenceIds: [] },
    };
    void postCorrection({ type: "add_wall", wall });
  };

  const submitOpening = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOpening) return;
    const data = new FormData(event.currentTarget);
    const width = formNumber(data, "width"); const height = formNumber(data, "height");
    const offset = formNumber(data, "offset"); const sillHeight = formNumber(data, "sillHeight");
    if (width === null || height === null || offset === null || sillHeight === null) { setNotice("Opening values must be valid numbers."); return; }
    void postCorrection({ type: "update_opening", openingId: selectedOpening.id, patch: { width, height, offset, sillHeight } });
  };

  const submitRoom = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedRoom) return;
    const data = new FormData(event.currentTarget);
    const polygon = parsePoints(data.get("polygon"));
    if (!polygon) { setNotice("Room polygon needs at least three valid x,y points."); return; }
    const name = String(data.get("name") || "").trim();
    void postCorrection({ type: "update_room", roomId: selectedRoom.id, patch: { name: name || undefined, polygon: { points: polygon } } });
  };

  if (loading) return <p className="inline-flex items-center gap-2 text-xs text-slate-300"><LoaderCircle size={14} className="animate-spin" /> Loading Building Graph…</p>;
  if (!graph) return <div className="space-y-2 text-xs text-slate-300"><p className="inline-flex items-start gap-2"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-300" />{payload.error || "Generate the native 3D model before opening reconstruction review."}</p><button type="button" onClick={() => void load()} className={actionClass()}><RefreshCw size={13} /> Retry</button></div>;

  return (
    <div className="space-y-4" data-orion-region="blueprint-graph-review">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300"><span>Engine <strong className="text-white">{payload.engineStatus || graph.validation.status}</strong></span><span>Validation <strong className="text-white">{Math.round(graph.validation.score * 100)}%</strong></span><span>{payload.corrections?.length || 0} saved correction{payload.corrections?.length === 1 ? "" : "s"}</span></div>

      {map ? <div className="overflow-hidden rounded-lg border border-white/10 bg-slate-900 p-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">2D Building Graph · select a wall</p><svg viewBox="0 0 320 200" className="h-48 w-full" role="img" aria-label="Selectable reconstructed wall map">{graph.walls.map((wall) => { const active = wall.id === selectedWallId; return <g key={wall.id} role="button" tabIndex={0} aria-label={`Select ${wall.id}`} onClick={() => setSelectedWallId(wall.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedWallId(wall.id); }} className="cursor-pointer outline-none"><line x1={map.x(wall.centerline.start.x)} y1={map.y(wall.centerline.start.y)} x2={map.x(wall.centerline.end.x)} y2={map.y(wall.centerline.end.y)} stroke="transparent" strokeWidth="12" /><line x1={map.x(wall.centerline.start.x)} y1={map.y(wall.centerline.start.y)} x2={map.x(wall.centerline.end.x)} y2={map.y(wall.centerline.end.y)} stroke={active ? "currentColor" : "rgba(255,255,255,0.72)"} strokeWidth={active ? "4" : "2"} className={active ? "text-cyan-300" : ""} /></g>; })}</svg></div> : null}

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-bold text-white">Wall correction</p><span className="text-[10px] text-slate-400">{selectedWall?.id || "Select a wall"}</span></div>{selectedWall ? <><form key={`${selectedWall.id}:${selectedWall.centerline.start.x}:${selectedWall.centerline.end.x}`} onSubmit={submitWallMove} className="space-y-2"><div className="grid grid-cols-2 gap-2"><NumericField name="startX" label="Start X (m)" value={selectedWall.centerline.start.x} /><NumericField name="startY" label="Start Y (m)" value={selectedWall.centerline.start.y} /><NumericField name="endX" label="End X (m)" value={selectedWall.centerline.end.x} /><NumericField name="endY" label="End Y (m)" value={selectedWall.centerline.end.y} /></div><button type="submit" disabled={saving} className={actionClass(true)}><Save size={13} /> Save position</button></form><div className="flex flex-wrap gap-1.5">{(["exterior", "interior", "unknown"] as const).map((type) => <button key={type} type="button" disabled={saving} onClick={() => void postCorrection({ type: "classify_wall", wallId: selectedWall.id, wallType: type })} className={`rounded-md border px-2 py-1 text-[10px] font-bold capitalize ${selectedWall.type === type ? "border-cyan-300 bg-cyan-400/15 text-cyan-200" : "border-white/15 text-slate-300"}`}>{type}</button>)}</div><button type="button" disabled={saving} onClick={() => { if (window.confirm(`Remove ${selectedWall.id} from the reconstructed graph?`)) void postCorrection({ type: "remove_wall", wallId: selectedWall.id }); }} className="inline-flex items-center gap-1.5 rounded-md border border-rose-400/30 px-2.5 py-1.5 text-[11px] font-bold text-rose-300"><Trash2 size={13} /> Remove wall</button></> : <p className="text-[11px] text-slate-400">Select a reconstructed wall on the map to move, classify, inspect, or remove it.</p>}</section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-bold text-white">Add wall</p><form onSubmit={submitAddWall} className="space-y-2"><div className="grid grid-cols-2 gap-2"><NumericField name="startX" label="Start X (m)" /><NumericField name="startY" label="Start Y (m)" /><NumericField name="endX" label="End X (m)" /><NumericField name="endY" label="End Y (m)" /></div><button type="submit" disabled={saving} className={actionClass()}><Save size={13} /> Add wall correction</button></form></section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-bold text-white">Opening correction</p><select value={selectedOpeningId || ""} onChange={(event) => setSelectedOpeningId(event.target.value || null)} className="h-8 w-full rounded-md border border-white/15 bg-slate-900 px-2 text-xs text-white"><option value="">Select door/window/opening</option>{graph.openings.map((opening) => <option key={opening.id} value={opening.id}>{opening.id} · {opening.type}</option>)}</select>{selectedOpening ? <form key={`${selectedOpening.id}:${selectedOpening.width}:${selectedOpening.offset}`} onSubmit={submitOpening} className="space-y-2"><div className="grid grid-cols-2 gap-2"><NumericField name="width" label="Width (m)" value={selectedOpening.width} /><NumericField name="height" label="Height (m)" value={selectedOpening.height} /><NumericField name="offset" label="Offset (m)" value={selectedOpening.offset} /><NumericField name="sillHeight" label="Sill (m)" value={selectedOpening.sillHeight ?? 0} /></div><button type="submit" disabled={saving} className={actionClass(true)}><Save size={13} /> Save opening</button></form> : null}</section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-bold text-white">Room correction</p><select value={selectedRoomId || ""} onChange={(event) => setSelectedRoomId(event.target.value || null)} className="h-8 w-full rounded-md border border-white/15 bg-slate-900 px-2 text-xs text-white"><option value="">Select room</option>{graph.rooms.map((room) => <option key={room.id} value={room.id}>{room.name || room.id}</option>)}</select>{selectedRoom ? <form key={`${selectedRoom.id}:${selectedRoom.name || ""}:${selectedRoom.polygon.points.length}`} onSubmit={submitRoom} className="space-y-2"><label className="space-y-1 text-[11px] font-semibold text-slate-300"><span>Room name</span><input name="name" defaultValue={selectedRoom.name || ""} className="h-8 w-full rounded-md border border-white/15 bg-slate-900 px-2 text-xs text-white" /></label><label className="space-y-1 text-[11px] font-semibold text-slate-300"><span>Polygon points (x,y; x,y; …)</span><textarea name="polygon" defaultValue={selectedRoom.polygon.points.map((point) => `${point.x},${point.y}`).join("; ")} rows={3} className="w-full rounded-md border border-white/15 bg-slate-900 p-2 text-xs text-white" /></label><button type="submit" disabled={saving} className={actionClass(true)}><Save size={13} /> Save room</button></form> : null}</section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-bold text-white">Manual scale</p><form key={String(graph.scale.drawingUnitsPerMeter)} onSubmit={(event) => { event.preventDefault(); const drawingUnitsPerMeter = formNumber(new FormData(event.currentTarget), "scale"); if (!drawingUnitsPerMeter || drawingUnitsPerMeter <= 0) { setNotice("Manual scale must be greater than zero."); return; } void postCorrection({ type: "set_scale", drawingUnitsPerMeter }); }} className="space-y-2"><NumericField name="scale" label="Drawing units per meter" value={graph.scale.drawingUnitsPerMeter} /><button type="submit" disabled={saving} className={actionClass()}><Save size={13} /> Confirm scale</button></form></section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-bold text-white">Confidence & provenance</p>{selectedObject ? <div className="space-y-1 text-[11px] text-slate-300"><p><strong className="text-white">Object:</strong> {selectedObject.id}</p><p><strong className="text-white">Confidence:</strong> {Math.round(selectedObject.confidence * 100)}%</p><p><strong className="text-white">Created by:</strong> {selectedObject.provenance.createdBy}</p><p><strong className="text-white">Algorithm:</strong> {selectedObject.provenance.algorithm} · {selectedObject.provenance.algorithmVersion}</p><p><strong className="text-white">Evidence:</strong> {selectedObject.evidence.length} item{selectedObject.evidence.length === 1 ? "" : "s"}</p>{selectedObject.correction?.corrected ? <p className="inline-flex items-center gap-1 text-emerald-300"><Check size={12} /> Manually corrected</p> : null}</div> : <p className="text-[11px] text-slate-400">Select a wall, opening, or room to inspect its confidence and provenance.</p>}</section>

      <section className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] p-3"><p className="text-xs font-bold text-white">Validation issues</p>{graph.validation.issues.length ? graph.validation.issues.map((issue) => <div key={issue.id} className="rounded-md border border-white/10 p-2 text-[11px] text-slate-300"><p className="font-bold text-white">{issue.code} · {issue.severity}</p><p>{issue.message}</p>{issue.objectIds?.length ? <div className="mt-1 flex flex-wrap gap-1">{issue.objectIds.map((id) => <button key={id} type="button" onClick={() => { if (graph.walls.some((wall) => wall.id === id)) setSelectedWallId(id); else if (graph.openings.some((opening) => opening.id === id)) setSelectedOpeningId(id); else if (graph.rooms.some((room) => room.id === id)) setSelectedRoomId(id); }} className="rounded border border-white/15 px-1.5 py-0.5 text-[10px] text-cyan-200">{id}</button>)}</div> : null}</div>) : <p className="inline-flex items-center gap-1 text-[11px] text-emerald-300"><Check size={12} /> No graph validation issues.</p>}</section>

      {notice ? <p role="status" className="rounded-md border border-cyan-300/20 bg-cyan-950/30 p-2 text-[11px] text-cyan-100">{notice}</p> : null}
      {saving ? <p className="inline-flex items-center gap-1.5 text-[11px] text-slate-300"><LoaderCircle size={12} className="animate-spin" /> Saving correction…</p> : null}
    </div>
  );
}
