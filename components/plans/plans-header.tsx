import { FolderPlus, Import, Upload } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";

type PlansHeaderProps = {
  projectName: string;
  documentCount: number;
  lastRevisionDate: string;
};

export function PlansHeader({ projectName, documentCount, lastRevisionDate }: PlansHeaderProps) {
  return (
    <section className="space-y-6 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-6 shadow-[var(--shadow-small)] sm:space-y-7 sm:p-7">
      <PageHeader
        eyebrow="Project Workspace"
        title="Plans & Drawings"
        description="Document intelligence center for drawing packages, RFIs, submittals, and revision control."
        secondaryActions={(
          <>
            <Button variant="toolbar">
              <FolderPlus size={16} aria-hidden="true" />
              Create Folder
            </Button>
            <Button variant="toolbar">
              <Import size={16} aria-hidden="true" />
              Import
            </Button>
          </>
        )}
        primaryAction={(
          <Button>
            <Upload size={16} aria-hidden="true" />
            Upload Plans
          </Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <HeaderStat label="Current Project" value={projectName} />
        <HeaderStat label="Document Count" value={String(documentCount)} />
        <HeaderStat label="Last Revision Date" value={lastRevisionDate} />
      </div>
    </section>
  );
}

function HeaderStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-row)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3.5">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1.5 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
