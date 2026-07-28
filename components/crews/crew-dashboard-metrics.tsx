import { Card, CardContent } from "@/components/ui";
import type { CrewDashboardSummary } from "@/lib/crews";
import {
  BriefcaseBusiness,
  CalendarX2,
  CircleCheck,
  Gauge,
  ShieldCheck,
  UserCheck,
  Users,
  UsersRound,
} from "./crew-icons";

type CrewDashboardMetricsProps = {
  summary: CrewDashboardSummary;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewDashboardMetrics({ summary, t }: CrewDashboardMetricsProps) {
  const cards = [
    {
      key: "totalCrews",
      label: t("crews.dashboard.totalCrews"),
      value: String(summary.totalCrews),
      insight: t("crews.dashboardInsight.totalCrews", { count: summary.totalCrews }),
      icon: <Users className="h-5 w-5" />,
      iconTone: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
    },
    {
      key: "activeCrews",
      label: t("crews.dashboard.activeCrews"),
      value: String(summary.activeCrews),
      insight: t("crews.dashboardInsight.activeCrews", { count: summary.activeCrews }),
      icon: <UserCheck className="h-5 w-5" />,
      iconTone: "bg-[var(--color-success-50)] text-[var(--color-success-700)]",
    },
    {
      key: "availableCrews",
      label: t("crews.dashboard.availableCrews"),
      value: String(summary.availableCrews),
      insight: t("crews.dashboardInsight.availableCrews", { count: summary.availableCrews }),
      icon: <CircleCheck className="h-5 w-5" />,
      iconTone: "bg-[var(--color-info-50)] text-[var(--color-info-700)]",
    },
    {
      key: "assignedCrews",
      label: t("crews.dashboard.assignedCrews"),
      value: String(summary.assignedCrews),
      insight: t("crews.dashboardInsight.assignedCrews", { count: summary.assignedCrews }),
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      iconTone: "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]",
    },
    {
      key: "averageCrewSize",
      label: t("crews.dashboard.averageCrewSize"),
      value: String(summary.averageCrewSize),
      insight: t("crews.dashboardInsight.averageCrewSize", { count: summary.averageCrewSize }),
      icon: <UsersRound className="h-5 w-5" />,
      iconTone: "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]",
    },
    {
      key: "utilization",
      label: t("crews.dashboard.crewUtilization"),
      value: `${summary.utilization}%`,
      insight: t("crews.dashboardInsight.utilization", { count: summary.utilization }),
      icon: <Gauge className="h-5 w-5" />,
      iconTone: "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]",
    },
    {
      key: "certificationCompliance",
      label: t("crews.dashboard.certificationCompliance"),
      value: `${summary.certificationCompliance}%`,
      insight: t("crews.dashboardInsight.certificationCompliance", { count: summary.certificationCompliance }),
      icon: <ShieldCheck className="h-5 w-5" />,
      iconTone: "bg-[var(--color-success-50)] text-[var(--color-success-700)]",
    },
    {
      key: "schedulingConflicts",
      label: t("crews.dashboard.schedulingConflicts"),
      value: String(summary.schedulingConflicts),
      insight: t("crews.dashboardInsight.schedulingConflicts", { count: summary.schedulingConflicts }),
      icon: <CalendarX2 className="h-5 w-5" />,
      iconTone: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]",
    },
  ];

  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("crews.dashboard.title")}>
      {cards.map((item) => (
        <Card key={item.key} variant="kpi" className="h-full !bg-[var(--color-surface-card)]">
          <CardContent className="flex h-full min-h-[176px] flex-col justify-between p-6">
            <div className="flex items-start justify-between gap-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] ${item.iconTone}`}>
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
