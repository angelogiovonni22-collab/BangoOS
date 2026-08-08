import type { ReactNode } from "react";

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

export function ErrorState({
  title,
  description,
  action,
  compact = false,
}: ErrorStateProps) {
  return (
    <div
      className={`flex items-center justify-center px-[var(--space-6)] py-[var(--space-10)] ${compact ? "min-h-52" : "min-h-80"}`}
    >
      <div className="w-full max-w-lg rounded-[var(--radius-2xl)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-control)] px-[var(--space-6)] py-[var(--space-8)] text-center shadow-[var(--shadow-small)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-2xl font-bold text-[var(--color-danger-700)] shadow-[var(--shadow-small)]">
          !
        </div>

        <h3 className="mt-5 text-h3 font-semibold text-[var(--bos-text-primary)]">{title}</h3>

        <p className="mt-3 text-body font-medium text-[var(--bos-text-secondary)]">{description}</p>

        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
