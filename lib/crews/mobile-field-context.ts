import { scheduleClock } from "../scheduling/time-zone";

export function activeFieldCrews<T extends { crewId: string; lifecycleStatus?: string }>(crews: T[]): T[] {
  return crews.filter(crew => crew.lifecycleStatus === "active");
}
export function effectiveFieldCrewId(crews: Array<{ crewId: string }>, selectedId: string): string {
  return crews.find(crew => crew.crewId === selectedId)?.crewId || crews[0]?.crewId || "";
}
export function mobileReportDate(timeZone: string | null, selectedDate: string, now = new Date()): string {
  if (selectedDate) return selectedDate;
  return timeZone ? scheduleClock(now.toISOString(), timeZone).date : "";
}
