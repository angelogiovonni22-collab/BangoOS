"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, Download, Layers3, LoaderCircle, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { BlueprintPlanWorkspace } from "./blueprint-plan-workspace";
import type { PlanDocument } from "./types";

type MultiFloorLevel = {
  levelId: string;
  versionId: string;
  sheetNumber: string;
  title: string;
  name: string;
  elevation: number;
  ready: boolean;
};

type MultiFloorPayload = {
  status: "single_level" | "needs_generation" | "ready" | "needs_review";
  levels: MultiFloorLevel[];
  missingVersionIds: string[];
  alignment: null | {
    valid: boolean;
    minimumConfidence: number;
    issues: string[];
    anchors: Array<{ levelId: string; confidence: number; anchor: string; translation: { x: number; y: number } }>;
  };
  error?: string;
};

type Props = {
  source: PlanDocument;
  projectName: string;
  companyId: string;
  projectId: string;
  userId: string;
};

export function BlueprintMultiFloorControl({ source, projectName, companyId, projectId, userId }: Props) {
  const [payload, setPayload] = useState<MultiFloorPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [building, setBuilding] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedLevelId, setSelectedLevelId] = useState<string | null>(null);
  const endpoint = `/api/blueprints/${encodeURIComponent(source.versionId)}/generated-3d/multi-floor`;

  const load = useCallback(async () => {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const next = await response.json() as MultiFloorPayload;
      setPayload(response.ok ? next : { status: "needs_review", levels: [], missingVersionIds: [], alignment: null, error: next.error || "Unable to load multi-floor status." });
    } catch (error) {
      setPayload({ status: "needs_review", levels: [], missingVersionIds: [], alignment: null, error: error instanceof Error ? error.message : "Unable to load multi-floor status." });
    } finally {
      setLoading(false);
    }
  }, [endpoint]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const build = async () => {
    if (!payload) return;
    setBuilding(true);
    try {
      for (const versionId of payload.missingVersionIds) {
        const response = await fetch(`/api/blueprints/${encodeURIComponent(versionId)}/generate-3d`, { method: "POST" });
        if (!response.ok) {
          const body = await response.json().catch(() => ({})) as { error?: string; model?: { errorMessage?: string | null } };
          throw new Error(body.model?.errorMessage || body.error || `B.O.S. could not validate floor revision ${versionId}.`);
        }
      }
      await load();
    } catch (error) {
      setPayload((current) => current ? { ...current, status: "needs_review", error: error instanceof Error ? error.message : "Multi-floor generation failed." } : current);
    } finally {
      setBuilding(false);
    }
  };

  const modelUrl = useMemo(() => {
    if (!payload || payload.status !== "ready") return null;
    const query = new URLSearchParams({ format: "glb" });
    if (selectedLevelId) query.set("level", selectedLevelId);
    return `${endpoint}?${query.toString()}`;
  }, [endpoint, payload, selectedLevelId]);

  const generatedDocument: PlanDocument | null = modelUrl ? {
    ...source,
    id: `${source.id}:multifloor:${selectedLevelId || "all"}`,
    fileName: selectedLevelId ? `${projectName} · ${payload?.levels.find((level) => level.levelId === selectedLevelId)?.name || "Level"}` : `${projectName} · Multi-floor Building Graph`,
    originalFileName: "bos-multifloor.glb",
    fileUrl: modelUrl,
    mimeType: "model/gltf-binary",
  } : null;

  if (loading) return <p className="inline-flex items-center gap-2 text-xs text-[var(--color-text-secondary)]"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" /> Discovering project levels…</p>;
  if (!payload || payload.status === "single_level") return null;

  const ready = payload.status === "ready";
  const needsReview = payload.status === "needs_review";

  return (
    <>
      <section className="rounded-[var(--radius-lg)] border border-violet-300/30 bg-violet-950/10 p-3" data-orion-region="blueprint-multifloor">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-violet-700 dark:text-violet-200"><Building2 size={14} aria-hidden="true" /> Multi-floor reconstruction</p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">B.O.S. discovered {payload.levels.length} architectural levels from registered sheet metadata. Each floor is validated independently before alignment into one Building Graph.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!ready ? (
              <Button type="button" size="sm" disabled={building} onClick={() => void build()} data-orion-action="blueprints.build-multifloor">
                {building ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Layers3 size={15} aria-hidden="true" />}
                {building ? "Building floors…" : payload.missingVersionIds.length ? `Build ${payload.missingVersionIds.length} missing floor${payload.missingVersionIds.length === 1 ? "" : "s"}` : "Retry alignment"}
              </Button>
            ) : (
              <>
                <a href={`${endpoint}?format=ifc`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 text-xs font-semibold text-[var(--color-text-primary)]" data-orion-action="blueprints.export-multifloor-ifc"><Download size={14} aria-hidden="true" /> Export IFC</a>
                <Button type="button" size="sm" onClick={() => setViewerOpen(true)} data-orion-action="blueprints.view-multifloor"><Building2 size={15} aria-hidden="true" /> View building</Button>
              </>
            )}
            <Button type="button" size="icon" variant="secondary" disabled={building} onClick={() => void load()} aria-label="Refresh multi-floor status" title="Refresh multi-floor status"><RefreshCw size={14} aria-hidden="true" /></Button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Blueprint level controls">
          <button type="button" disabled={!ready} onClick={() => { setSelectedLevelId(null); setViewerOpen(true); }} className={`rounded-md border px-2.5 py-1 text-[11px] font-bold ${selectedLevelId === null ? "border-violet-400 bg-violet-500/15 text-violet-700 dark:text-violet-200" : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}>All levels</button>
          {payload.levels.map((level) => (
            <button key={level.levelId} type="button" disabled={!ready} onClick={() => { setSelectedLevelId(level.levelId); setViewerOpen(true); }} className={`rounded-md border px-2.5 py-1 text-[11px] font-bold ${selectedLevelId === level.levelId ? "border-violet-400 bg-violet-500/15 text-violet-700 dark:text-violet-200" : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"}`}>
              {level.name} · {level.ready ? "Ready" : "Needs generation"}
            </button>
          ))}
        </div>

        {ready && payload.alignment ? (
          <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">Alignment confidence {Math.round(payload.alignment.minimumConfidence * 100)}% · {payload.alignment.anchors.map((item) => `${item.levelId}: ${item.anchor}`).join(" · ")}</p>
        ) : null}
        {needsReview || payload.error ? (
          <div className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300" role="status">
            <p className="inline-flex items-start gap-1.5"><TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />{payload.error || "B.O.S. needs review before releasing the multi-floor model."}</p>
            {payload.alignment?.issues.map((issue) => <p key={issue} className="pl-5">{issue}</p>)}
          </div>
        ) : null}
      </section>

      {generatedDocument ? (
        <BlueprintPlanWorkspace open={viewerOpen} onClose={() => setViewerOpen(false)} document={generatedDocument} projectName={projectName} companyId={companyId} projectId={projectId} userId={userId} previewType="gltf" />
      ) : null}
    </>
  );
}
