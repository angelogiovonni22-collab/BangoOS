"use client";

import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";
import { useI18n } from "@/lib/i18n/provider";
import { translateLiteral } from "@/lib/i18n/literal";

type TableContainerProps = { title: string; description?: string; controls?: ReactNode; children: ReactNode };

export function TableContainer({ title, description, controls, children }: TableContainerProps) {
  const { locale } = useI18n();
  const localizedTitle = translateLiteral(locale, title);
  const localizedDescription = description ? translateLiteral(locale, description) : undefined;

  return (
    <Card as="section" variant="elevated" className="overflow-hidden border-[var(--color-border-subtle)]">
      <CardHeader className="relative overflow-hidden bg-[var(--color-surface-subtle)] px-[var(--space-card-padding)] py-4">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[var(--color-primary-500)] via-[var(--color-info-500)] to-[var(--color-success-500)]" />
        <div className="relative space-y-[var(--space-grid-gap)]">
          <div className="min-w-0 max-w-3xl">
            <CardTitle className="text-[var(--bos-text-strong-on-light)]">{localizedTitle}</CardTitle>
            {localizedDescription ? <CardDescription className="text-[var(--bos-text-medium-on-light)]">{localizedDescription}</CardDescription> : null}
          </div>
          {controls ? <div className="w-full min-w-0">{controls}</div> : null}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}
