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
      className={`flex items-center justify-center p-8 ${
        compact ? "min-h-48" : "min-h-80"
      }`}
    >
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[var(--radius-xl)] bg-[var(--color-danger-50)] text-2xl font-bold text-[var(--color-danger-700)]">
          !
        </div>

        <h3 className="mt-5 text-xl font-semibold text-[var(--color-text-primary)]">{title}</h3>

        <p className="mt-2 leading-7 text-[var(--color-text-muted)]">{description}</p>

        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
