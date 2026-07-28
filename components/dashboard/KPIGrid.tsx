import { MetricCard } from "./MetricCard";
import type { DashboardMetric } from "@/lib/dashboard/types";

type KPIGridProps = {
  metrics: DashboardMetric[];
  isLoading?: boolean;
  isEmpty?: boolean;
  formatValue: (metric: DashboardMetric) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function KPIGrid({ metrics, isLoading = false, isEmpty = false, formatValue, t }: KPIGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6" aria-label={t("dashboard.kpiSection")}>
      {metrics.map((metric, index) => (
        <MetricCard
          key={metric.id}
          metric={metric}
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
    </section>
  );
}
