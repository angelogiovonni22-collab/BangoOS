"use client";

import { ExternalLink, FileText, X } from "lucide-react";
import { Button, Dialog } from "@/components/ui";
import { Blueprint2dViewer } from "./blueprint-2d-viewer";
import { BlueprintExportActions } from "./blueprint-export-actions";
import { Blueprint3dViewer } from "./blueprint-3d-viewer";
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
};

export function BlueprintPlanWorkspace({
  open,
  onClose,
  document,
  projectName,
  companyId,
  projectId,
  userId,
  previewType,
}: BlueprintPlanWorkspaceProps) {
  if (!document.fileUrl) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      ariaLabel={`Plan workspace for ${document.fileName}`}
      closeOnBackdrop={false}
      className="p-2 sm:p-4"
      panelClassName="flex h-[calc(100dvh-1rem)] max-w-[min(96rem,calc(100vw-1rem))] flex-col overflow-hidden p-0 sm:h-[calc(100dvh-2rem)]"
    >
      <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-subtle)] bg-white px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
            <FileText size={18} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base font-bold text-[var(--color-text-primary)]">{document.fileName}</p>
            <p className="truncate text-xs text-[var(--color-text-secondary)]">
              {projectName} · Revision {document.revision} · {document.discipline}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={document.fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-strong)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
          >
            <ExternalLink size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Original file</span>
          </a>
          <Button type="button" size="icon" variant="ghost" onClick={onClose} aria-label="Close plan workspace">
            <X size={18} aria-hidden="true" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 bg-slate-900 p-2 sm:p-3" data-orion-region="blueprint-plan-workspace">
        {previewType === "ifc" || previewType === "gltf" ? <Blueprint3dViewer fileUrl={document.fileUrl} fileName={document.fileName} format={previewType} /> : <Blueprint2dViewer
          key={`workspace:${document.versionId}`}
          fileUrl={document.fileUrl}
          fileName={document.fileName}
          previewType={previewType}
          companyId={companyId}
          projectId={projectId}
          versionId={document.versionId}
          userId={userId}
          discipline={document.discipline}
          expanded
        />}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border-subtle)] bg-white px-4 py-2 text-[11px] text-[var(--color-text-secondary)]">
        <span>Large Plan Workspace · Markups save to Revision {document.revision}</span>
        <BlueprintExportActions companyId={companyId} projectId={projectId} versionId={document.versionId} userId={userId} projectName={projectName} document={{ fileName: document.fileName, revision: document.revision, discipline: document.discipline, originalFileName: document.originalFileName || document.fileName, revisionHistory: document.revisionHistory }} />
      </div>
      </div>
    </Dialog>
  );
}
