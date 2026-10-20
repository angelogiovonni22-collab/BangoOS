import assert from "node:assert/strict";
import { isActiveScheduleAssignment } from "./assignment-lifecycle";
import { buildScheduleHealth, detectSchedulingConflicts } from "./conflict-engine";
import { buildLaborForecast } from "./forecast-service";
import type { OpenShift, ScheduleAssignment } from "./types";

function assignment(id: string, status: ScheduleAssignment["status"]): ScheduleAssignment {
  const date = new Date().toISOString().slice(0, 10);
  return {
    id, status, title: id, type: "project_work", shift: "day", priority: "medium", date,
    startTime: "07:00", endTime: "19:00", plannedStart: `${date}T07:00:00Z`, plannedEnd: `${date}T19:00:00Z`,
    plannedLaborHours: 12, requiredHeadcount: 3, requiredTrade: "General", assignedCrewIds: ["crew"], assignedEmployeeIds: ["employee"],
    scope: { projectId: "project", projectName: "Synthetic", location: "Synthetic", supervisor: "supervisor" }, notes: "",
    travelTimeMinutes: 90, recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
    safetyRequirement: "", certificationRequirement: "", equipment: { requiredEquipment: [], assignedEquipment: [], operatorRequired: false },
    isOpenShift: true, createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`,
  };
}

function shift(assignmentId: string, dismissed = false): OpenShift {
  return { id: `shift-${assignmentId}`, assignmentId, dismissed, projectId: "project", projectName: "Synthetic", tradeRequired: "General", workersNeeded: 4,
    date: new Date().toISOString().slice(0, 10), shift: "day", startTime: "07:00", endTime: "19:00", location: "Synthetic", urgency: "critical",
    supervisor: "supervisor", certificationRequirements: [], estimatedHours: 12, reason: "Synthetic", candidateEmployeeIds: [], candidateCrewIds: [] };
}

const active = assignment("active", "published");
const cancelled = assignment("cancelled", "cancelled");
const completed = assignment("completed", "completed");
for (const status of ["draft", "published", "in_progress"] as const) assert.equal(isActiveScheduleAssignment({ status }), true);
for (const status of ["completed", "cancelled"] as const) assert.equal(isActiveScheduleAssignment({ status }), false);
const input = [active, cancelled, completed];
const before = structuredClone(input);
const detect = (assignments: ScheduleAssignment[], openShifts: OpenShift[] = []) => detectSchedulingConflicts({ assignments, openShifts, availability: [], timeOff: [] });
const baseline = detect([active]);
const mixed = detect(input, [shift(cancelled.id), shift(completed.id), shift("dismissed", true)]);
assert.deepEqual(mixed, baseline, "historical assignments and stale/dismissed open shifts cannot add risks");
assert.ok(baseline.some(row => row.type === "understaffed_project"));
assert.ok(baseline.some(row => row.type === "overtime_threshold_risk"));
assert.deepEqual(detect([cancelled, completed]), [], "historical staffing, travel, overtime and overlap alerts disappear");
assert.ok(detect([active, assignment("other", "draft")]).some(row => row.type === "crew_double_booking"), "active booking protection remains");
assert.ok(detect([], [shift("standalone")]).some(row => row.type === "understaffed_project"), "standalone open demand is preserved");
assert.deepEqual(buildLaborForecast(input, "7d"), buildLaborForecast([active], "7d"), "forecast demand and shortage exclude terminal assignments");
assert.equal(buildLaborForecast([cancelled, completed], "7d").summaryCards.find(row => row.id === "required")?.value, "0");
const health = (conflicts: ReturnType<typeof detect>) => buildScheduleHealth({ assignments: input, conflicts, openShifts: [], dispatch: [] });
assert.deepEqual(health(mixed), health(baseline), "historical records cannot lower health through false conflict counts");
assert.deepEqual(input, before, "calendar/history input records remain unchanged");
console.log("Scheduling lifecycle: terminal risk/forecast exclusion, active protections, history retention and health parity passed.");
