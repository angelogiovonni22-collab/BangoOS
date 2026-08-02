import { Button } from "@/components/ui";
import type { PriorityAction } from "@/lib/labs/mission-control/types";
import { MissionStatusPill } from "./MissionStatusPill";

type PriorityActionQueueProps = {
  actions: PriorityAction[];
};

export function PriorityActionQueue({ actions }: PriorityActionQueueProps) {
  return (
    <section aria-labelledby="mc-action-queue-heading" className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-border)_74%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface)_76%,black)] p-4">
      <header className="mb-3">
        <h2 id="mc-action-queue-heading" className="text-lg font-semibold tracking-tight text-[var(--mc-text)]">Priority Action Queue</h2>
        <p className="text-sm text-[var(--mc-text-muted)]">Read-only advisory actions. No execution or production writes from this view.</p>
      </header>

      <div className="space-y-3">
        {actions.map((action) => (
          <article key={action.id} className="rounded-xl border border-[color:color-mix(in_oklab,var(--mc-border)_72%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface-2)_70%,black)] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--mc-text)]">{action.title}</p>
              <MissionStatusPill label={action.status} severity={action.status} />
            </div>
            <p className="mt-1 text-sm text-[var(--mc-text)]">{action.purpose}</p>
            <div className="mt-2 grid gap-1 text-xs text-[var(--mc-text-muted)]">
              <p>Owner: {action.owner}</p>
              <p>Due: {action.due}</p>
              <p>Urgency: {action.urgency}</p>
              <p>Evidence source: {action.evidenceSource}</p>
              <p>Approval required: {action.approvalRequired}</p>
              <p className="font-semibold uppercase tracking-[0.08em] text-[var(--mc-orion)]">Prototype advisory only</p>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button variant="toolbar" size="sm" disabled>
                {action.previewLabel}
              </Button>
              <span className="text-xs text-[var(--mc-text-muted)]">Preview disabled in read-only pilot mode.</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
