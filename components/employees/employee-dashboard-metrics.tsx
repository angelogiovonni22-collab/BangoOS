import { Card, CardContent } from "@/components/ui";
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
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeDashboardMetrics({ summary, t }: EmployeeDashboardMetricsProps) {
  const cards = [
    {
      key: "total",
      label: t("employees.dashboard.totalEmployees"),
      value: String(summary.totalEmployees),
      insight: t("employees.dashboardInsight.totalEmployees", { count: summary.totalEmployees }),
      icon: <UsersIcon className="h-5 w-5" />,
      iconTone: "bg-[var(--color-primary-600)] text-white",
    },
    {
      key: "active",
      label: t("employees.dashboard.activeToday"),
      value: String(summary.activeToday),
      insight: t("employees.dashboardInsight.activeToday", { count: summary.activeToday }),
      icon: <UserCheckIcon className="h-5 w-5" />,
      iconTone: "bg-[var(--color-success-500)] text-white",
    },
    {
      key: "available",
      label: t("employees.dashboard.available"),
      value: String(summary.available),
      insight: t("employees.dashboardInsight.available", { count: summary.available }),
      icon: <CircleCheckIcon className="h-5 w-5" />,
      iconTone: "bg-[var(--color-info-500)] text-white",
    },
    {
      key: "assigned",
      label: t("employees.dashboard.assignedToProjects"),
      value: String(summary.assignedToProjects),
      insight: t("employees.dashboardInsight.assigned", { count: summary.assignedToProjects }),
      icon: <BriefcaseIcon className="h-5 w-5" />,
      iconTone: "bg-[var(--color-warning-500)] text-white",
    },
    {
      key: "leave",
      label: t("employees.dashboard.onLeave"),
      value: String(summary.onLeave),
      insight: t("employees.dashboardInsight.onLeave", { count: summary.onLeave }),
      icon: <BedDoubleIcon className="h-5 w-5" />,
      iconTone: "bg-[var(--color-danger-500)] text-white",
    },
  ];

  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5" aria-label={t("employees.dashboard.title")}>
      {cards.map((item) => (
        <Card key={item.key} variant="kpi" className="h-full !bg-[var(--color-surface-card)]">
          <CardContent className="flex h-full min-h-[172px] flex-col justify-between p-6">
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-11 w-11 items-center justify-center rounded-full shadow-[var(--shadow-small)] [&>svg]:stroke-[2.5] ${item.iconTone}`}>
                {item.icon}
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{item.label}</p>
              <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-4xl">
                {item.value}
              </p>
              <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{item.insight}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </section>
  );
}
