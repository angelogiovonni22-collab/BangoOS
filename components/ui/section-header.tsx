import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function SectionHeader({ title, description, action }: SectionHeaderProps) {
  return (
    <div data-bos-section-header="true" className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden="true" className="h-2.5 w-1 shrink-0 rounded-full bg-gradient-to-b from-[var(--color-primary-500)] to-[var(--color-info-500)] shadow-[0_0_10px_rgb(59_130_246/0.28)]" />
          <h2 className="text-h2 font-bold text-[var(--color-text-primary)]">{title}</h2>
        </div>
        {description ? (
          <p className="mt-1 pl-3.5 text-body font-medium text-[var(--color-text-secondary)]">{description}</p>
        ) : null}
      </div>
      {action ? <div className="w-full min-w-0 sm:w-auto sm:shrink-0">{action}</div> : null}
    </div>
  );
}
