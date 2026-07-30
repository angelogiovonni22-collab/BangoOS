import { Bot, FileBadge2, Files, Link2, Rss } from "lucide-react";
import { EmptyState } from "@/components/ui";
import { RevisionHistory } from "./revision-history";
import type { PlanDocument } from "./types";

type PlansPreviewProps = {
  selectedDocument: PlanDocument | null;
  projectName: string;
};

export function PlansPreview({ selectedDocument, projectName }: PlansPreviewProps) {
  if (!selectedDocument) {
    return (
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <EmptyState
          compact
          icon="P"
          title="Select a drawing"
          description="Choose a file from the register to view revision history, links, and AI-ready metadata placeholders."
        />
      </section>
    );
  }

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
        <div className="flex h-56 items-center justify-center rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)]/75">
          <div className="text-center">
            <FileBadge2 size={28} aria-hidden="true" className="mx-auto text-[var(--color-text-muted)]" />
            <p className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">Preview Placeholder</p>
            <p className="text-xs text-[var(--color-text-secondary)]">PDF rendering will be enabled in a future sprint.</p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <MetadataRow label="Upload date" value={selectedDocument.uploadedAt} />
          <MetadataRow label="Uploaded by" value={selectedDocument.uploadedBy} />
          <MetadataRow label="Linked project" value={projectName} />
          <MetadataRow label="Linked RFIs" value={String(selectedDocument.linkedRfis)} />
          <MetadataRow label="Linked submittals" value={String(selectedDocument.linkedSubmittals)} />
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            Revision history
          </p>
          <div className="mt-2">
            <RevisionHistory revisions={selectedDocument.revisionHistory} />
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            AI preparation
          </p>
          <ul className="mt-2 space-y-2 text-sm text-[var(--color-text-secondary)]">
            <li className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Bot size={15} aria-hidden="true" />
              Drawing summary placeholder
            </li>
            <li className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Rss size={15} aria-hidden="true" />
              Specification search placeholder
            </li>
            <li className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Link2 size={15} aria-hidden="true" />
              Cross-sheet references placeholder
            </li>
            <li className="flex items-center gap-2 rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Files size={15} aria-hidden="true" />
              Missing detail detection and revision comparison placeholders
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{value}</p>
    </div>
  );
}
