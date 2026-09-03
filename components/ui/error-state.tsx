"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/provider";
import { translateLiteral } from "@/lib/i18n/literal";

type ErrorStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
  compact?: boolean;
};

export function ErrorState({ title, description, action, compact = false }: ErrorStateProps) {
  const { locale } = useI18n();
  const localizedTitle = translateLiteral(locale, title);
  const localizedDescription = translateLiteral(locale, description);

  return (
    <div className={`flex items-center justify-center px-[var(--space-6)] py-[var(--space-10)] ${compact ? "min-h-52" : "min-h-80"}`}>
      <div data-bos-error-state="true" className="relative w-full max-w-lg overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-panel)] px-[var(--space-6)] py-[var(--space-8)] text-center shadow-[var(--bos-card-shadow)]">
        <span aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[var(--color-danger-500)] via-[var(--color-warning-500)] to-transparent opacity-80" />
        <span aria-hidden="true" className="pointer-events-none absolute -right-14 -top-14 h-36 w-36 rounded-full bg-[var(--color-danger-100)] opacity-50 blur-3xl" />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-2xl font-bold text-[var(--color-danger-700)] shadow-[0_12px_28px_-18px_rgb(220_38_38/0.48)]">!</div>
        <h3 className="relative mt-5 text-h3 font-semibold text-[var(--bos-text-primary)]">{localizedTitle}</h3>
        <p className="relative mt-3 text-body font-medium text-[var(--bos-text-secondary)]">{localizedDescription}</p>
        {action ? <div className="relative mt-6">{action}</div> : null}
      </div>
    </div>
  );
}
