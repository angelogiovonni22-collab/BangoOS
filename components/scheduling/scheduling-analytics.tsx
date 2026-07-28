import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { SchedulingAnalytics } from "@/lib/scheduling";

type SchedulingAnalyticsProps = {
  analytics: SchedulingAnalytics;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function SchedulingAnalytics({ analytics, t }: SchedulingAnalyticsProps) {
  const metrics = [
    { key: "laborUtilization", value: `${analytics.laborUtilization}%` },
    { key: "crewUtilization", value: `${analytics.crewUtilization}%` },
    { key: "idleTime", value: `${analytics.idleTimeHours}h` },
    { key: "overtimeRisk", value: String(analytics.overtimeRiskCount) },
    { key: "completion", value: `${analytics.assignmentCompletionRate}%` },
    { key: "openShiftFillRate", value: `${analytics.openShiftFillRate}%` },
    { key: "conflicts", value: String(analytics.scheduleConflictCount) },
    { key: "reassignments", value: String(analytics.averageReassignmentCount) },
    { key: "understaffing", value: String(analytics.understaffingCount) },
    { key: "overstaffing", value: String(analytics.overstaffingCount) },
    { key: "dispatchPunctuality", value: `${analytics.dispatchPunctuality}%` },
  ] as const;

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("scheduling.analytics.title")}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {metrics.map((item) => (
          <article key={item.key} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{t(`scheduling.analytics.${item.key}`)}</p>
            <p className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">{item.value}</p>
          </article>
        ))}
      </CardContent>
    </Card>
  );
}
