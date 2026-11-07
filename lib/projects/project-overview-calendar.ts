import { scheduleClock } from "../scheduling/time-zone";

function dateNumber(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const number = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(number) && new Date(number).toISOString().slice(0, 10) === value ? number : null;
}

export function projectCalendarDay(now: Date, timeZone: string | null): string | null {
  if (!timeZone || !Number.isFinite(now.getTime())) return null;
  try { return scheduleClock(now.toISOString(), timeZone).date; } catch { return null; }
}

export function projectScheduleSummary(input: {
  targetDate: string | null; today: string | null; status: string;
  hasPlannedWork: boolean; hasOpenItems: boolean;
}) {
  const target = input.targetDate ? dateNumber(input.targetDate) : null;
  const today = input.today ? dateNumber(input.today) : null;
  const daysRemaining = target !== null && today !== null ? Math.round((target - today) / 86400000) : null;
  const closed = ["completed", "cancelled", "canceled"].includes(input.status.toLowerCase());
  const overdueDays = !closed && daysRemaining !== null && daysRemaining < 0 ? -daysRemaining : 0;
  const health = closed ? (input.status.toLowerCase() === "completed" ? "Completed" : "Cancelled")
    : today === null ? "Calendar unavailable"
      : overdueDays ? "Overdue"
        : !input.hasPlannedWork ? "Not Scheduled"
          : target === null ? "Needs Setup"
            : input.hasOpenItems ? "Needs Attention" : "On Track";
  const detail = health === "Overdue" ? `${overdueDays} day${overdueDays === 1 ? "" : "s"} past target completion`
    : health === "Calendar unavailable" ? "Company calendar could not be loaded"
      : health === "Not Scheduled" ? "No workforce or task schedule established"
        : health === "Needs Setup" ? "Target completion date is missing or invalid"
          : health === "Needs Attention" ? "Review open items"
            : closed ? "Project is no longer in the active schedule" : "No current schedule alerts";
  return { daysRemaining, overdueDays, health, detail };
}

/** Company-local calendar overlap; an assignment ending at midnight excludes the next day. */
export function projectAssignmentsOnDay<T extends { starts_at: string; ends_at: string; status: string }>(assignments: T[], today: string | null, timeZone: string | null): T[] {
  if (!today || dateNumber(today) === null || !timeZone) return [];
  return assignments.filter((row) => {
    if (["completed", "cancelled", "canceled"].includes(row.status.toLowerCase())) return false;
    const start = Date.parse(row.starts_at), end = Date.parse(row.ends_at);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return false;
    const first = projectCalendarDay(new Date(start), timeZone);
    const last = projectCalendarDay(new Date(end - 1), timeZone);
    return Boolean(first && last && first <= today && last >= today);
  });
}
