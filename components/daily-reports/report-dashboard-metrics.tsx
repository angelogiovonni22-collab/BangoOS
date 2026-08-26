import { Card, CardContent } from "@/components/ui";
import type { DailyReportDashboardMetrics } from "@/lib/daily-reports";

type ReportDashboardMetricsProps = {
  metrics: DailyReportDashboardMetrics;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ReportDashboardMetrics({ metrics, t }: ReportDashboardMetricsProps) {
  const cards = [
    { key: "reportsCreatedToday", value: metrics.reportsCreatedToday, symbol: "#", tone: "bg-[var(--color-primary-600)]" },
    { key: "reportsPendingReview", value: metrics.reportsPendingReview, symbol: "P", tone: "bg-[var(--color-warning-500)]" },
    { key: "reportsSubmitted", value: metrics.reportsSubmitted, symbol: "S", tone: "bg-[var(--color-info-500)]" },
    { key: "lateReports", value: metrics.lateReports, symbol: "!", tone: "bg-[var(--color-danger-500)]" },
    { key: "safetyIncidents", value: metrics.safetyIncidents, symbol: "!", tone: "bg-[var(--color-danger-500)]" },
    { key: "delaysLogged", value: metrics.delaysLogged, symbol: "D", tone: "bg-[var(--color-warning-500)]" },
    { key: "laborHours", value: metrics.laborHours, symbol: "H", tone: "bg-[var(--color-success-500)]" },
    { key: "weatherSnapshot", value: metrics.weatherSnapshot, symbol: "W", tone: "bg-[var(--bos-theme-accent-secondary)]" },
  ] as const;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("dailyReports.dashboard.metricsSection") }>
      {cards.map((item) => (
        <Card key={item.key} variant="kpi" className="h-full">
          <CardContent className="flex min-h-[146px] flex-col justify-end p-5">
            <span className={`mb-auto inline-flex h-11 w-11 items-center justify-center rounded-full text-lg font-bold text-white shadow-[var(--shadow-small)] ${item.tone}`} aria-hidden="true">{item.symbol}</span>
            <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t(`dailyReports.metrics.${item.key}`)}</p>
            <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">
              {item.key === "weatherSnapshot" ? t(`dailyReports.weather.${item.value}`) : item.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
