"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Eye, ImageIcon, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Button, Dialog, StatusBadge } from "@/components/ui";
import type { PlanDocument } from "./types";

type VisualStyle = "architectural" | "warm-modern" | "monochrome";

type VisualMockupPayload = {
  status: string;
  mockup: null | {
    id: string;
    signedUrl: string | null;
    sourcePage: number;
    generationModel: string | null;
    promptTemplateVersion: string;
    options: { furnished?: boolean; style?: VisualStyle };
    reviewMetadata: { sourceGraphStatus?: string; graphContextIncluded?: boolean; geometryLocked?: boolean; geometryLockVersion?: string } | null;
    disclaimer: string;
    errorMessage: string | null;
    createdAt: string;
  };
  error?: string;
  fidelityGate?: { allowed: boolean; score: number; blockers: string[] };
};

export function BlueprintVisualMockupControl({ source }: { source: PlanDocument }) {
  const [payload, setPayload] = useState<VisualMockupPayload>({ status: "loading", mockup: null });
  const [generating, setGenerating] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [furnished, setFurnished] = useState(true);
  const [style, setStyle] = useState<VisualStyle>("architectural");

  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/blueprints/${encodeURIComponent(source.versionId)}/visual-mockup`, { cache: "no-store" });
      const next = await response.json() as VisualMockupPayload;
      setPayload(response.ok ? next : { status: "failed", mockup: null, error: next.error || "Unable to load the visual mockup." });
    } catch (error) {
      setPayload({ status: "failed", mockup: null, error: error instanceof Error ? error.message : "Unable to load the visual mockup." });
    }
  }, [source.versionId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (payload.status !== "queued" && payload.status !== "processing") return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load, payload.status]);

  const generate = async () => {
    const priorPayload = payload;
    setGenerating(true);
    setViewerOpen(false);
    try {
      const response = await fetch(`/api/blueprints/${encodeURIComponent(source.versionId)}/visual-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ furnished, style }),
      });
      const next = await response.json() as VisualMockupPayload;
      setPayload(response.ok ? next : { ...priorPayload, error: next.error || "Visual mockup generation failed.", fidelityGate: next.fidelityGate });
    } catch (error) {
      setPayload({ ...priorPayload, error: error instanceof Error ? error.message : "Visual mockup generation failed." });
    } finally {
      setGenerating(false);
    }
  };

  const ready = (payload.status === "ready" || payload.status === "needs_review") && Boolean(payload.mockup?.signedUrl);
  const busy = generating || payload.status === "queued" || payload.status === "processing";
  const disclaimer = payload.mockup?.disclaimer || "Conceptual AI visualization — verify against the source plans before construction use.";
  const download = () => {
    if (!payload.mockup?.signedUrl) return;
    const anchor = document.createElement("a");
    anchor.href = payload.mockup.signedUrl;
    anchor.download = `${source.fileName}-visual-mockup.png`;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.click();
  };

  return (
    <>
      <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)]" data-orion-region="blueprint-ai-visual-mockup">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-blue-700">
                <ImageIcon size={14} aria-hidden="true" /> AI Visual Mockup
              </p>
              {payload.status !== "loading" && payload.status !== "not_generated" ? <StatusBadge status={payload.status} /> : null}
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              Creates a polished roofless isometric presentation image. The Interactive 3D Model remains the technical Building Graph, correction and IFC workspace.
            </p>
          </div>
          {ready ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={download} data-orion-action="blueprints.download-visual-mockup"><Download size={15} aria-hidden="true" /> Download</Button>
              <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => void generate()} data-orion-action="blueprints.regenerate-visual-mockup">
                {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />} Regenerate
              </Button>
              <Button type="button" size="sm" onClick={() => setViewerOpen(true)} data-orion-action="blueprints.view-visual-mockup"><Eye size={15} aria-hidden="true" /> View mockup</Button>
            </div>
          ) : (
            <Button type="button" size="sm" disabled={busy || payload.status === "loading"} onClick={() => void generate()} data-orion-action="blueprints.generate-visual-mockup">
              {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : payload.status === "failed" ? <RefreshCw size={15} aria-hidden="true" /> : <ImageIcon size={15} aria-hidden="true" />}
              {busy ? "Generating mockup…" : payload.status === "failed" ? "Retry mockup" : "Generate Visual Mockup"}
            </Button>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-semibold text-[var(--color-text-primary)]">Presentation style
            <select value={style} onChange={(event) => setStyle(event.target.value as VisualStyle)} disabled={busy} className="mt-1 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm">
              <option value="architectural">Architectural</option>
              <option value="warm-modern">Warm modern</option>
              <option value="monochrome">Monochrome model</option>
            </select>
          </label>
          <label className="flex items-center gap-2 self-end rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <input type="checkbox" checked={furnished} onChange={(event) => setFurnished(event.target.checked)} disabled={busy} /> Furnished for scale
          </label>
        </div>

        {ready && payload.mockup ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-[9rem_1fr]">
            <button type="button" className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-slate-100" onClick={() => setViewerOpen(true)} aria-label="View visual mockup fullscreen">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={payload.mockup.signedUrl || ""} alt={`Conceptual AI visual mockup for ${source.fileName}`} className="aspect-[4/3] h-full w-full object-cover" />
            </button>
            <div className="text-xs text-[var(--color-text-secondary)]">
              <p><span className="font-semibold text-[var(--color-text-primary)]">Source:</span> {source.fileName}, page {payload.mockup.sourcePage}</p>
              <p className="mt-1"><span className="font-semibold text-[var(--color-text-primary)]">Context:</span> {payload.mockup.reviewMetadata?.graphContextIncluded ? "Building Graph and saved corrections included" : "source plan only"}</p>
              {payload.status === "needs_review" ? <p className="mt-1 font-semibold text-amber-700">The source Building Graph needs review; this image remains conceptual.</p> : null}
              {!payload.mockup.reviewMetadata?.geometryLocked ? <p className="mt-1 font-semibold text-red-700">Legacy conceptual output — its layout was not geometry locked.</p> : <p className="mt-1 font-semibold text-emerald-700">Geometry locked to the validated Building Graph.</p>}
            </div>
          </div>
        ) : null}

        {payload.status === "failed" || payload.error ? <div className="mt-3 text-xs text-red-700" role="alert"><p className="inline-flex items-start gap-1.5 font-semibold"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{payload.mockup?.errorMessage || payload.error || "Visual mockup generation failed. Retry when ready."}</p>{payload.fidelityGate?.blockers?.length ? <ul className="mt-1 list-disc pl-6">{payload.fidelityGate.blockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul> : null}</div> : null}
        <p className="mt-3 text-xs font-semibold text-amber-800" role="note">{disclaimer}</p>
        <button type="button" disabled={!source.fileUrl} onClick={() => source.fileUrl && window.open(source.fileUrl, "_blank", "noopener,noreferrer")} className="mt-2 text-xs font-semibold text-blue-700 underline-offset-2 hover:underline disabled:opacity-50" data-orion-action="blueprints.view-visual-mockup-source">View source plan</button>
      </section>

      <Dialog open={viewerOpen && ready} onClose={() => setViewerOpen(false)} title="AI Visual Mockup" description={`${source.fileName}${payload.mockup?.sourcePage ? ` · source page ${payload.mockup.sourcePage}` : ""}`} panelClassName="max-h-[92vh] max-w-6xl overflow-auto p-0">
        <div className="overflow-hidden rounded-[var(--radius-lg)] bg-slate-900 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={payload.mockup?.signedUrl || ""} alt={`Roofless isometric conceptual AI visualization for ${source.fileName}`} className="max-h-[68vh] w-full object-contain" />
        </div>
        <p className="mt-3 text-xs font-semibold text-amber-800">{disclaimer}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2"><Button type="button" variant="secondary" onClick={download}><Download size={15} aria-hidden="true" /> Download</Button><Button type="button" onClick={() => setViewerOpen(false)}>Close</Button></div>
      </Dialog>
    </>
  );
}
