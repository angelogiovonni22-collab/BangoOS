import Link from "next/link";
import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { ScheduleEvent } from "@/lib/dashboard/types";

type ScheduleWidgetProps = {
  events: ScheduleEvent[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ScheduleWidget({ events, t }: ScheduleWidgetProps) {
  const grouped = useMemo(() => {
    const buckets: Record<"morning" | "afternoon" | "evening", ScheduleEvent[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    events.forEach((event) => {
      buckets[event.period].push(event);
    });

    return buckets;
  }, [events]);

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.todaySchedule")}</CardTitle>
        <CardDescription>{t("dashboard.todayScheduleDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {events.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.scheduleEmpty")}
          </p>
        ) : (
          <div className="space-y-5">
            <ScheduleGroup title={t("dashboard.scheduleMorning")} events={grouped.morning} t={t} />
            <ScheduleGroup title={t("dashboard.scheduleAfternoon")} events={grouped.afternoon} t={t} />
            <ScheduleGroup title={t("dashboard.scheduleEvening")} events={grouped.evening} t={t} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleGroup({
  title,
  events,
  t,
}: {
  title: string;
  events: ScheduleEvent[];
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{title}</h3>

      {events.map((event) => (
        <Link
          key={event.id}
          href={event.href}
          className="block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t(event.titleKey)}</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{event.projectName}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                <span>{event.location}</span>
                <span>•</span>
                <span>{t("dashboard.scheduleEmployees", { count: event.employeesAssigned })}</span>
                <span>•</span>
                <span>{t(scheduleStatusLabelKey(event.status))}</span>
              </div>
            </div>

            <span className="text-sm font-medium text-[var(--color-text-secondary)]">{event.timeLabel}</span>
          </div>
        </Link>
      ))}
    </section>
  );
}

function scheduleStatusLabelKey(status: ScheduleEvent["status"]) {
  if (status === "confirmed") {
    return "dashboard.scheduleStatusConfirmed";
  }

  if (status === "pending") {
    return "dashboard.scheduleStatusPending";
  }

  if (status === "travel") {
    return "dashboard.scheduleStatusTravel";
  }

  return "dashboard.scheduleStatusComplete";
}
