"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Ruler } from "lucide-react";
import type { BosBuildingGraph } from "@/lib/blueprints/engine/building-graph";
import { formatBlueprintFeetInches } from "@/lib/blueprints/imperial-length";

type Props = { versionId: string };

type GraphResponse = {
  graph?: BosBuildingGraph | null;
  engineStatus?: string | null;
  error?: string;
};

type SourcePreview = {
  url: string;
  page: number;
  width: number;
  height: number;
};

type FidelityMetrics = BosBuildingGraph["validation"]["metrics"] & {
  sourceAlignment?: number;
  sourceSupportedWalls?: number;
  sourceTotalWalls?: number;
};

function percent(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value * 100)}%` : "—";
}

function wallLength(wall: BosBuildingGraph["walls"][number]) {
  return Math.hypot(
    wall.centerline.end.x - wall.centerline.start.x,
    wall.centerline.end.y - wall.centerline.start.y,
  );
}

export function BlueprintSourceFidelityOverlay({ versionId }: Props) {
  const [graph, setGraph] = useState<BosBuildingGraph | null>(null);
  const [engineStatus, setEngineStatus] = useState<string | null>(null);
  const [preview, setPreview] = useState<SourcePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const [graphResponse, previewResponse] = await Promise.all([
          fetch(`/api/blueprints/${encodeURIComponent(versionId)}/generated-3d/corrections`, { cache: "no-store" }),
          fetch(`/api/blueprints/${encodeURIComponent(versionId)}/source-page-preview`, { cache: "no-store" }),
        ]);
        const graphPayload = await graphResponse.json() as GraphResponse;
        if (!graphResponse.ok || !graphPayload.graph) throw new Error(graphPayload.error || "Generate the native Building Graph before opening source fidelity review.");
        if (!previewResponse.ok) {
          const previewPayload = await previewResponse.json().catch(() => null) as { error?: string } | null;
          throw new Error(previewPayload?.error || "Unable to render the selected source page.");
        }
        const blob = await previewResponse.blob();
        objectUrl = URL.createObjectURL(blob);
        const width = Number(previewResponse.headers.get("X-BOS-Source-Width"));
        const height = Number(previewResponse.headers.get("X-BOS-Source-Height"));
        const page = Number(previewResponse.headers.get("X-BOS-Source-Page"));
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error("B.O.S. could not resolve the source-page coordinate frame.");
        if (cancelled) return;
        setGraph(graphPayload.graph);
        setEngineStatus(graphPayload.engineStatus || graphPayload.graph.validation.status);
        setPreview({ url: objectUrl, width, height, page: Number.isFinite(page) ? page : graphPayload.graph.metadata.sourcePage });
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load Blueprint source fidelity review.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [versionId]);

  const overlay = useMemo(() => {
    if (!graph || !preview || !graph.scale.drawingUnitsPerMeter) return null;
    const units = graph.scale.drawingUnitsPerMeter;
    const rasterCoordinates = Boolean(graph.metadata.algorithms.rasterFallback);
    return {
      x: (meters: number) => meters * units,
      y: (meters: number) => rasterCoordinates ? meters * units : preview.height - meters * units,
    };
  }, [graph, preview]);

  const dimensionWalls = useMemo(() => {
    if (!graph) return [];
    return graph.walls
      .map((wall) => ({ wall, length: wallLength(wall) }))
      .filter(({ length }) => length >= 1.2192)
      .sort((left, right) => {
        const rank = { exterior: 0, interior: 1, unknown: 2 };
        return rank[left.wall.type] - rank[right.wall.type] || right.length - left.length;
      })
      .slice(0, 36);
  }, [graph]);

  if (loading) return <p className="inline-flex items-center gap-2 text-xs text-slate-300"><LoaderCircle size={14} className="animate-spin" /> Loading source fidelity overlay…</p>;
  if (error || !graph || !preview || !overlay || !graph.scale.drawingUnitsPerMeter) return <p className="inline-flex items-start gap-2 text-xs text-amber-200"><AlertTriangle size={14} className="mt-0.5 shrink-0" />{error || "Source overlay is unavailable until the plan scale and Building Graph are verified."}</p>;

  const unitsPerMeter = graph.scale.drawingUnitsPerMeter;
  const metrics = graph.validation.metrics as FidelityMetrics;
  const sourceAlignment = metrics.sourceAlignment;
  const passed = typeof sourceAlignment === "number" && sourceAlignment >= 0.72 && graph.validation.status === "reconstructed";
  const supported = typeof metrics.sourceSupportedWalls === "number" ? metrics.sourceSupportedWalls : null;
  const total = typeof metrics.sourceTotalWalls === "number" ? metrics.sourceTotalWalls : graph.walls.length;
  const scaleVerified = metrics.scaleConfidence >= 0.9 && graph.scale.confidence >= 0.9 && graph.scale.source !== "unknown";

  return (
    <div className="space-y-3" data-orion-region="blueprint-source-fidelity-overlay">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Source alignment</p><p className="mt-1 text-sm font-bold text-white">{percent(sourceAlignment)}</p></div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Wall topology</p><p className="mt-1 text-sm font-bold text-white">{percent(metrics.wallTopology)}</p></div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Scale confidence</p><p className="mt-1 text-sm font-bold text-white">{percent(metrics.scaleConfidence)}</p></div>
        <div className="rounded-lg border border-white/10 bg-slate-950/70 p-2"><p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">Supported walls</p><p className="mt-1 text-sm font-bold text-white">{supported === null ? "—" : `${supported}/${total}`}</p></div>
      </div>

      <div className={`flex items-start gap-2 rounded-lg border p-2 text-[11px] ${passed ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-100" : "border-amber-400/30 bg-amber-400/10 text-amber-100"}`}>
        {passed ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
        <span>{passed ? "Source geometry, topology, and validation have cleared the reconstruction gate." : `Engine ${engineStatus || graph.validation.status}. White/cyan reconstruction lines are shown directly over source page ${preview.page}; unresolved divergence remains review-gated.`}</span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300"><Ruler size={13} aria-hidden="true" /> Construction dimensions</p>
        <button
          type="button"
          aria-pressed={showDimensions}
          disabled={!scaleVerified}
          onClick={() => setShowDimensions((current) => !current)}
          className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          data-orion-action="blueprints.toggle-source-dimensions"
        >
          {showDimensions ? "Hide feet & inches" : "Show feet & inches"}
        </button>
      </div>
      {!scaleVerified ? <p className="text-[10px] font-semibold text-amber-200">Dimensions remain hidden until the registered Blueprint scale reaches the 90% verification gate.</p> : graph.validation.status !== "reconstructed" ? <p className="text-[10px] font-semibold text-amber-200">Feet/inches are scale-verified review measurements. Wall topology still requires review before construction use.</p> : null}

      <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white" style={{ aspectRatio: `${preview.width} / ${preview.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview.url} alt={`Blueprint source page ${preview.page}`} className="absolute inset-0 h-full w-full object-contain" />
        <svg viewBox={`0 0 ${preview.width} ${preview.height}`} preserveAspectRatio="xMidYMid meet" className="absolute inset-0 h-full w-full" role="img" aria-label="Reconstructed wall geometry overlaid on the selected Blueprint source page">
          {graph.walls.map((wall) => {
            const strong = wall.confidence >= 0.9;
            return <line key={wall.id} x1={overlay.x(wall.centerline.start.x)} y1={overlay.y(wall.centerline.start.y)} x2={overlay.x(wall.centerline.end.x)} y2={overlay.y(wall.centerline.end.y)} stroke={strong ? "#06b6d4" : "#f59e0b"} strokeWidth={Math.max(1.6, wall.thickness * unitsPerMeter * 0.32)} strokeLinecap="round" opacity="0.86" />;
          })}
          {showDimensions && scaleVerified ? dimensionWalls.map(({ wall, length }) => {
            const x1 = overlay.x(wall.centerline.start.x);
            const y1 = overlay.y(wall.centerline.start.y);
            const x2 = overlay.x(wall.centerline.end.x);
            const y2 = overlay.y(wall.centerline.end.y);
            const midX = (x1 + x2) / 2;
            const midY = (y1 + y2) / 2;
            let angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
            if (angle > 90 || angle < -90) angle += 180;
            const label = formatBlueprintFeetInches(length);
            return (
              <g key={`dimension-${wall.id}`} transform={`translate(${midX} ${midY}) rotate(${angle})`} pointerEvents="none" data-wall-dimension={wall.id}>
                <text x="0" y="-7" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#ffffff" stroke="#0f172a" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round">{label}</text>
                <text x="0" y="-7" textAnchor="middle" dominantBaseline="central" fontSize="15" fontWeight="800" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace" fill="#ffffff">{label}</text>
              </g>
            );
          }) : null}
        </svg>
      </div>
      <p className="text-[10px] text-slate-400">Cyan = high-confidence reconstructed wall · amber = lower-confidence wall · feet/inches = deterministic Building Graph wall length. Dimension labels are limited to wall runs 4 ft or longer to keep the source readable. The source drawing remains unchanged; corrections are stored separately and replayed on regeneration.</p>
    </div>
  );
}
