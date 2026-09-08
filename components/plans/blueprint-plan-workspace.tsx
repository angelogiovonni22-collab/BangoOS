"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Minimize2, Settings2, X } from "lucide-react";
import { Button } from "@/components/ui";
import { Blueprint2dViewer } from "./blueprint-2d-viewer";
import { Blueprint3dViewer } from "./blueprint-3d-viewer";
import { BlueprintExportActions } from "./blueprint-export-actions";
import { BlueprintFieldTools } from "./blueprint-field-tools";
import { BlueprintOrionIntelligence } from "./blueprint-orion-intelligence";
import type { PlanDocument } from "./types";

type BlueprintPlanWorkspaceProps = {
  open: boolean;
  onClose: () => void;
  document: PlanDocument;
  projectName: string;
  companyId: string;
  projectId: string;
  userId: string;
  previewType: "image" | "pdf" | "ifc" | "gltf";
  initialPage?: number;
  initialAnnotationId?: string | null;
};

export function BlueprintPlanWorkspace({
  open,
  onClose,
  document: planDocument,
  projectName,
  companyId,
  projectId,
  userId,
  previewType,
  initialPage = 1,
  initialAnnotationId,
}: BlueprintPlanWorkspaceProps) {
  const [toolsOpen, setToolsOpen] = useState(false);

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setToolsOpen(false);
  }, [open]);

  if (!open || !planDocument.fileUrl) return null;

  const is3d = previewType === "ifc" || previewType === "gltf";

  return (
    <div
      className="fixed inset-0 z-[120] h-dvh w-screen overflow-hidden bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Plan workspace for ${planDocument.fileName}`}
      data-orion-region="blueprint-plan-workspace"
    >
      {is3d ? (
        <Blueprint3dViewer
          fileUrl={planDocument.fileUrl}
          fileName={planDocument.fileName}
          format={previewType}
          companyId={companyId}
          projectId={projectId}
          versionId={planDocument.versionId}
          userId={userId}
        />
      ) : (
        <Blueprint2dViewer
          key={`workspace:${planDocument.versionId}`}
          fileUrl={planDocument.fileUrl}
          fileName={planDocument.fileName}
          previewType={previewType}
          companyId={companyId}
          projectId={projectId}
          versionId={planDocument.versionId}
          userId={userId}
          discipline={planDocument.discipline}
          expanded
          initialPage={initialPage}
          initialAnnotationId={initialAnnotationId}
          onClose={onClose}
        />
      )}

      <div className="fixed bottom-4 right-4 z-[130] flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setToolsOpen(true)}
          aria-expanded={toolsOpen}
          aria-controls="blueprint-full-page-tools"
          className="shadow-xl"
        >
          <Settings2 size={16} aria-hidden="true" /> Tools
        </Button>
        {is3d ? (
          <Button
            type="button"
            size="icon"
            variant="secondary"
            onClick={onClose}
            aria-label="Exit full-page plan workspace"
            title="Exit full-page plan workspace"
            className="shadow-xl"
          >
            <Minimize2 size={18} aria-hidden="true" />
          </Button>
        ) : null}
      </div>

      {toolsOpen ? (
        <aside
          id="blueprint-full-page-tools"
          className="fixed bottom-3 right-3 top-3 z-[140] w-[min(30rem,calc(100vw-1.5rem))] overflow-y-auto rounded-2xl border border-white/15 bg-slate-950/98 text-white shadow-2xl backdrop-blur"
          data-orion-region="blueprint-full-page-tools"
          aria-label="Blueprint tools"
        >
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-slate-950/95 px-4 py-3 backdrop-blur">
            <div className="min-w-0">
              <p className="truncate text-sm font-bold">{planDocument.fileName}</p>
              <p className="truncate text-[11px] text-slate-400">Revision {planDocument.revision} · {planDocument.discipline}</p>
            </div>
            <button type="button" onClick={() => setToolsOpen(false)} aria-label="Close Blueprint tools" className="rounded-md p-2 text-slate-300 hover:bg-white/10 hover:text-white">
              <X size={17} aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-4 p-4">
            <a
              href={planDocument.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/15 bg-white/10 px-3 text-xs font-semibold text-white hover:bg-white/15"
            >
              <ExternalLink size={14} aria-hidden="true" /> Original file
            </a>

            <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-300">Export & share</p>
              <BlueprintExportActions
                companyId={companyId}
                projectId={projectId}
                versionId={planDocument.versionId}
                userId={userId}
                projectName={projectName}
                document={{
                  fileName: planDocument.fileName,
                  revision: planDocument.revision,
                  discipline: planDocument.discipline,
                  originalFileName: planDocument.originalFileName || planDocument.fileName,
                  revisionHistory: planDocument.revisionHistory,
                }}
              />
            </section>

            <BlueprintFieldTools companyId={companyId} projectId={projectId} versionId={planDocument.versionId} />
            <BlueprintOrionIntelligence companyId={companyId} projectId={projectId} versionId={planDocument.versionId} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
