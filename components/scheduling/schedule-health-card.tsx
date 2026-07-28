import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ScheduleHealth } from "@/lib/scheduling";

type ScheduleHealthCardProps = {
  health: ScheduleHealth;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ScheduleHealthCard({ health, t }: ScheduleHealthCardProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("scheduling.health.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <p className="text-4xl font-bold tracking-tight text-[var(--color-text-primary)]">{health.score}</p>
          <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{health.statusLabel}</p>
        </div>

        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{t("scheduling.health.mockNote")}</p>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Metric label={t("scheduling.health.unresolvedConflicts")} value={health.breakdown.unresolvedConflicts} />
          <Metric label={t("scheduling.health.openShifts")} value={health.breakdown.openShifts} />
          <Metric label={t("scheduling.health.overtimeRisks")} value={health.breakdown.overtimeRisks} />
          <Metric label={t("scheduling.health.travelConflicts")} value={health.breakdown.travelConflicts} />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
      <p className="text-xs font-semibold text-[var(--color-text-secondary)]">{label}</p>
      <p className="text-lg font-semibold text-[var(--color-text-primary)]">{value}</p>
    </div>
  );
}
