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
      className={`flex items-center justify-center px-6 py-10 ${compact ? "min-h-52" : "min-h-80"}`}
    >
      <div className="max-w-lg text-center">
        {icon ? (
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-2xl font-bold text-[var(--color-brand-700)] shadow-[var(--shadow-small)]">
            {icon}
          </div>
        ) : null}

        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h3>

        <p className="mt-3 leading-7 text-[var(--color-text-secondary)]">{description}</p>

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
