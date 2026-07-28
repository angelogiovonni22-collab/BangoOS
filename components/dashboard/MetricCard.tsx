import Link from "next/link";
import { Card, CardContent, SkeletonLoader } from "@/components/ui";
import type { DashboardMetric, TrendDirection } from "@/lib/dashboard/types";

type MetricCardProps = {
  metric: DashboardMetric;
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
      <Card className="h-full">
        <CardContent className="space-y-4 p-5">
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
    <Card
      className="h-full motion-hover-card dashboard-fade-in"
      style={{ animationDelay: `${animateIndex * 50}ms` }}
    >
      <Link
        href={metric.href}
        className="block h-full rounded-[var(--radius-2xl)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        aria-label={title}
      >
        <CardContent className="flex h-full min-h-[170px] flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-brand-50)] text-sm font-bold text-[var(--color-brand-700)]">
              {metric.icon}
            </span>
            <div className="flex flex-col items-end gap-1">
              {trendLabel ? <TrendPill direction={metric.trendDirection || "flat"} label={trendLabel} /> : null}
              {typeof metric.trendPercent === "number" ? <TrendPercent value={metric.trendPercent} /> : null}
            </div>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-muted)]" title={tooltip}>{title}</p>
            <p className="text-3xl font-semibold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
              {isEmpty ? emptyLabel : valueLabel}
            </p>
            {subtitle ? (
              <p className="text-sm text-[var(--color-text-secondary)]">{subtitle}</p>
            ) : null}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}

function TrendPill({ direction, label }: { direction: TrendDirection; label: string }) {
  const tone = direction === "up"
    ? "bg-[var(--color-success-50)] text-[var(--color-success-700)] ring-[var(--color-success-500)]/20"
    : direction === "down"
      ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)] ring-[var(--color-warning-500)]/20"
      : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] ring-[var(--color-border-subtle)]";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${tone}`}>{label}</span>;
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
