export type WorkforceClockEntry = { id: string; startedAt: string; endedAt: string | null; breakMinutes: number; status: string };

export function parseWorkforceClockEntry(value: unknown): WorkforceClockEntry | null {
  if (!value || typeof value !== "object") return null;
  const candidate = Array.isArray(value) && value.length === 1 ? value[0] : value;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const row = candidate as Record<string, unknown>;
  const startedAt = typeof row.started_at === "string" ? row.started_at : "";
  const endedAt = row.ended_at === null ? null : typeof row.ended_at === "string" ? row.ended_at : "";
  const breakMinutes = Number(row.break_minutes ?? 0);
  if (typeof row.id !== "string" || typeof row.status !== "string" || !Number.isFinite(Date.parse(startedAt))
    || (endedAt !== null && !Number.isFinite(Date.parse(endedAt))) || !Number.isInteger(breakMinutes) || breakMinutes < 0
    || (endedAt === null && row.status !== "open")) return null;
  return { id: row.id, startedAt, endedAt, breakMinutes, status: row.status };
}

export function workforceWorkedSeconds(entry: WorkforceClockEntry, now: number): number {
  const end = entry.endedAt ? Date.parse(entry.endedAt) : now;
  return Math.max(0, Math.floor((end - Date.parse(entry.startedAt)) / 1000) - entry.breakMinutes * 60);
}

export function formatWorkforceDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  return [Math.floor(total / 3600), Math.floor(total / 60) % 60, total % 60].map(value => String(value).padStart(2, "0")).join(":");
}

export function workforceLocationFailure(code?: number): string {
  if (code === 1) return "Location access was denied or blocked. Time was saved without location.";
  if (code === 2) return "Your device could not determine its location. Time was saved without location.";
  if (code === 3) return "The location request timed out. Time was saved without location.";
  return "Location is unavailable in this browser. Time was saved without location.";
}
