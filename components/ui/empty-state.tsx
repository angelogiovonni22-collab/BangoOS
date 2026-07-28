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
      className={`flex items-center justify-center p-8 ${
        compact ? "min-h-48" : "min-h-80"
      }`}
    >
      <div className="max-w-md text-center">
        {icon ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-brand-50)] text-2xl font-bold text-[var(--color-brand-700)]">
            {icon}
          </div>
        ) : null}

        <h3 className="mt-5 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h3>

        <p className="mt-2 leading-7 text-[var(--color-text-muted)]">{description}</p>

        {action || secondaryAction ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {secondaryAction}
            {action}
          </div>
        ) : null}
      </div>
    </div>
  );
}
