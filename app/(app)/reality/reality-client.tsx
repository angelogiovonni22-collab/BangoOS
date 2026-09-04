"use client";

import { useEffect, useMemo, useState } from "react";
import { RealityScanViewer } from "@/components/reality/reality-scan-viewer";
import { useI18n } from "@/lib/i18n/provider";

type Target = { id: string; name?: string; title?: string; project_number?: string | null; estimate_number?: string | null };
type RealityScan = {
  id: string;
  project_id: string | null;
  estimate_id: string | null;
  label: string;
  capture_provider: string;
  capture_kind: string;
  status: string;
  device_model: string | null;
  operating_system: string | null;
  framework_version: string | null;
  room_count: number | null;
  floor_area_sqft: number | null;
  wall_area_sqft: number | null;
  opening_count: number | null;
  object_count: number | null;
  captured_at: string | null;
  created_at: string;
  modelUrl: string | null;
};

type ApiPayload = { ok: boolean; error?: string; projects?: Target[]; estimates?: Target[]; scans?: RealityScan[] };

export function RealityClient() {
  const { locale } = useI18n();
  const es = locale === "es";
  const [projects, setProjects] = useState<Target[]>([]);
  const [estimates, setEstimates] = useState<Target[]>([]);
  const [scans, setScans] = useState<RealityScan[]>([]);
  const [targetType, setTargetType] = useState<"project" | "estimate">("project");
  const [targetId, setTargetId] = useState("");
  const [label, setLabel] = useState("");
  const [captureProvider, setCaptureProvider] = useState("apple_roomplan");
  const [captureKind, setCaptureKind] = useState("room");
  const [sourceJson, setSourceJson] = useState<File | null>(null);
  const [model, setModel] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const response = await fetch("/api/reality/scans", { cache: "no-store" });
    const payload = (await response.json()) as ApiPayload;
    if (!payload.ok) throw new Error(payload.error || "Could not load Reality Engine scans.");
    setProjects(payload.projects || []);
    setEstimates(payload.estimates || []);
    setScans(payload.scans || []);
  }

  useEffect(() => {
    let active = true;
    void refresh()
      .catch((reason: unknown) => {
        if (active) setMessage(reason instanceof Error ? reason.message : "Could not load Reality Engine.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const targets = targetType === "project" ? projects : estimates;
  const filteredScans = useMemo(() => {
    if (!targetId) return scans;
    return scans.filter((scan) => targetType === "project" ? scan.project_id === targetId : scan.estimate_id === targetId);
  }, [scans, targetId, targetType]);

  async function save() {
    if (!targetId || !label.trim() || (!sourceJson && !model)) {
      setMessage(es ? "Seleccione un proyecto o estimado, agregue un nombre y adjunte un archivo JSON de RoomPlan, un modelo USDZ o ambos." : "Choose a project or estimate, add a label, and attach a RoomPlan JSON file, USDZ model, or both.");
      return;
    }
    setSaving(true);
    setMessage("");
    const form = new FormData();
    form.set("targetType", targetType);
    form.set("targetId", targetId);
    form.set("label", label.trim());
    form.set("captureProvider", captureProvider);
    form.set("captureKind", captureKind);
    if (sourceJson) form.set("sourceJson", sourceJson);
    if (model) form.set("model", model);
    const response = await fetch("/api/reality/scans", { method: "POST", body: form });
    const payload = await response.json() as { ok: boolean; error?: string };
    setSaving(false);
    if (!payload.ok) {
      setMessage(payload.error || (es ? "No se pudo guardar el escaneo." : "Could not save the scan."));
      return;
    }
    setLabel("");
    setSourceJson(null);
    setModel(null);
    setMessage(es ? "Escaneo guardado en B.O.S. Reality Engine." : "Scan saved to B.O.S. Reality Engine.");
    await refresh();
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6" data-orion-region="reality-engine-workspace">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-500">B.O.S. Reality Engine</p>
        <h1 className="mt-1 text-3xl font-bold text-[var(--bos-text-primary)]">{es ? "Captura espacial y LiDAR" : "Spatial Capture & LiDAR"}</h1>
        <p className="mt-2 max-w-4xl text-sm text-[var(--bos-text-secondary)]">
          {es ? "Convierta escaneos Apple RoomPlan/ARKit y archivos LiDAR en un registro 3D privado vinculado al proyecto. B.O.S. conserva el JSON de captura y el modelo USDZ para mediciones, estimación y revisión del sitio." : "Turn Apple RoomPlan/ARKit and LiDAR captures into a private 3D project record. B.O.S. preserves the source capture JSON and USDZ model for measurement, estimating, and site review."}
        </p>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        {[
          ["RoomPlan", es ? "Habitaciones y estructuras" : "Rooms & structures"],
          ["LiDAR / ARKit", es ? "Captura de profundidad" : "Depth capture"],
          ["USDZ", es ? "Modelo 3D privado" : "Private 3D model"],
          ["B.O.S. Measure", es ? "Mediciones verificables" : "Verifiable dimensions"],
        ].map(([title, subtitle]) => <div key={title} className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-4 shadow-[var(--shadow-small)]"><p className="text-sm font-bold text-[var(--bos-text-primary)]">{title}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{subtitle}</p></div>)}
      </section>

      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-4 shadow-[var(--shadow-card)] md:p-5">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--bos-text-primary)]">{es ? "Importar escaneo de Reality Engine" : "Import Reality Engine scan"}</h2>
          <p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{es ? "Importe una exportación real de RoomPlan desde iPhone/iPad. La captura nativa directa se conecta a este mismo registro." : "Import a real RoomPlan export from iPhone/iPad. Native direct capture connects to this same scan record."}</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-4">
          <label className="text-sm font-medium">{es ? "Guardar en" : "Save to"}<select value={targetType} onChange={(event) => { setTargetType(event.target.value as "project" | "estimate"); setTargetId(""); }} className="mt-1 w-full rounded-lg border bg-[var(--bos-bg-control)] p-2"><option value="project">{es ? "Proyecto" : "Project"}</option><option value="estimate">{es ? "Estimado" : "Estimate"}</option></select></label>
          <label className="text-sm font-medium lg:col-span-2">{es ? "Destino" : "Destination"}<select value={targetId} onChange={(event) => setTargetId(event.target.value)} className="mt-1 w-full rounded-lg border bg-[var(--bos-bg-control)] p-2"><option value="">{es ? "Seleccione" : "Select"}</option>{targets.map((target) => <option key={target.id} value={target.id}>{target.project_number || target.estimate_number ? `${target.project_number || target.estimate_number} · ` : ""}{target.name || target.title}</option>)}</select></label>
          <label className="text-sm font-medium">{es ? "Nombre del escaneo" : "Scan label"}<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder={es ? "Sala principal" : "Main living room"} className="mt-1 w-full rounded-lg border bg-[var(--bos-bg-control)] p-2" /></label>
          <label className="text-sm font-medium">{es ? "Fuente" : "Capture source"}<select value={captureProvider} onChange={(event) => setCaptureProvider(event.target.value)} className="mt-1 w-full rounded-lg border bg-[var(--bos-bg-control)] p-2"><option value="apple_roomplan">Apple RoomPlan</option><option value="arkit_lidar">ARKit / LiDAR</option><option value="manual_import">{es ? "Importación manual" : "Manual import"}</option></select></label>
          <label className="text-sm font-medium">{es ? "Tipo" : "Capture type"}<select value={captureKind} onChange={(event) => setCaptureKind(event.target.value)} className="mt-1 w-full rounded-lg border bg-[var(--bos-bg-control)] p-2"><option value="room">{es ? "Habitación" : "Room"}</option><option value="structure">{es ? "Estructura de varias habitaciones" : "Multi-room structure"}</option></select></label>
          <label className="text-sm font-medium">RoomPlan JSON<input type="file" accept=".json,application/json" onChange={(event) => setSourceJson(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" /></label>
          <label className="text-sm font-medium">USDZ<input type="file" accept=".usdz,model/vnd.usdz+zip,application/octet-stream" onChange={(event) => setModel(event.target.files?.[0] || null)} className="mt-1 block w-full text-xs" /></label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? (es ? "Guardando…" : "Saving…") : (es ? "Guardar escaneo" : "Save scan")}</button><a href="/measure" className="rounded-lg border border-[var(--bos-border-default)] px-4 py-2.5 text-sm font-semibold">{es ? "Abrir B.O.S. Measure" : "Open B.O.S. Measure"}</a></div>
        {message ? <p role="status" className="mt-3 text-sm text-[var(--bos-text-secondary)]">{message}</p> : null}
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-xl font-semibold">{es ? "Escaneos guardados" : "Saved scans"}</h2><p className="text-sm text-[var(--bos-text-secondary)]">{filteredScans.length} {es ? "escaneo(s)" : "scan(s)"}</p></div>{loading ? <span className="text-sm text-[var(--bos-text-muted)]">{es ? "Cargando…" : "Loading…"}</span> : null}</div>
        {!loading && filteredScans.length === 0 ? <div className="rounded-2xl border border-dashed border-[var(--bos-border-default)] p-8 text-center text-sm text-[var(--bos-text-secondary)]">{es ? "Todavía no hay escaneos de Reality Engine para este destino." : "No Reality Engine scans are saved for this destination yet."}</div> : null}
        <div className="grid gap-5 xl:grid-cols-2">{filteredScans.map((scan) => <article key={scan.id} className="space-y-4 rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-4 shadow-[var(--shadow-card)]"><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">{scan.label}</h3><p className="text-xs text-[var(--bos-text-secondary)]">{scan.capture_provider.replaceAll("_", " ")} · {scan.capture_kind} · {scan.status}</p></div><time className="text-xs text-[var(--bos-text-muted)]">{new Date(scan.captured_at || scan.created_at).toLocaleDateString(locale)}</time></div>{scan.modelUrl ? <RealityScanViewer fileUrl={scan.modelUrl} label={scan.label} /> : <div className="grid h-32 place-items-center rounded-xl border border-dashed border-[var(--bos-border-default)] text-sm text-[var(--bos-text-muted)]">{es ? "JSON guardado; no se adjuntó modelo USDZ." : "Source JSON saved; no USDZ model attached."}</div>}<dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-5"><Metric label={es ? "Habitaciones" : "Rooms"} value={scan.room_count} /><Metric label={es ? "Área de piso" : "Floor area"} value={scan.floor_area_sqft == null ? null : `${Number(scan.floor_area_sqft).toFixed(1)} ft²`} /><Metric label={es ? "Área de pared" : "Wall area"} value={scan.wall_area_sqft == null ? null : `${Number(scan.wall_area_sqft).toFixed(1)} ft²`} /><Metric label={es ? "Aberturas" : "Openings"} value={scan.opening_count} /><Metric label={es ? "Objetos" : "Objects"} value={scan.object_count} /></dl></article>)}</div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number | null }) {
  return <div className="rounded-lg bg-[var(--bos-bg-control)] p-2"><dt className="text-[10px] uppercase tracking-wide text-[var(--bos-text-muted)]">{label}</dt><dd className="mt-1 font-semibold text-[var(--bos-text-primary)]">{value ?? "—"}</dd></div>;
}
