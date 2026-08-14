import type { ReactNode } from "react";
import { Card, CardDescription, CardHeader, CardTitle } from "./card";

type TableContainerProps = { title: string; description?: string; controls?: ReactNode; children: ReactNode };

export function TableContainer({ title, description, controls, children }: TableContainerProps) {
  return (
    <Card as="section" variant="elevated" className="overflow-hidden border-[var(--color-border-subtle)]">
      <CardHeader className="relative overflow-hidden bg-[var(--color-surface-subtle)] px-[var(--space-card-padding)] py-4">
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[var(--color-primary-500)] via-[var(--color-info-500)] to-[var(--color-success-500)]" />
        <div className="relative flex flex-col gap-[var(--space-grid-gap)] lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-[var(--bos-text-strong-on-light)]">{title}</CardTitle>
            {description ? <CardDescription className="text-[var(--bos-text-medium-on-light)]">{description}</CardDescription> : null}
          </div>
          {controls ? <div className="w-full min-w-0 lg:w-auto lg:shrink-0">{controls}</div> : null}
        </div>
      </CardHeader>
      {children}
    </Card>
  );
}
