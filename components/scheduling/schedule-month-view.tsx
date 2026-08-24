import type { ScheduleAssignment } from "@/lib/scheduling";
import { Badge } from "@/components/ui";

type ScheduleMonthViewProps = {
  baseDate: string;
  assignments: ScheduleAssignment[];
  locale: "en" | "es";
  onSelectAssignment: (assignment: ScheduleAssignment) => void;
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

export function ScheduleMonthView({ baseDate, assignments, locale, onSelectAssignment, t }: ScheduleMonthViewProps) {
  const days = getMonthMatrix(baseDate);
  const month = new Date(`${baseDate}T00:00:00Z`).getUTCMonth();
  const formatter = new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { weekday: "short", timeZone: "UTC" });
  const weekdayLabels = days.slice(0, 7).map((day) => formatter.format(new Date(`${day}T00:00:00Z`)));

  return (
    <section className="overflow-x-auto rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 sm:p-4 shadow-[var(--shadow-card)]">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 gap-2 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          {weekdayLabels.map((label, index) => <p key={`${label}-${index}`}>{label}</p>)}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-2">
          {days.map((day) => {
            const items = assignments.filter((assignment) => assignment.date === day);
            const isOtherMonth = new Date(`${day}T00:00:00Z`).getUTCMonth() !== month;

            return (
              <article key={day} className={`min-h-[112px] rounded-[var(--radius-md)] border p-2 ${isOtherMonth ? "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] opacity-70" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"}`}>
                <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                  {new Intl.DateTimeFormat(locale === "es" ? "es-US" : "en-US", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T00:00:00Z`))}
                </p>

                <div className="mt-2 space-y-1">
                  {items.slice(0, 3).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectAssignment(item)}
                      className="block w-full truncate rounded bg-[var(--color-surface-subtle)] px-1.5 py-1 text-left text-[11px] font-medium text-[var(--color-text-primary)] transition hover:bg-[var(--color-primary-50)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)]"
                      title={`${item.title} · ${item.startTime} - ${item.endTime}`}
                    >
                      {item.title}
                    </button>
                  ))}
                  {items.length > 3 ? (
                    <Badge tone="info">{t("scheduling.month.more", { count: items.length - 3 })}</Badge>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
