import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Select } from "@/components/ui";
import type { DailyProjectOperation, ProjectRiskLevel, ProjectScheduleStatus } from "@/lib/operations";
import { CalendarRange, MapPin, TriangleAlert } from "./operations-icons";

type ProjectOperationsPanelProps = {
  items: DailyProjectOperation[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectOperationsPanel({ items, t }: ProjectOperationsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<ProjectScheduleStatus | "all">("all");
  const [riskFilter, setRiskFilter] = useState<ProjectRiskLevel | "all">("all");
  const [sortBy, setSortBy] = useState<"risk" | "completion" | "manpower">("risk");
  const [compact, setCompact] = useState(false);

  const visible = useMemo(() => {
    return items
      .filter((item) => (statusFilter === "all" ? true : item.scheduleStatus === statusFilter))
      .filter((item) => (riskFilter === "all" ? true : item.riskLevel === riskFilter))
      .sort((a, b) => {
        if (sortBy === "completion") {
          return b.completionPercentage - a.completionPercentage;
        }

        if (sortBy === "manpower") {
          return (b.manpowerActual - b.manpowerPlanned) - (a.manpowerActual - a.manpowerPlanned);
        }

        return riskScore(b.riskLevel) - riskScore(a.riskLevel);
      });
  }, [items, riskFilter, sortBy, statusFilter]);

  return (
    <Card as="section">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <CardTitle>{t("operations.sections.projects")}</CardTitle>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as ProjectScheduleStatus | "all")}>
              <option value="all">{t("operations.filters.allStatus")}</option>
              <option value="on_track">{t("operations.projectStatus.on_track")}</option>
              <option value="at_risk">{t("operations.projectStatus.at_risk")}</option>
              <option value="delayed">{t("operations.projectStatus.delayed")}</option>
            </Select>
            <Select value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as ProjectRiskLevel | "all")}>
              <option value="all">{t("operations.filters.allRisk")}</option>
              <option value="high">{t("operations.risk.high")}</option>
              <option value="medium">{t("operations.risk.medium")}</option>
              <option value="low">{t("operations.risk.low")}</option>
            </Select>
            <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as "risk" | "completion" | "manpower")}>
              <option value="risk">{t("operations.filters.sortRisk")}</option>
              <option value="completion">{t("operations.filters.sortCompletion")}</option>
              <option value="manpower">{t("operations.filters.sortManpower")}</option>
            </Select>
            <button
              type="button"
              className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-subtle)]"
              onClick={() => setCompact((current) => !current)}
            >
              {compact ? t("operations.actions.expandedView") : t("operations.actions.compactView")}
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {visible.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm font-medium text-[var(--color-text-secondary)]">
            {t("operations.empty.projects")}
          </p>
        ) : (
          visible.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Link href={`/projects/${item.id}`} className="text-lg font-semibold text-[var(--color-text-primary)] hover:text-[var(--color-brand-700)]">
                    {item.projectName}
                  </Link>
                  <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-text-secondary)]">
                    <MapPin className="h-4 w-4" />
                    {item.location}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                    {t("operations.projects.pm")}: {item.projectManager} · {t("operations.projects.superintendent")}: {item.superintendent}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.scheduleStatus === "on_track" ? "success" : item.scheduleStatus === "at_risk" ? "warning" : "danger"}>
                    {t(`operations.projectStatus.${item.scheduleStatus}`)}
                  </Badge>
                  <Badge tone={item.riskLevel === "high" ? "danger" : item.riskLevel === "medium" ? "warning" : "success"}>
                    {t(`operations.risk.${item.riskLevel}`)}
                  </Badge>
                </div>
              </div>

              <div className={`mt-4 grid gap-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
                <Info label={t("operations.projects.assignedCrews")} value={item.assignedCrews.join(", ")} />
                <Info label={t("operations.projects.manpower")} value={`${item.manpowerActual}/${item.manpowerPlanned}`} />
                <Info label={t("operations.projects.keyActivity")} value={item.keyActivity} />
                <Info label={t("operations.projects.completion")} value={`${item.completionPercentage}%`} />
                {!compact ? <Info label={t("operations.projects.weather")} value={item.weatherImpact} /> : null}
                {!compact ? <Info label={t("operations.projects.sitecam")} value={item.latestSitecamActivity} /> : null}
                {!compact ? <Info label={t("operations.projects.milestone")} value={item.nextMilestone} /> : null}
                {!compact ? (
                  <Info label={t("operations.projects.scheduleHealth")} value={t(`operations.projectStatus.${item.scheduleStatus}`)} icon={<TriangleAlert className="h-4 w-4" />} />
                ) : null}
              </div>

              <p className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
                <CalendarRange className="h-3.5 w-3.5" />
                {t("operations.projects.nextMilestone")} {item.nextMilestone}
              </p>
            </article>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function Info({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
      <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
        {icon}
        <span>{value}</span>
      </p>
    </div>
  );
}

function riskScore(level: ProjectRiskLevel) {
  if (level === "high") {
    return 3;
  }

  if (level === "medium") {
    return 2;
  }

  return 1;
}
