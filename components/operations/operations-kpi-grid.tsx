import type { OperationsKpi } from "@/lib/operations";
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  Camera,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Users,
  Wrench,
} from "./operations-icons";

type OperationsKpiGridProps = {
  items: OperationsKpi[];
};

const iconMap: Record<OperationsKpi["id"], React.ReactNode> = {
  activeProjects: <Wrench className="h-5 w-5" />,
  crewsWorking: <Users className="h-5 w-5" />,
  crewsAvailable: <CheckCircle2 className="h-5 w-5" />,
  employeesScheduled: <UserCheck className="h-5 w-5" />,
  employeesAvailable: <Users className="h-5 w-5" />,
  scheduleConflicts: <CalendarClock className="h-5 w-5" />,
  safetyAlerts: <ShieldAlert className="h-5 w-5" />,
  certificationRisks: <ShieldCheck className="h-5 w-5" />,
  delayedActivities: <AlertTriangle className="h-5 w-5" />,
  sitecamUpdates: <Camera className="h-5 w-5" />,
};

export function OperationsKpiGrid({ items }: OperationsKpiGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
      {items.map((item) => (
        <article
          key={item.id}
          tabIndex={0}
          className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-medium)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-large)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        >
          <div className="flex items-center justify-between gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] ${tone(item.status)}`}>
              {iconMap[item.id]}
            </div>
            <p className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--color-text-secondary)]">
              <Activity className="h-3.5 w-3.5" />
              {item.trend}
            </p>
          </div>
          <p className="mt-4 text-sm font-semibold text-[var(--color-text-secondary)]">{item.label}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">{item.value}</p>
          <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">{item.insight}</p>
        </article>
      ))}
    </section>
  );
}

function tone(status: OperationsKpi["status"]) {
  if (status === "good") {
    return "bg-[var(--color-success-50)] text-[var(--color-success-700)]";
  }

  if (status === "watch") {
    return "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]";
  }

  if (status === "critical") {
    return "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]";
  }

  return "bg-[var(--color-brand-50)] text-[var(--color-brand-700)]";
}
