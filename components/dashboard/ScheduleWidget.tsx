import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { FadeIn } from "@/components/motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { collectNewDashboardIds, hasNewDashboardItems } from "@/lib/dashboard/motion-helpers";
import type { ScheduleEvent } from "@/lib/dashboard/types";

type ScheduleWidgetProps = {
  events: ScheduleEvent[];
  errorMessage?: string | null;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ScheduleWidget({ events, errorMessage = null, t }: ScheduleWidgetProps) {
  const knownEventIdsRef = useRef<Set<string>>(new Set());
  const [newScheduleEventIds, setNewScheduleEventIds] = useState<Record<string, true>>({});

  const grouped = useMemo(() => {
    const buckets: Record<"morning" | "afternoon" | "evening" | "all_day" | "time_unavailable", ScheduleEvent[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      all_day: [],
      time_unavailable: [],
    };

    events.forEach((event) => {
      buckets[event.period].push(event);
    });

    return buckets;
  }, [events]);

  useEffect(() => {
    const nextIds = events.map((event) => event.id);
    const nextNew = collectNewDashboardIds(knownEventIdsRef.current, nextIds);

    for (const eventId of nextIds) {
      knownEventIdsRef.current.add(eventId);
    }

    if (!hasNewDashboardItems(nextNew)) {
      return;
    }

    setNewScheduleEventIds(nextNew);
    const timeout = window.setTimeout(() => setNewScheduleEventIds({}), 380);
    return () => window.clearTimeout(timeout);
  }, [events]);

  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/40">
        <CardTitle>{t("dashboard.todaySchedule")}</CardTitle>
        <CardDescription>{t("dashboard.todayScheduleDescription")}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {errorMessage}
          </p>
        ) : events.length === 0 ? (
          <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-sm text-[var(--color-text-secondary)]">
            {t("dashboard.scheduleEmpty")}
          </p>
        ) : (
          <div className="space-y-5">
            <ScheduleGroup title={t("dashboard.scheduleAllDay")} events={grouped.all_day} newScheduleEventIds={newScheduleEventIds} t={t} />
            <ScheduleGroup title={t("dashboard.scheduleMorning")} events={grouped.morning} newScheduleEventIds={newScheduleEventIds} t={t} />
            <ScheduleGroup title={t("dashboard.scheduleAfternoon")} events={grouped.afternoon} newScheduleEventIds={newScheduleEventIds} t={t} />
            <ScheduleGroup title={t("dashboard.scheduleEvening")} events={grouped.evening} newScheduleEventIds={newScheduleEventIds} t={t} />
            <ScheduleGroup title={t("dashboard.scheduleTimeUnavailable")} events={grouped.time_unavailable} newScheduleEventIds={newScheduleEventIds} t={t} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ScheduleGroup({
  title,
  events,
  newScheduleEventIds,
  t,
}: {
  title: string;
  events: ScheduleEvent[];
  newScheduleEventIds: Record<string, true>;
  t: (key: string, params?: Record<string, string | number>) => string;
}) {
  if (events.length === 0) {
    return null;
  }

  return (
    <section className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--color-text-muted)]">{title}</h3>

      {events.map((event) => (
        <FadeIn key={event.id} durationMs={newScheduleEventIds[event.id] ? 170 : 0} className={newScheduleEventIds[event.id] ? "" : "bf-no-motion"}>
          <Link
            href={event.href}
            className="block rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-medium)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">{event.title ?? (event.titleKey ? t(event.titleKey) : "")}</p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{event.projectName}</p>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
                  {event.location ? <span>{event.location}</span> : null}
                  {event.location ? <span>•</span> : null}
                  <span>{t("dashboard.scheduleEmployees", { count: event.employeesAssigned })}</span>
                  <span>•</span>
                  <span>{t(scheduleStatusLabelKey(event.status))}</span>
                </div>
            </div>
              <span className="text-sm font-medium text-[var(--color-text-secondary)]">{renderTimeLabel(event.timeLabel, t)}</span>
            </div>
          </Link>
        </FadeIn>
      ))}
    </section>
  );
}

function renderTimeLabel(timeLabel: string, t: (key: string, params?: Record<string, string | number>) => string) {
  if (timeLabel === "__all_day__") {
    return t("dashboard.scheduleAllDay");
  }

  if (timeLabel === "__time_unavailable__") {
    return t("dashboard.scheduleTimeUnavailable");
  }

  return timeLabel;
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
