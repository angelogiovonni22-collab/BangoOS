import { Card, CardContent } from "@/components/ui";
import type { DailyReportDashboardMetrics } from "@/lib/daily-reports";

type ReportDashboardMetricsProps = {
  metrics: DailyReportDashboardMetrics;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ReportDashboardMetrics({ metrics, t }: ReportDashboardMetricsProps) {
  const cards = [
    { key: "reportsCreatedToday", value: metrics.reportsCreatedToday },
    { key: "reportsPendingReview", value: metrics.reportsPendingReview },
    { key: "reportsSubmitted", value: metrics.reportsSubmitted },
    { key: "lateReports", value: metrics.lateReports },
    { key: "safetyIncidents", value: metrics.safetyIncidents },
    { key: "delaysLogged", value: metrics.delaysLogged },
    { key: "laborHours", value: metrics.laborHours },
    { key: "weatherSnapshot", value: metrics.weatherSnapshot },
  ] as const;

  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("dailyReports.dashboard.metricsSection") }>
      {cards.map((item) => (
        <Card key={item.key} variant="kpi" className="h-full">
          <CardContent className="flex min-h-[146px] flex-col justify-end p-5">
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
