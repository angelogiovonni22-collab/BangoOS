import type { ReactNode } from "react";

type PageHeaderProps = {
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
};

export function PageHeader({
  title,
  description,
  primaryAction,
  secondaryActions,
}: PageHeaderProps) {
  return (
    <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--color-text-secondary)]">{description}</p>
      </div>

      {(primaryAction || secondaryActions) ? (
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </section>
  );
}
