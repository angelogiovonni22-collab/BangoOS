import Link from "next/link";
import { AnimatedProgress, CountUp, StatusPulse } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { buildProjectPulseKey } from "@/lib/dashboard/motion-helpers";
import type { ProjectHealthSummary } from "@/lib/dashboard/types";

type ProjectHealthProps = {
  summary: ProjectHealthSummary;
  errorMessage?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectHealth({ summary, errorMessage = null, t }: ProjectHealthProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.projectHealth")}</CardTitle>
        <CardDescription>{t("dashboard.projectHealthDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {errorMessage}
          </p>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <HealthRow label={t("dashboard.projectOnSchedule")} value={summary.onScheduleCount} tone="success" />
          <HealthRow label={t("dashboard.projectAtRisk")} value={summary.atRiskCount} tone="warning" />
          <HealthRow label={t("dashboard.projectBehindSchedule")} value={summary.behindScheduleCount} tone="danger" />
        </div>

        <div className="overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white">
          <div className="hidden grid-cols-[1.6fr_.8fr_1fr_1fr_1fr_1fr_1fr_.8fr] gap-2 bg-[var(--color-surface-subtle)] px-3 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)] lg:grid">
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
              <StatusPulse
                key={project.id}
                triggerKey={buildProjectPulseKey(project)}
                tone={project.riskIndicator === "high" ? "warning" : "neutral"}
              >
                <Link
                  href={project.href}
                  className="bf-selection-sync block px-3 py-3 transition hover:bg-[var(--color-surface-subtle)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
                >
                  <div className="grid gap-2 lg:grid-cols-[1.6fr_.8fr_1fr_1fr_1fr_1fr_1fr_.8fr] lg:items-center">
                    <span className="text-sm font-semibold text-[var(--color-text-primary)]">{project.projectName}</span>
                    <div className="space-y-1">
                      <span className="text-sm text-[var(--color-text-secondary)]"><CountUp value={project.healthScore} durationMs={240} /></span>
                      <AnimatedProgress value={project.healthScore} className="h-1" durationMs={210} />
                    </div>
                    <span className="text-sm text-[var(--color-text-secondary)]">{t(project.budgetStatusKey)}</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{t(project.scheduleStatusKey)}</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{project.lastPhotoUpload}</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{project.lastDailyReport === "--" ? t("dashboard.projectLastReportUnavailable") : project.lastDailyReport}</span>
                    <span className="text-sm text-[var(--color-text-secondary)]">{project.currentPhase}</span>
                    <span className={`inline-flex w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${riskPill(project.riskIndicator)}`}>
                      {t(`dashboard.risk${toTitle(project.riskIndicator)}`)}
                    </span>
                  </div>
                </Link>
              </StatusPulse>
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
    <div className="flex items-center justify-between rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3 shadow-[var(--shadow-small)]">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${toneClass}`} aria-hidden="true" />
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{label}</span>
      </div>
      <span className="text-base font-semibold text-[var(--color-text-primary)]"><CountUp value={value} durationMs={220} /></span>
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
