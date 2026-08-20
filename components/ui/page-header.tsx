import type { ReactNode } from "react";

type PageHeaderProps = { eyebrow?: string; title: string; description: string; primaryAction?: ReactNode; secondaryActions?: ReactNode; compact?: boolean };

export function PageHeader({ eyebrow = "B.O.S.", title, description, primaryAction, secondaryActions, compact = false }: PageHeaderProps) {
  return (
    <section data-bos-page-header="true" data-bos-surface="light" className={`relative flex min-w-0 flex-col overflow-hidden border border-[var(--bos-border-light)] ${compact ? "gap-3.5 px-5 py-4" : "gap-5 px-5 py-5 sm:px-6 sm:py-6"} sm:flex-row sm:items-end sm:justify-between`}>
      <div className="relative z-[1] min-w-0 max-w-3xl">
        <p className="text-caption font-semibold uppercase tracking-[0.22em] text-[var(--bos-text-medium-on-light)]">{eyebrow}</p>
        <h1 className={`mt-1.5 font-bold tracking-tight text-[var(--bos-text-strong-on-light)] ${compact ? "text-h2 sm:text-[2rem]" : "text-h1 sm:text-[2.45rem]"}`}>{title}</h1>
        <p className={`max-w-2xl text-body-secondary font-medium text-[var(--bos-text-medium-on-light)] ${compact ? "mt-1.5 leading-6" : "mt-2.5 leading-7 sm:text-[1.02rem]"}`}>{description}</p>
      </div>
      {(primaryAction || secondaryActions) ? <div className={`relative z-[1] flex w-full min-w-0 flex-wrap gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end ${compact ? "flex-row" : "flex-col sm:flex-row"}`}>{secondaryActions}{primaryAction}</div> : null}
    </section>
  );
}
