"use client";

import { useState } from "react";
import { ExternalLink, FileBadge2, Maximize2 } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { RevisionHistory } from "./revision-history";
import { Blueprint2dViewer } from "./blueprint-2d-viewer";
import { BlueprintPlanWorkspace } from "./blueprint-plan-workspace";
import { Blueprint3dViewer } from "./blueprint-3d-viewer";
import type { PlanDocument } from "./types";
import { formatBlueprintDate } from "@/lib/blueprints/format";

type PlansPreviewProps = {
  selectedDocument: PlanDocument | null;
  projectName: string;
  onUploadRevision: (document: PlanDocument) => void;
  companyId: string;
  projectId: string;
  userId: string;
};

export function PlansPreview({ selectedDocument, projectName, onUploadRevision, companyId, projectId, userId }: PlansPreviewProps) {
  const [workspaceOpen, setWorkspaceOpen] = useState(false);

  if (!selectedDocument) {
    return (
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <EmptyState
          compact
          icon="P"
          title="Plan preview unavailable"
          description="Plan preview is unavailable because no project plan file is connected."
        />
      </section>
    );
  }

  const previewType = resolvePreviewType(selectedDocument.originalFileName || selectedDocument.fileName, selectedDocument.mimeType);

  return (
    <section
      className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]"
      aria-label="Drawing preview and metadata"
    >
      <div className="bg-[var(--color-surface-subtle)]/65 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedDocument.fileName}</h3>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Revision {selectedDocument.revision}</p>
          </div>
          <Button
            type="button"
            size="sm"
            disabled={!selectedDocument.fileUrl || previewType === "unsupported"}
            onClick={() => setWorkspaceOpen(true)}
            data-orion-action="blueprints.open-workspace"
          >
            <Maximize2 size={15} aria-hidden="true" />
            Open workspace
          </Button>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {selectedDocument.fileUrl && (previewType === "ifc" || previewType === "gltf") ? <div className="h-[38rem]"><Blueprint3dViewer fileUrl={selectedDocument.fileUrl} fileName={selectedDocument.fileName} format={previewType} companyId={companyId} projectId={projectId} versionId={selectedDocument.versionId} userId={userId}/></div> : selectedDocument.fileUrl && (previewType === "image" || previewType === "pdf") ? (
          <Blueprint2dViewer
            key={`${selectedDocument.id}:${selectedDocument.revision}`}
            fileUrl={selectedDocument.fileUrl}
            fileName={selectedDocument.fileName}
            previewType={previewType}
            companyId={companyId}
            projectId={projectId}
            versionId={selectedDocument.versionId}
            userId={userId}
            discipline={selectedDocument.discipline}
          />
        ) : (
        <div className="flex h-72 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)]/75">
          <div className="text-center">
            <FileBadge2 size={28} aria-hidden="true" className="mx-auto text-[var(--color-text-muted)]" />
            {previewType === "pdf" ? (
              <>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">PDF file detected</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Secure preview is unavailable because no connected file URL is present for this record.</p>
              </>
            ) : null}

            {previewType === "image" ? (
              <>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">Image file detected</p>
                <p className="text-xs text-[var(--color-text-secondary)]">Preview is unavailable because no connected file URL is present for this record.</p>
              </>
            ) : null}

            {previewType === "unsupported" ? (
              <>
                <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">Unsupported file type</p>
                <p className="text-xs text-[var(--color-text-secondary)]">This format cannot be previewed in the workspace.</p>
              </>
            ) : null}
          </div>
        </div>
        )}

        <div className="grid gap-2 sm:grid-cols-2">
          <MetadataRow label="Upload date" value={formatBlueprintDate(selectedDocument.uploadedAt)} />
          <MetadataRow label="Uploaded by" value={selectedDocument.uploadedBy} />
          <MetadataRow label="Linked project" value={projectName} />
          <MetadataRow label="Linked RFIs" value={String(selectedDocument.linkedRfis)} />
          <MetadataRow label="Linked submittals" value={String(selectedDocument.linkedSubmittals)} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Revision history
          </p>
          <Button type="button" size="sm" variant="outline" onClick={() => onUploadRevision(selectedDocument)}>
            Upload revision
          </Button>
        </div>
        <div>
          <div className="mt-2">
            <RevisionHistory revisions={selectedDocument.revisionHistory} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Preview status
          </p>
          <div className="mt-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm text-[var(--color-text-secondary)]">
            {previewType === "unsupported"
              ? "Only image and PDF files are currently supported for preview workflows."
              : selectedDocument.fileUrl
                ? "Secure preview is active. The signed file link expires automatically."
                : "Plan preview is unavailable because no project plan file is connected."}
          </div>

          <div className="mt-3">
            <button
              type="button"
              disabled={!selectedDocument.fileUrl}
              onClick={() => selectedDocument.fileUrl && window.open(selectedDocument.fileUrl, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-text-secondary)] opacity-70"
            >
              <ExternalLink size={14} aria-hidden="true" />
              Open file
            </button>
          </div>
        </div>
      </div>

      {selectedDocument.fileUrl && previewType !== "unsupported" ? (
        <BlueprintPlanWorkspace
          open={workspaceOpen}
          onClose={() => setWorkspaceOpen(false)}
          document={selectedDocument}
          projectName={projectName}
          companyId={companyId}
          projectId={projectId}
          userId={userId}
          previewType={previewType}
        />
      ) : null}
    </section>
  );
}

function resolvePreviewType(fileName: string, mimeType?: string) {
  if (mimeType === "application/pdf") return "pdf" as const;
  if (mimeType?.startsWith("image/")) return "image" as const;
  const extension = fileName.split(".").pop()?.trim().toLowerCase() || "";
  if (extension === "ifc") return "ifc" as const;
  if (["glb","gltf"].includes(extension) || mimeType === "model/gltf-binary" || mimeType === "model/gltf+json") return "gltf" as const;

  if (["png", "jpg", "jpeg", "gif", "webp"].includes(extension)) {
    return "image" as const;
  }

  if (extension === "pdf") {
    return "pdf" as const;
  }

  return "unsupported" as const;
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{value}</p>
    </div>
  );
}
