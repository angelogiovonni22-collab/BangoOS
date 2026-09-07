import { SummaryCard } from "@/components/ui";
import type { EmployeeDashboardSummary } from "@/lib/employees";
import { useI18n } from "@/lib/i18n/provider";
import {
  BriefcaseIcon,
  CircleCheckIcon,
  UserCheckIcon,
  UsersIcon,
  BedDoubleIcon,
} from "./employee-icons";

type EmployeeDashboardMetricsProps = {
  summary: EmployeeDashboardSummary;
  employmentStatus: string;
  availabilityStatus: string;
  onShowAll: () => void;
  onAvailabilityChange: (value: "all" | "available" | "assigned") => void;
  onEmploymentStatusChange: (value: "all" | "leave") => void;
  workforceLabel: string;
  projectLabel: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeDashboardMetrics({
  summary,
  employmentStatus,
  availabilityStatus,
  onShowAll,
  onAvailabilityChange,
  onEmploymentStatusChange,
  workforceLabel,
  projectLabel,
  t,
}: EmployeeDashboardMetricsProps) {
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;

  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5" aria-label={`${workforceLabel} ${l("summary", "resumen")}`}>
      <SummaryCard
        icon={<UsersIcon className="h-5 w-5" />}
        label={l("Total Team Members", "Miembros totales del equipo")}
        value={String(summary.totalEmployees)}
        context={`${summary.totalEmployees} ${l("team members in", "miembros del equipo en")} ${workforceLabel.toLowerCase()}`}
        tone="brand"
        onClick={onShowAll}
        selected={employmentStatus === "all" && availabilityStatus === "all"}
        actionLabel={l("Show all team members", "Mostrar todos los miembros del equipo")}
      />
      <SummaryCard
        icon={<UserCheckIcon className="h-5 w-5" />}
        label={t("employees.dashboard.activeToday")}
        value={String(summary.activeToday)}
        context={t("employees.dashboardInsight.activeToday", { count: summary.activeToday })}
        tone="success"
      />
      <SummaryCard
        icon={<CircleCheckIcon className="h-5 w-5" />}
        label={t("employees.dashboard.available")}
        value={String(summary.available)}
        context={t("employees.dashboardInsight.available", { count: summary.available })}
        tone="info"
        onClick={() => onAvailabilityChange(availabilityStatus === "available" ? "all" : "available")}
        selected={availabilityStatus === "available"}
        actionLabel={l("Show available team members", "Mostrar miembros del equipo disponibles")}
      />
      <SummaryCard
        icon={<BriefcaseIcon className="h-5 w-5" />}
        label={`${l("Assigned to", "Asignados a")} ${projectLabel}`}
        value={String(summary.assignedToProjects)}
        context={t("employees.dashboardInsight.assigned", { count: summary.assignedToProjects })}
        tone="warning"
        onClick={() => onAvailabilityChange(availabilityStatus === "assigned" ? "all" : "assigned")}
        selected={availabilityStatus === "assigned"}
        actionLabel={`${l("Show team members assigned to", "Mostrar miembros del equipo asignados a")} ${projectLabel.toLowerCase()}`}
      />
      <SummaryCard
        icon={<BedDoubleIcon className="h-5 w-5" />}
        label={t("employees.dashboard.onLeave")}
        value={String(summary.onLeave)}
        context={t("employees.dashboardInsight.onLeave", { count: summary.onLeave })}
        tone="danger"
        onClick={() => onEmploymentStatusChange(employmentStatus === "leave" ? "all" : "leave")}
        selected={employmentStatus === "leave"}
        actionLabel={l("Show team members on leave", "Mostrar miembros del equipo con permiso")}
      />
    </section>
  );
}
