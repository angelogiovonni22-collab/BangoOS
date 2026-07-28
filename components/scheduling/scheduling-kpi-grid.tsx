import { Badge, Card, CardContent } from "@/components/ui";
import type { SchedulingPayload } from "@/lib/scheduling";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Gauge,
  TriangleAlert,
  UserCheck,
  Users,
} from "./scheduling-icons";

type SchedulingKpiGridProps = {
  items: SchedulingPayload["summary"]["kpis"];
  onDrillDown: (metricId: SchedulingPayload["summary"]["kpis"][number]["id"]) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const iconMap: Record<SchedulingPayload["summary"]["kpis"][number]["id"], React.ReactNode> = {
  employeesScheduled: <UserCheck className="h-5 w-5" />,
  crewsAssigned: <Users className="h-5 w-5" />,
  availableEmployees: <CheckCircle2 className="h-5 w-5" />,
  availableCrews: <CheckCircle2 className="h-5 w-5" />,
  openShifts: <CalendarClock className="h-5 w-5" />,
  conflicts: <AlertTriangle className="h-5 w-5" />,
  overtimeRisk: <TriangleAlert className="h-5 w-5" />,
  understaffedProjects: <AlertTriangle className="h-5 w-5" />,
  overstaffedProjects: <Activity className="h-5 w-5" />,
  scheduleHealth: <Gauge className="h-5 w-5" />,
};

export function SchedulingKpiGrid({ items, onDrillDown, t }: SchedulingKpiGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" aria-label={t("scheduling.kpi.section") }>
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onDrillDown(item.id)}
          className="text-left focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        >
          <Card variant="kpi" className="h-full">
            <CardContent className="flex min-h-[176px] flex-col justify-between p-5">
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] ${tone(item.status)}`}>
                  {iconMap[item.id]}
                </span>
                <Badge tone={item.status === "risk" ? "danger" : item.status === "watch" ? "warning" : "success"}>
                  {t(`scheduling.kpiStatus.${item.status}`)}
                </Badge>
              </div>

              <div>
                <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{t(item.labelKey)}</p>
                <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{item.value}</p>
                <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t(item.insightKey)}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--color-text-secondary)]">{t(item.trendKey)}</p>
              </div>
            </CardContent>
          </Card>
        </button>
      ))}
    </section>
  );
}

function tone(status: "good" | "watch" | "risk") {
  if (status === "good") {
    return "bg-[var(--color-success-50)] text-[var(--color-success-700)]";
  }

  if (status === "watch") {
    return "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]";
  }

  return "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]";
}
