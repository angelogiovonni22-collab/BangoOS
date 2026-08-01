import Link from "next/link";
import { CountUp, StatusPulse } from "@/components/motion";
import { Card, CardContent, MetricTrend, SkeletonLoader } from "@/components/ui";
import type { DashboardMetric } from "@/lib/dashboard/types";

type MetricCardProps = {
  metric: DashboardMetric;
  localeTag: string;
  valueLabel: string;
  title: string;
  tooltip: string;
  subtitle?: string;
  trendLabel?: string;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel: string;
  animateIndex?: number;
};

export function MetricCard({
  metric,
  localeTag,
  valueLabel,
  title,
  tooltip,
  subtitle,
  trendLabel,
  isLoading = false,
  isEmpty = false,
  emptyLabel,
  animateIndex = 0,
}: MetricCardProps) {
  if (isLoading) {
    return (
      <Card variant="kpi" className="h-full">
        <CardContent className="space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <SkeletonLoader className="h-10 w-10 rounded-[var(--radius-lg)]" />
            <SkeletonLoader className="h-5 w-24 rounded-full" />
          </div>
          <SkeletonLoader className="h-5 w-28" />
          <SkeletonLoader className="h-9 w-32" />
          <SkeletonLoader className="h-4 w-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <StatusPulse triggerKey={`${metric.id}-${metric.value}`} tone={metric.trendDirection === "down" ? "warning" : "neutral"}>
      <Card
        variant="kpi"
        className="h-full motion-hover-card"
        style={{ animationDelay: `${animateIndex * 50}ms` }}
      >
        <Link
          href={metric.href}
          className="block h-full rounded-[var(--radius-xl)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
          aria-label={title}
        >
          <CardContent className="flex h-full min-h-[156px] flex-col justify-between p-4">
            <div className="flex items-start justify-between gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-primary-50)] text-sm font-bold text-[var(--color-brand-700)] shadow-[var(--shadow-small)]">
                {metric.icon}
              </span>
              {trendLabel || typeof metric.trendPercent === "number" ? (
                <div className="flex flex-col items-end gap-1">
                  {trendLabel ? (
                    <MetricTrend
                      direction={metric.trendDirection || "flat"}
                      label={trendLabel}
                      comparison={subtitle}
                    />
                  ) : null}
                  {typeof metric.trendPercent === "number" ? <TrendPercent value={metric.trendPercent} /> : null}
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-1.5">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]" title={tooltip}>{title}</p>
              <p className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
                {isEmpty ? emptyLabel : <MetricValue metric={metric} localeTag={localeTag} fallback={valueLabel} />}
              </p>
              {subtitle ? <p className="text-xs text-[var(--color-text-secondary)]">{subtitle}</p> : null}
            </div>
          </CardContent>
        </Link>
      </Card>
    </StatusPulse>
  );
}

function MetricValue({ metric, localeTag, fallback }: { metric: DashboardMetric; localeTag: string; fallback: string }) {
  if (metric.displayValueKey) {
    return fallback;
  }

  if (metric.valueKind === "currency") {
    return (
      <CountUp
        value={metric.value}
        durationMs={260}
        formatter={(value) => new Intl.NumberFormat(localeTag, {
          style: "currency",
          currency: "USD",
          maximumFractionDigits: 0,
        }).format(value)}
      />
    );
  }

  if (metric.valueKind === "score") {
    return (
      <>
        <CountUp value={metric.value} durationMs={260} />/100
      </>
    );
  }

  if (metric.valueKind === "number") {
    return (
      <CountUp
        value={metric.value}
        durationMs={260}
        formatter={(value) => new Intl.NumberFormat(localeTag).format(value)}
      />
    );
  }

  return fallback;
}

function TrendPercent({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const prefix = isPositive ? "+" : "";

  const tone = isPositive
    ? "text-[var(--color-success-700)]"
    : isNegative
      ? "text-[var(--color-danger-700)]"
      : "text-[var(--color-text-muted)]";

  const indicator = isPositive ? "▲" : isNegative ? "▼" : "•";

  return (
    <span className={`text-xs font-semibold ${tone}`}>
      {indicator} {prefix}{value.toFixed(1)}%
    </span>
  );
}
