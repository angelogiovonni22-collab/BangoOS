import { Layers3 } from "lucide-react";

type ProjectCommandCenterTabPlaceholderProps = {
  tabLabel: string;
};

export function ProjectCommandCenterTabPlaceholder({ tabLabel }: ProjectCommandCenterTabPlaceholderProps) {
  const normalizedTab = tabLabel.toLowerCase();

  return (
    <section className="min-w-0 rounded-[18px] border border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] p-6 shadow-[var(--bos-shadow-workspace-card)]">
      <div className="mb-4 flex min-w-0 items-center justify-between gap-3 rounded-[12px] border border-[#d3e2f2] bg-[#f7fbff] px-4 py-3">
        <p className="min-w-0 break-words text-section-title font-bold text-[var(--bos-text-strong-on-light)]">{tabLabel}</p>
        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
            <Layers3 size={14} aria-hidden="true" />
          </span>
          Ready
        </span>
      </div>

      <div className="rounded-[12px] border border-dashed border-[var(--bos-border-light-strong)] bg-[var(--color-neutral-50)] px-4 py-4">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">
            <Layers3 size={16} aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">No {normalizedTab} records available yet</p>
            <p className="mt-1 text-sm font-medium leading-6 text-[var(--bos-text-medium-on-light)]">Data will appear here as soon as your team starts logging {normalizedTab} activity for this project.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
