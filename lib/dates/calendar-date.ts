/** Calendar dates follow the caller's local time zone, without UTC date shifts. */
export function localCalendarDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function addCalendarDays(date: string, days: number): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const value = new Date(`${date}T12:00:00`);
  if (!Number.isFinite(value.getTime())) return "";
  value.setDate(value.getDate() + days);
  return localCalendarDate(value);
}

export function currentWeekMonday(date = new Date()): string {
  const monday = new Date(date);
  const day = monday.getDay();
  monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));
  return localCalendarDate(monday);
}
