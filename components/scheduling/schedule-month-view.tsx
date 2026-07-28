import type { ScheduleAssignment } from "@/lib/scheduling";
import { Badge } from "@/components/ui";

type ScheduleMonthViewProps = {
  baseDate: string;
  assignments: ScheduleAssignment[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

function getMonthMatrix(baseDate: string) {
  const base = new Date(`${baseDate}T00:00:00Z`);
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const startDay = first.getUTCDay();
  const offset = startDay === 0 ? -6 : 1 - startDay;
  const cursor = new Date(first);
  cursor.setUTCDate(first.getUTCDate() + offset);

  return Array.from({ length: 42 }, (_, idx) => {
    const value = new Date(cursor);
    value.setUTCDate(cursor.getUTCDate() + idx);
    return value.toISOString().slice(0, 10);
  });
}

export function ScheduleMonthView({ baseDate, assignments, t }: ScheduleMonthViewProps) {
  const days = getMonthMatrix(baseDate);
  const month = new Date(`${baseDate}T00:00:00Z`).getUTCMonth();

  return (
    <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-card)]">
      <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
        <p>Mon</p>
        <p>Tue</p>
        <p>Wed</p>
        <p>Thu</p>
        <p>Fri</p>
        <p>Sat</p>
        <p>Sun</p>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => {
          const items = assignments.filter((assignment) => assignment.date === day);
          const isOtherMonth = new Date(`${day}T00:00:00Z`).getUTCMonth() !== month;

          return (
            <article key={day} className={`min-h-[104px] rounded-[var(--radius-md)] border p-2 ${isOtherMonth ? "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] opacity-70" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"}`}>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                {new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short" }).format(new Date(`${day}T00:00:00Z`))}
              </p>

              <div className="mt-2 space-y-1">
                {items.slice(0, 3).map((item) => (
                  <p key={item.id} className="truncate rounded bg-[var(--color-surface-subtle)] px-1.5 py-1 text-[11px] font-medium text-[var(--color-text-primary)]">
                    {item.title}
                  </p>
                ))}
                {items.length > 3 ? (
                  <Badge tone="info">{t("scheduling.month.more", { count: items.length - 3 })}</Badge>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
