import type { ReactNode } from "react";
import { IntelligenceActivity } from "@/components/motion";

type DashboardHeaderProps = {
  title: string;
  description: string;
  companyName: string;
  currentDate: string;
  previewDataLabel?: string | null;
  isReady?: boolean;
  t?: (key: string, params?: Record<string, string | number>) => string;
  action?: ReactNode;
};

export function DashboardHeader({
  title,
  description,
  companyName,
  currentDate,
  previewDataLabel,
  isReady = true,
  t,
  action,
}: DashboardHeaderProps) {
  return (
    <section className="flex flex-col gap-5 border-b border-[var(--color-border-subtle)] pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--color-text-muted)]">
          {companyName}
        </p>
        <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2.5 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)] sm:text-base">
          {description}
        </p>
        <div className="mt-3">
          {previewDataLabel ? (
            <span className="mb-2 inline-flex items-center rounded-full border border-[var(--color-warning-100)] bg-[var(--color-warning-50)] px-2.5 py-1 text-xs font-semibold text-[var(--color-warning-700)]">
              {previewDataLabel}
            </span>
          ) : null}
          <IntelligenceActivity
            active={!isReady}
            label={t ? t("dashboard.loadingMetrics") : "Loading dashboard"}
            className="w-fit"
          />
          {isReady ? (
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--color-success-100)] bg-[var(--color-success-50)] px-2.5 py-1 text-xs font-semibold text-[var(--color-success-700)]">
              <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
              System ready
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
        {action}
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] shadow-[var(--shadow-small)]">
          {currentDate}
        </div>
      </div>
    </section>
  );
}
