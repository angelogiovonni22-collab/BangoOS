import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectHealthSummary } from "@/lib/dashboard/types";

type ProjectHealthProps = {
  summary: ProjectHealthSummary;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectHealth({ summary, t }: ProjectHealthProps) {
  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>{t("dashboard.projectHealth")}</CardTitle>
        <CardDescription>{t("dashboard.projectHealthDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <HealthRow label={t("dashboard.projectOnSchedule")} value={summary.onScheduleCount} tone="success" />
          <HealthRow label={t("dashboard.projectAtRisk")} value={summary.atRiskCount} tone="warning" />
          <HealthRow label={t("dashboard.projectBehindSchedule")} value={summary.behindScheduleCount} tone="danger" />
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)]">
          <div className="hidden grid-cols-[1.6fr_.8fr_1fr_1fr_1fr_1fr_1fr_.8fr] gap-2 bg-[var(--color-surface-subtle)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] lg:grid">
            <span>{t("dashboard.projectName")}</span>
            <span>{t("dashboard.projectHealthScore")}</span>
            <span>{t("dashboard.projectBudgetStatus")}</span>
            <span>{t("dashboard.projectScheduleStatus")}</span>
            <span>{t("dashboard.projectLastPhoto")}</span>
            <span>{t("dashboard.projectLastReport")}</span>
            <span>{t("dashboard.projectPhase")}</span>
            <span>{t("dashboard.projectRisk")}</span>
          </div>

          <div className="divide-y divide-[var(--color-border-subtle)] bg-white">
            {summary.projects.map((project) => (
              <Link
                key={project.id}
                href={project.href}
                className="block px-3 py-3 transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
              >
                <div className="grid gap-2 lg:grid-cols-[1.6fr_.8fr_1fr_1fr_1fr_1fr_1fr_.8fr] lg:items-center">
                  <span className="text-sm font-semibold text-[var(--color-text-primary)]">{project.projectName}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{project.healthScore}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{t(project.budgetStatusKey)}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{t(project.scheduleStatusKey)}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{project.lastPhotoUpload}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{project.lastDailyReport}</span>
                  <span className="text-sm text-[var(--color-text-secondary)]">{project.currentPhase}</span>
                  <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${riskPill(project.riskIndicator)}`}>
                    {t(`dashboard.risk${toTitle(project.riskIndicator)}`)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "danger";
}) {
  const toneClass = tone === "success"
    ? "bg-[var(--color-success-500)]"
    : tone === "warning"
      ? "bg-[var(--color-warning-500)]"
      : "bg-[var(--color-danger-500)]";

  return (
    <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${toneClass}`} aria-hidden="true" />
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <span className="text-base font-semibold text-[var(--color-text-primary)]">{value}</span>
    </div>
  );
}

function riskPill(risk: "low" | "medium" | "high") {
  if (risk === "low") {
    return "bg-[var(--color-success-50)] text-[var(--color-success-700)]";
  }

  if (risk === "medium") {
    return "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]";
  }

  return "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]";
}

function toTitle(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
