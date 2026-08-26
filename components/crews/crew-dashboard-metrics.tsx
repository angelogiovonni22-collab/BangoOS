import { Card, CardContent } from "@/components/ui";
import type { CrewDashboardSummary, CrewQuickFilter } from "@/lib/crews";
import {
  BriefcaseBusiness,
  CircleCheck,
  UserCheck,
  Users,
} from "./crew-icons";

type CrewDashboardMetricsProps = {
  summary: CrewDashboardSummary;
  selected: CrewQuickFilter;
  onSelect: (filter: CrewQuickFilter) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function CrewDashboardMetrics({ summary, selected, onSelect, t }: CrewDashboardMetricsProps) {
  const cards: Array<{
    key: CrewQuickFilter;
    label: string;
    value: string;
    insight: string;
    icon: React.ReactNode;
    iconTone: string;
  }> = [
    {
      key: "all",
      label: t("crews.dashboard.totalCrews"),
      value: String(summary.totalCrews),
      insight: t("crews.dashboardInsight.totalCrews", { count: summary.totalCrews }),
      icon: <Users className="h-5 w-5" />,
      iconTone: "bg-[var(--color-primary-600)] text-white",
    },
    {
      key: "active",
      label: t("crews.dashboard.activeCrews"),
      value: String(summary.activeCrews),
      insight: t("crews.dashboardInsight.activeCrews", { count: summary.activeCrews }),
      icon: <UserCheck className="h-5 w-5" />,
      iconTone: "bg-[var(--color-success-500)] text-white",
    },
    {
      key: "available",
      label: t("crews.dashboard.availableCrews"),
      value: String(summary.availableCrews),
      insight: t("crews.dashboardInsight.availableCrews", { count: summary.availableCrews }),
      icon: <CircleCheck className="h-5 w-5" />,
      iconTone: "bg-[var(--color-info-500)] text-white",
    },
    {
      key: "assigned",
      label: t("crews.dashboard.assignedCrews"),
      value: String(summary.assignedCrews),
      insight: t("crews.dashboardInsight.assignedCrews", { count: summary.assignedCrews }),
      icon: <BriefcaseBusiness className="h-5 w-5" />,
      iconTone: "bg-[var(--color-warning-500)] text-white",
    },
  ];

  return (
    <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("crews.dashboard.title")}>
      {cards.map((item) => {
        const isSelected = selected === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.key)}
            aria-pressed={isSelected}
            className="h-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)] focus-visible:ring-offset-2"
          >
            <Card
              variant="kpi"
              className={`h-full !bg-[var(--color-surface-card)] transition duration-150 hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)] ${isSelected ? "ring-2 ring-[var(--color-brand-500)]" : ""}`}
            >
              <CardContent className="flex h-full min-h-[176px] flex-col justify-between p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-full shadow-[var(--shadow-small)] [&>svg]:stroke-[2.5] ${item.iconTone}`}>
                    {item.icon}
                  </div>
                  {isSelected ? (
                    <span className="rounded-full bg-[var(--color-brand-50)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-700)]">Selected</span>
                  ) : null}
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
          </button>
        );
      })}
    </section>
  );
}
