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
  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5" aria-label={`${workforceLabel} summary`}>
      <SummaryCard
        icon={<UsersIcon className="h-5 w-5" />}
        label="Total Team Members"
        value={String(summary.totalEmployees)}
        context={`${summary.totalEmployees} team members in ${workforceLabel.toLowerCase()}`}
        tone="brand"
        onClick={onShowAll}
        selected={employmentStatus === "all" && availabilityStatus === "all"}
        actionLabel="Show all team members"
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
        actionLabel="Show available team members"
      />
      <SummaryCard
        icon={<BriefcaseIcon className="h-5 w-5" />}
        label={`Assigned to ${projectLabel}`}
        value={String(summary.assignedToProjects)}
        context={t("employees.dashboardInsight.assigned", { count: summary.assignedToProjects })}
        tone="warning"
        onClick={() => onAvailabilityChange(availabilityStatus === "assigned" ? "all" : "assigned")}
        selected={availabilityStatus === "assigned"}
        actionLabel={`Show team members assigned to ${projectLabel.toLowerCase()} work`}
      />
      <SummaryCard
        icon={<BedDoubleIcon className="h-5 w-5" />}
        label={t("employees.dashboard.onLeave")}
        value={String(summary.onLeave)}
        context={t("employees.dashboardInsight.onLeave", { count: summary.onLeave })}
        tone="danger"
        onClick={() => onEmploymentStatusChange(employmentStatus === "leave" ? "all" : "leave")}
        selected={employmentStatus === "leave"}
        actionLabel="Show team members on leave"
      />
    </section>
  );
}
