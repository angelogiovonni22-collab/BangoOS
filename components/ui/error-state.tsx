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
      className={`flex items-center justify-center px-6 py-10 ${compact ? "min-h-52" : "min-h-80"}`}
    >
      <div className="max-w-lg text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-danger-50)] text-2xl font-bold text-[var(--color-danger-700)] shadow-[var(--shadow-small)]">
          !
        </div>

        <h3 className="mt-5 text-2xl font-semibold tracking-tight text-[var(--color-text-primary)]">{title}</h3>

        <p className="mt-3 leading-7 text-[var(--color-text-secondary)]">{description}</p>

        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
