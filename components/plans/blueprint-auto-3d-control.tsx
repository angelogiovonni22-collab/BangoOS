"use client";

import { useCallback, useEffect, useState } from "react";
import { Box, LoaderCircle, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";
import { BlueprintPlanWorkspace } from "./blueprint-plan-workspace";
import type { PlanDocument } from "./types";

type GeneratedModelPayload = {
  status: string;
  model: null | {
    id: string;
    signedUrl: string | null;
    mimeType: string | null;
    confidence: number;
    assumptions: string[];
    generationModel: string | null;
    errorMessage: string | null;
    updatedAt: string | null;
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

export function BlueprintAuto3dControl({ source, projectName, companyId, projectId, userId }: Props) {
  const [payload, setPayload] = useState<GeneratedModelPayload>({ status: "loading", model: null });
  const [generating, setGenerating] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const eligible = source.mimeType === "application/pdf" || Boolean(source.mimeType?.startsWith("image/"));

  const load = useCallback(async () => {
    if (!eligible) return;
    try {
      const response = await fetch(`/api/blueprints/${encodeURIComponent(source.versionId)}/generate-3d`, { cache: "no-store" });
      const next = await response.json() as GeneratedModelPayload;
      setPayload(response.ok ? next : { status: "failed", model: null, error: next.error || "Unable to load 3D generation status." });
    } catch (error) {
      setPayload({ status: "failed", model: null, error: error instanceof Error ? error.message : "Unable to load 3D generation status." });
    }
  }, [eligible, source.versionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (payload.status !== "processing" && payload.status !== "pending") return;
    const timer = window.setInterval(() => void load(), 3000);
    return () => window.clearInterval(timer);
  }, [load, payload.status]);

  const generate = async () => {
    setGenerating(true);
    setPayload((current) => ({ ...current, status: "processing", error: undefined }));
    try {
      const response = await fetch(`/api/blueprints/${encodeURIComponent(source.versionId)}/generate-3d`, { method: "POST" });
      const next = await response.json() as GeneratedModelPayload;
      if (!response.ok && next.status !== "needs_input") {
        setPayload({ status: "failed", model: next.model || null, error: next.error || "Automatic 3D generation failed." });
      } else {
        setPayload(next);
      }
    } catch (error) {
      setPayload({ status: "failed", model: null, error: error instanceof Error ? error.message : "Automatic 3D generation failed." });
    } finally {
      setGenerating(false);
    }
  };

  if (!eligible) return null;

  const ready = payload.status === "ready" && Boolean(payload.model?.signedUrl);
  const busy = generating || payload.status === "processing" || payload.status === "pending";
  const needsInput = payload.status === "needs_input";
  const failed = payload.status === "failed";
  const generatedDocument: PlanDocument | null = ready && payload.model?.signedUrl ? {
    ...source,
    id: `${source.id}:generated-3d`,
    fileName: `${source.fileName} · B.O.S. Generated 3D`,
    originalFileName: `${source.originalFileName || source.fileName}.glb`,
    fileUrl: payload.model.signedUrl,
    mimeType: "model/gltf-binary",
  } : null;

  return (
    <>
      <section className="rounded-[var(--radius-lg)] border border-cyan-300/30 bg-cyan-950/15 p-3" data-orion-region="blueprint-auto-3d">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.08em] text-cyan-700 dark:text-cyan-200">
              <Sparkles size={14} aria-hidden="true" /> Automatic Blueprint-to-3D
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
              B.O.S. can reconstruct this 2D sheet into a conceptual GLB model. Generated dimensions must be verified before construction use.
            </p>
          </div>
          {ready ? (
            <Button type="button" size="sm" onClick={() => setViewerOpen(true)} data-orion-action="blueprints.view-generated-3d">
              <Box size={15} aria-hidden="true" /> View 3D
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={() => void generate()} data-orion-action="blueprints.generate-3d">
              {busy ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : failed || needsInput ? <RefreshCw size={15} aria-hidden="true" /> : <Box size={15} aria-hidden="true" />}
              {busy ? "Generating 3D…" : failed || needsInput ? "Retry 3D" : "Generate 3D"}
            </Button>
          )}
        </div>

        {ready && payload.model ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--color-text-secondary)]">
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">3D Ready</span>
            <span>Confidence {Math.round(payload.model.confidence * 100)}%</span>
            {payload.model.assumptions.length ? <span>{payload.model.assumptions.length} assumption{payload.model.assumptions.length === 1 ? "" : "s"} to verify</span> : null}
          </div>
        ) : null}
        {needsInput || failed ? (
          <p className="mt-2 inline-flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300" role="status">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" aria-hidden="true" />
            {payload.model?.errorMessage || payload.error || "B.O.S. needs clearer plan geometry or dimensions before it can produce a useful 3D model."}
          </p>
        ) : null}
      </section>

      {generatedDocument ? (
        <BlueprintPlanWorkspace
          open={viewerOpen}
          onClose={() => setViewerOpen(false)}
          document={generatedDocument}
          projectName={projectName}
          companyId={companyId}
          projectId={projectId}
          userId={userId}
          previewType="gltf"
        />
      ) : null}
    </>
  );
}
