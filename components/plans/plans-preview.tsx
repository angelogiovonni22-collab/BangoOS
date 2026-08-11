import { ExternalLink, FileBadge2 } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { RevisionHistory } from "./revision-history";
import type { PlanDocument } from "./types";

type PlansPreviewProps = {
  selectedDocument: PlanDocument | null;
  projectName: string;
  onUploadRevision: (document: PlanDocument) => void;
};

export function PlansPreview({ selectedDocument, projectName, onUploadRevision }: PlansPreviewProps) {
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
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedDocument.fileName}</h3>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Revision {selectedDocument.revision}</p>
      </div>

      <div className="space-y-5 p-5">
        <div className="flex h-72 items-center justify-center overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)]/75">
          {selectedDocument.fileUrl && previewType === "pdf" ? (
            <iframe src={selectedDocument.fileUrl} title={`Preview ${selectedDocument.fileName}`} className="h-full w-full bg-white" />
          ) : selectedDocument.fileUrl && previewType === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={selectedDocument.fileUrl} alt={selectedDocument.fileName} className="h-full w-full object-contain" />
          ) : (
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
          )}
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <MetadataRow label="Upload date" value={selectedDocument.uploadedAt} />
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
    </section>
  );
}

function resolvePreviewType(fileName: string, mimeType?: string) {
  if (mimeType === "application/pdf") return "pdf" as const;
  if (mimeType?.startsWith("image/")) return "image" as const;
  const extension = fileName.split(".").pop()?.trim().toLowerCase() || "";

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
