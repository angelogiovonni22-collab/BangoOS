import { Badge } from "@/components/ui";
import type { RevisionItem, RevisionStatus } from "./types";

type RevisionHistoryProps = {
  revisions: RevisionItem[];
};

const toneByStatus: Record<RevisionStatus, "brand" | "neutral" | "warning" | "success"> = {
  Current: "brand",
  Superseded: "neutral",
  Pending: "warning",
  Approved: "success",
};

export function RevisionHistory({ revisions }: RevisionHistoryProps) {
  return (
    <section aria-label="Revision history" className="space-y-2.5">
      {revisions.map((revision) => (
        <article
          key={revision.id}
          className="rounded-[var(--radius-lg)] bg-[var(--color-surface-subtle)] px-3.5 py-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
              Revision {revision.revision}
            </p>
            <Badge tone={toneByStatus[revision.approvalStatus]}>{revision.approvalStatus}</Badge>
          </div>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{revision.issuedAt}</p>
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{revision.notes}</p>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">Approved by {revision.approvedBy}</p>
        </article>
      ))}
    </section>
  );
}
