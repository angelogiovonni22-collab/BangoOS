import type { ReactNode } from "react";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={`flex items-center justify-center px-[var(--space-6)] py-[var(--space-8)] ${compact ? "min-h-44" : "min-h-72"}`}
    >
      <div className="w-full max-w-lg rounded-[var(--radius-2xl)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] px-[var(--space-6)] py-7 text-center shadow-[var(--shadow-small)]">
        {icon ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel-elevated)] text-2xl font-bold text-[var(--orion-cyan)] shadow-[var(--shadow-small)]">
            {icon}
          </div>
        ) : null}

        <h3 className="mt-4 text-h3 font-bold text-[var(--bos-text-primary)]">{title}</h3>

        <p className="mt-2.5 text-body font-medium text-[var(--bos-text-secondary)]">{description}</p>

        {action || secondaryAction ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-[var(--space-action-gap)]">
            {secondaryAction}
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
