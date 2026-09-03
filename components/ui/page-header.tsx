"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { translateLiteral } from "@/lib/i18n/literal";

type PageHeaderProps = { eyebrow?: string; title: string; description: string; primaryAction?: ReactNode; secondaryActions?: ReactNode; compact?: boolean };

export function PageHeader({ eyebrow, title, description, primaryAction, secondaryActions, compact = false }: PageHeaderProps) {
  const { locale } = useI18n();
  const localizedEyebrow = eyebrow ? translateLiteral(locale, eyebrow) : null;
  const localizedTitle = translateLiteral(locale, title);
  const localizedDescription = translateLiteral(locale, description);

  return (
    <section data-bos-page-header="true" data-bos-surface="light" className={`relative flex min-w-0 flex-col overflow-hidden border border-[var(--bos-border-light)] ${compact ? "gap-3.5 px-5 py-4" : "gap-5 px-5 py-5 sm:px-6 sm:py-6"} sm:flex-row sm:items-end sm:justify-between`}>
      <div className="relative z-[1] min-w-0 max-w-3xl">
        {localizedEyebrow ? <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[var(--bos-text-medium-on-light)]">{localizedEyebrow}</p> : null}
        <h1 className={`font-bold tracking-tight text-[var(--bos-text-strong-on-light)] ${compact ? "text-h2 sm:text-[2rem]" : "text-h1 sm:text-[2.45rem]"}`}>{localizedTitle}</h1>
        <p className={`max-w-2xl text-body-secondary font-medium text-[var(--bos-text-medium-on-light)] ${compact ? "mt-1.5 leading-6" : "mt-2.5 leading-7 sm:text-[1.02rem]"}`}>{localizedDescription}</p>
      </div>
      {(primaryAction || secondaryActions) ? <div className={`relative z-[1] flex w-full min-w-0 flex-wrap gap-2.5 sm:w-auto sm:flex-row sm:items-center sm:justify-end ${compact ? "flex-row" : "flex-col sm:flex-row"}`}>{secondaryActions}{primaryAction}</div> : null}
    </section>
  );
}
