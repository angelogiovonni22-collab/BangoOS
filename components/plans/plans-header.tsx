import { Box, Layers3, ScanLine, Upload } from "lucide-react";
import { Button, PageHeader } from "@/components/ui";
import { formatBlueprintDate } from "@/lib/blueprints/format";

type PlansHeaderProps = {
  projectName: string;
  documentCount: number;
  lastRevisionDate: string;
  onUpload: () => void;
};

export function PlansHeader({ projectName, documentCount, lastRevisionDate, onUpload }: PlansHeaderProps) {
  return (
    <section className="space-y-6 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white p-6 shadow-[var(--shadow-small)] sm:space-y-7 sm:p-7">
      <PageHeader
        eyebrow="Project Workspace"
        title="Blueprint Plan Room"
        description="The project workspace for sheets, revisions, calibrated markups, field coordination, and Orion plan intelligence."
        secondaryActions={(
          <>
            <Button variant="toolbar" disabled title="2D and 3D model views are coming in a later Blueprints phase.">
              <Box size={16} aria-hidden="true" />
              2D / 3D
            </Button>
            <Button variant="toolbar" disabled title="Calibrated markup tools are coming in the next Blueprints phase.">
              <ScanLine size={16} aria-hidden="true" />
              Markup
            </Button>
            <Button variant="toolbar" disabled title="Drawing layer controls are coming in a later Blueprints phase.">
              <Layers3 size={16} aria-hidden="true" />
              Layers
            </Button>
          </>
        )}
        primaryAction={(
          <Button onClick={onUpload} data-orion-action="blueprints.upload">
            <Upload size={16} aria-hidden="true" />
            Upload Plans
          </Button>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <HeaderStat label="Current Project" value={projectName} />
        <HeaderStat label="Blueprint Sheets" value={String(documentCount)} />
        <HeaderStat label="Last Revision Date" value={formatBlueprintDate(lastRevisionDate)} />
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
