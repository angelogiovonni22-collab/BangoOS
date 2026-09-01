import { SummaryCard } from "@/components/ui";
import type { EmployeeDashboardSummary } from "@/lib/employees";
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
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeDashboardMetrics({
  summary,
  employmentStatus,
  availabilityStatus,
  onShowAll,
  onAvailabilityChange,
  onEmploymentStatusChange,
  t,
}: EmployeeDashboardMetricsProps) {
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5" aria-label={t("employees.dashboard.title")}>
      <SummaryCard
        icon={<UsersIcon className="h-5 w-5" />}
        label={t("employees.dashboard.totalEmployees")}
        value={String(summary.totalEmployees)}
        insight={t("employees.dashboardInsight.totalEmployees", { count: summary.totalEmployees })}
        tone="brand"
        onClick={onShowAll}
        selected={employmentStatus === "all" && availabilityStatus === "all"}
        actionLabel="Show all employees"
      />
      <SummaryCard
        icon={<UserCheckIcon className="h-5 w-5" />}
        label={t("employees.dashboard.activeToday")}
        value={String(summary.activeToday)}
        insight={t("employees.dashboardInsight.activeToday", { count: summary.activeToday })}
        tone="success"
      />
      <SummaryCard
        icon={<CircleCheckIcon className="h-5 w-5" />}
        label={t("employees.dashboard.available")}
        value={String(summary.available)}
        insight={t("employees.dashboardInsight.available", { count: summary.available })}
        tone="info"
        onClick={() => onAvailabilityChange(availabilityStatus === "available" ? "all" : "available")}
        selected={availabilityStatus === "available"}
        actionLabel="Show available employees"
      />
      <SummaryCard
        icon={<BriefcaseIcon className="h-5 w-5" />}
        label={t("employees.dashboard.assignedToProjects")}
        value={String(summary.assignedToProjects)}
        insight={t("employees.dashboardInsight.assigned", { count: summary.assignedToProjects })}
        tone="warning"
        onClick={() => onAvailabilityChange(availabilityStatus === "assigned" ? "all" : "assigned")}
        selected={availabilityStatus === "assigned"}
        actionLabel="Show assigned employees"
      />
      <SummaryCard
        icon={<BedDoubleIcon className="h-5 w-5" />}
        label={t("employees.dashboard.onLeave")}
        value={String(summary.onLeave)}
        insight={t("employees.dashboardInsight.onLeave", { count: summary.onLeave })}
        tone="danger"
        onClick={() => onEmploymentStatusChange(employmentStatus === "leave" ? "all" : "leave")}
        selected={employmentStatus === "leave"}
        actionLabel="Show employees on leave"
      />
    </section>
  );
}