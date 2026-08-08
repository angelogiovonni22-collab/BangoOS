import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  primaryAction?: ReactNode;
  secondaryActions?: ReactNode;
  compact?: boolean;
};

export function PageHeader({
  eyebrow = "B.O.S.",
  title,
  description,
  primaryAction,
  secondaryActions,
  compact = false,
}: PageHeaderProps) {
  return (
    <section className={`flex flex-col border-b border-[var(--color-border-subtle)] ${compact ? "gap-3.5 pb-4" : "gap-5 pb-5"} sm:flex-row sm:items-end sm:justify-between`}>
      <div className="max-w-3xl">
        <p className="text-caption font-semibold uppercase tracking-[0.22em] text-[var(--bos-text-secondary)]">
          {eyebrow}
        </p>
        <h1 className={`mt-1.5 font-bold tracking-tight text-[var(--bos-text-primary)] ${compact ? "text-h2 sm:text-[2rem]" : "text-h1 sm:text-[2.45rem]"}`}>
          {title}
        </h1>
        <p className={`max-w-2xl text-body-secondary font-medium text-[var(--bos-text-secondary)] ${compact ? "mt-1.5 leading-6" : "mt-2.5 leading-7 sm:text-[1.02rem]"}`}>{description}</p>
      </div>

      {(primaryAction || secondaryActions) ? (
        <div className={`flex w-full flex-wrap gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end ${compact ? "flex-row" : "flex-col sm:flex-row"}`}>
          {secondaryActions}
          {primaryAction}
        </div>
      ) : null}
    </section>
  );
}
