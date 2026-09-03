"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { translateLiteral } from "@/lib/i18n/literal";

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  secondaryAction?: ReactNode;
  compact?: boolean;
};

export function EmptyState({ icon, title, description, action, secondaryAction, compact = false }: EmptyStateProps) {
  const { locale } = useI18n();
  const localizedTitle = translateLiteral(locale, title);
  const localizedDescription = translateLiteral(locale, description);

  return (
    <div className={`flex items-center justify-center px-[var(--space-6)] py-[var(--space-8)] ${compact ? "min-h-44" : "min-h-72"}`}>
      <div data-bos-empty-state="true" className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-panel)] px-[var(--space-6)] py-7 text-center shadow-[var(--bos-card-shadow)]">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-primary-500)] via-[var(--color-info-500)] to-[var(--color-success-500)] opacity-75" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-[var(--bos-ambient-blue)] blur-3xl" />
        {icon ? <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel-elevated)] text-2xl font-bold text-[var(--orion-cyan)] shadow-[0_12px_30px_-18px_rgb(37_99_235/0.5)]">{icon}</div> : null}
        <h3 className="relative mt-4 text-h3 font-bold text-[var(--bos-text-primary)]">{localizedTitle}</h3>
        <p className="relative mt-2.5 text-body font-medium text-[var(--bos-text-secondary)]">{localizedDescription}</p>
        {action || secondaryAction ? <div className="relative mt-6 flex flex-wrap items-center justify-center gap-[var(--space-action-gap)]">{secondaryAction}{action}</div> : null}
      </div>
    </div>
  );
}
