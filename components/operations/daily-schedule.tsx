import { useMemo, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ScheduleEvent } from "@/lib/operations";

type DailyScheduleProps = {
  items: ScheduleEvent[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DailySchedule({ items, t }: DailyScheduleProps) {
  const [view, setView] = useState<"daily" | "weekly">("daily");

  const grouped = useMemo(() => {
    const source = view === "daily" ? items : [...items, ...items.map((item) => ({ ...item, id: `${item.id}-w` }))];

    return {
      morning: source.filter((item) => item.period === "morning"),
      midday: source.filter((item) => item.period === "midday"),
      afternoon: source.filter((item) => item.period === "afternoon"),
      evening: source.filter((item) => item.period === "evening"),
    };
  }, [items, view]);

  return (
    <Card as="section">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle>{t("operations.sections.schedule")}</CardTitle>
        <div className="inline-flex rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1">
          <button
            type="button"
            onClick={() => setView("daily")}
            className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold ${view === "daily" ? "bg-[var(--color-brand-600)] text-white" : "text-[var(--color-text-secondary)]"}`}
          >
            {t("operations.schedule.daily")}
          </button>
          <button
            type="button"
            onClick={() => setView("weekly")}
            className={`rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold ${view === "weekly" ? "bg-[var(--color-brand-600)] text-white" : "text-[var(--color-text-secondary)]"}`}
          >
            {t("operations.schedule.weekly")}
          </button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-2">
        <Period title={t("operations.schedule.morning")} items={grouped.morning} t={t} />
        <Period title={t("operations.schedule.midday")} items={grouped.midday} t={t} />
        <Period title={t("operations.schedule.afternoon")} items={grouped.afternoon} t={t} />
        <Period title={t("operations.schedule.evening")} items={grouped.evening} t={t} />
      </CardContent>
    </Card>
  );
}

function Period({ title, items, t }: { title: string; items: ScheduleEvent[]; t: (key: string) => string }) {
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{t("operations.empty.schedule")}</p>
        ) : (
          items.map((item) => (
            <article key={item.id} className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.time} · {item.activity}</p>
                  <p className="mt-1 text-xs font-medium text-[var(--color-text-secondary)]">
                    {item.project} · {item.assignedCrew} · {item.owner}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={statusTone(item.status)}>{t(`operations.scheduleStatus.${item.status}`)}</Badge>
                  <Badge tone={priorityTone(item.priority)}>{t(`operations.priority.${item.priority}`)}</Badge>
                </div>
              </div>
              {item.hasConflict ? (
                <p className="mt-2 text-xs font-semibold text-[var(--color-warning-700)]">{t("operations.schedule.conflict")}</p>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function statusTone(status: ScheduleEvent["status"]) {
  if (status === "complete") {
    return "success";
  }

  if (status === "in_progress" || status === "upcoming") {
    return "info";
  }

  if (status === "at_risk" || status === "delayed") {
    return "warning";
  }

  return "neutral";
}

function priorityTone(priority: ScheduleEvent["priority"]) {
  if (priority === "critical") {
    return "danger";
  }

  if (priority === "high") {
    return "warning";
  }

  if (priority === "medium") {
    return "info";
  }

  return "neutral";
}
