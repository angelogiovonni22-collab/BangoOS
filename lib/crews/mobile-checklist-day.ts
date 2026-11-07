import { mobileReportDate } from "./mobile-field-context";
import { createEmptyChecklist, type DailyChecklist } from "./mobile-field-operations-types";

export const MOBILE_CHECKLIST_EVENT = "mobile_field.checklist.saved";

export function validChecklistDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const instant = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(instant.getTime()) && instant.toISOString().slice(0, 10) === value;
}

export function checklistMatchesDay(checklist: DailyChecklist | null | undefined, workDate: string, timeZone: string | null): boolean {
  if (!checklist || !timeZone || !validChecklistDate(workDate)) return false;
  if (checklist.workDate !== undefined) return validChecklistDate(checklist.workDate) && checklist.workDate === workDate;
  if (!checklist.updatedAt) return false;
  try {
    return mobileReportDate(timeZone, "", new Date(checklist.updatedAt)) === workDate;
  } catch {
    return false;
  }
}

export function dailyChecklistForDay(checklist: DailyChecklist | null | undefined, workDate: string, timeZone: string | null): DailyChecklist {
  if (checklist && checklistMatchesDay(checklist, workDate, timeZone)) return checklist;
  return createEmptyChecklist();
}

type ChecklistEvent = { event_type: string; payload: unknown; reference_id: string | null; occurred_at: string };
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null; }

/** Events are newest first. A replay for yesterday must not hide today's saved checklist. */
export function selectDailyChecklists(events: ChecklistEvent[], workDate: string, timeZone: string): Record<string, DailyChecklist> {
  const result: Record<string, DailyChecklist> = {};
  for (const event of events) {
    if (event.event_type !== MOBILE_CHECKLIST_EVENT || !record(event.payload)) continue;
    const crewId = typeof event.payload.crewId === "string" ? event.payload.crewId : event.reference_id;
    const raw = event.payload.checklist;
    if (!crewId || result[crewId] || !record(raw)) continue;
    const checklist: DailyChecklist = {
      safetyBriefing: raw.safetyBriefing === true,
      ppeVerification: raw.ppeVerification === true,
      equipmentInspection: raw.equipmentInspection === true,
      dailyGoals: typeof raw.dailyGoals === "string" ? raw.dailyGoals : "",
      supervisorNotes: typeof raw.supervisorNotes === "string" ? raw.supervisorNotes : "",
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : event.occurred_at,
      ...(typeof raw.workDate === "string" ? { workDate: raw.workDate } : {}),
    };
    if (checklistMatchesDay(checklist, workDate, timeZone)) result[crewId] = checklist;
  }
  return result;
}
