import { useEffect } from "react";
import { StaggerGroup } from "@/components/motion";
import { markDashboardEntranceAnimated, shouldAnimateDashboardEntranceOnce } from "@/lib/dashboard/motion-helpers";
import { MetricCard } from "./MetricCard";
import type { DashboardMetric } from "@/lib/dashboard/types";

type KPIGridProps = {
  metrics: DashboardMetric[];
  localeTag: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  errorMessage?: string | null;
  formatValue: (metric: DashboardMetric) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function KPIGrid({ metrics, localeTag, isLoading = false, isEmpty = false, errorMessage = null, formatValue, t }: KPIGridProps) {
  const animateEntrance = !isLoading
    && !isEmpty
    && metrics.length > 0
    && shouldAnimateDashboardEntranceOnce("dashboard-kpi-grid");

  useEffect(() => {
    if (!animateEntrance) {
      return;
    }

    markDashboardEntranceAnimated("dashboard-kpi-grid");
  }, [animateEntrance]);

  return (
    <section aria-label={t("dashboard.kpiSection")}>
      {errorMessage ? (
        <p className="mb-3 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 text-sm text-[var(--color-text-secondary)]">
          {errorMessage}
        </p>
      ) : null}
      <StaggerGroup
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6"
        staggerMs={26}
        distancePx={6}
        animate={animateEntrance}
      >
        {metrics.map((metric, index) => (
          <MetricCard
            key={metric.id}
            metric={metric}
            localeTag={localeTag}
            valueLabel={formatValue(metric)}
            title={t(metric.titleKey)}
            tooltip={t(metric.tooltipKey)}
            subtitle={metric.subtitleKey ? t(metric.subtitleKey) : undefined}
            trendLabel={metric.trendLabelKey ? t(metric.trendLabelKey) : undefined}
            isLoading={isLoading}
            isEmpty={isEmpty}
            emptyLabel={t("dashboard.metricEmpty")}
            animateIndex={index}
          />
        ))}
      </StaggerGroup>
    </section>
  );
}
