import { ArrowUpDown } from "lucide-react";
import {
  EmptyState,
  EnterpriseTable,
  EnterpriseTableBody,
  EnterpriseTableCell,
  EnterpriseTableHead,
  EnterpriseTableHeading,
  EnterpriseTableRow,
} from "@/components/ui";
import { DocumentActions } from "./document-actions";
import { DocumentStatusBadge } from "./document-status";
import type { PlanDocument, PlansSortDirection, PlansSortKey } from "./types";

type PlansTableProps = {
  documents: PlanDocument[];
  selectedIds: Set<string>;
  focusedDocumentId: string | null;
  sortKey: PlansSortKey;
  sortDirection: PlansSortDirection;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelect: (documentId: string, checked: boolean) => void;
  onSelectDocument: (documentId: string) => void;
  onSortRequest: (key: PlansSortKey) => void;
};

export function PlansTable({
  documents,
  selectedIds,
  focusedDocumentId,
  sortKey,
  sortDirection,
  onToggleSelectAll,
  onToggleSelect,
  onSelectDocument,
  onSortRequest,
}: PlansTableProps) {
  const allSelected = documents.length > 0 && documents.every((doc) => selectedIds.has(doc.id));

  if (documents.length === 0) {
    return (
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <EmptyState
          compact
          icon="D"
          title="No documents in this view"
          description="Try a different folder or clear filters to see additional plan packages."
        />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[var(--shadow-small)]">
      <EnterpriseTable ariaLabel="Plans and drawings register" minWidthClassName="min-w-[1040px]">
          <EnterpriseTableHead className="text-xs uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
            <tr>
              <EnterpriseTableHeading className="w-[52px] px-4">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(event) => onToggleSelectAll(event.target.checked)}
                  aria-label="Select all documents"
                  className="h-4 w-4 rounded border-[var(--color-border-strong)]"
                />
              </EnterpriseTableHeading>
              <SortableHeader label="File Name" value="fileName" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Discipline" value="discipline" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Revision" value="revision" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Status" value="status" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Uploaded By" value="uploadedBy" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Date" value="uploadedAt" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Size" value="sizeInBytes" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <SortableHeader label="Linked RFIs" value="linkedRfis" sortKey={sortKey} sortDirection={sortDirection} onSortRequest={onSortRequest} />
              <EnterpriseTableHeading align="right" className="px-4">Actions</EnterpriseTableHeading>
            </tr>
          </EnterpriseTableHead>

          <EnterpriseTableBody>
            {documents.map((document) => {
              const isFocused = document.id === focusedDocumentId;
              const isSelected = selectedIds.has(document.id);

              return (
                <EnterpriseTableRow
                  key={document.id}
                  selected={isFocused}
                  className={`border-t border-[var(--color-border-subtle)] ${isFocused ? "shadow-[inset_3px_0_0_0_var(--color-brand-600)]" : ""}`}
                >
                  <EnterpriseTableCell className="px-4 py-4 align-middle">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(event) => onToggleSelect(document.id, event.target.checked)}
                      aria-label={`Select ${document.fileName}`}
                      className="h-4 w-4 rounded border-[var(--color-border-strong)]"
                    />
                  </EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle">
                    <button
                      type="button"
                      onClick={() => onSelectDocument(document.id)}
                      className="text-sm font-semibold text-[var(--color-text-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
                    >
                      {document.fileName}
                    </button>
                  </EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle text-[var(--color-text-secondary)]">{document.discipline}</EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle text-[var(--color-text-secondary)]">{document.revision}</EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle"><DocumentStatusBadge status={document.status} className="px-2.5 py-0.5 text-[10px]" /></EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle text-[var(--color-text-secondary)]">{document.uploadedBy}</EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle text-[var(--color-text-secondary)]">{document.uploadedAt}</EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle text-[var(--color-text-secondary)]">{formatFileSize(document.sizeInBytes)}</EnterpriseTableCell>
                  <EnterpriseTableCell className="px-4 py-4 align-middle text-[var(--color-text-secondary)]">{document.linkedRfis}</EnterpriseTableCell>
                  <EnterpriseTableCell align="right" className="px-3 py-3 align-middle">
                    <DocumentActions fileName={document.fileName} onPreview={() => onSelectDocument(document.id)} />
                  </EnterpriseTableCell>
                </EnterpriseTableRow>
              );
            })}
          </EnterpriseTableBody>
      </EnterpriseTable>
    </section>
  );
}

function SortableHeader({
  label,
  value,
  sortKey,
  sortDirection,
  onSortRequest,
}: {
  label: string;
  value: PlansSortKey;
  sortKey: PlansSortKey;
  sortDirection: PlansSortDirection;
  onSortRequest: (key: PlansSortKey) => void;
}) {
  const isActive = value === sortKey;

  return (
    <EnterpriseTableHeading className="px-4">
      <button
        type="button"
        onClick={() => onSortRequest(value)}
        className="inline-flex items-center gap-1.5 font-semibold text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        aria-label={`Sort by ${label}${isActive ? ` (${sortDirection})` : ""}`}
      >
        {label}
        <ArrowUpDown size={13} aria-hidden="true" />
      </button>
    </EnterpriseTableHeading>
  );
}

function formatFileSize(sizeInBytes: number) {
  if (sizeInBytes >= 1024 * 1024) {
    return `${(sizeInBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.ceil(sizeInBytes / 1024)} KB`;
}
