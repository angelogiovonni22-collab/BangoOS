import type { ScheduleIntelligence } from "./intelligence-types";

type ScheduleTaskInput = {
  status: string;
  completion_percentage: number;
  planned_finish: string | null;
};

type ScheduleProjectInput = {
  estimated_end_date: string | null;
};

/**
 * Derives schedule intelligence from already-loaded task and project data.
 * No Supabase queries are performed here.
 */
export function buildScheduleIntelligence(
  project: ScheduleProjectInput,
  tasks: ScheduleTaskInput[],
): ScheduleIntelligence {
  const todayIso = todayString();
  const weekEndIso = addDays(todayIso, 7);

  const nonCompletedTasks = tasks.filter((t) => !isCompletedOrCancelled(t.status));

  const tasksDueToday = nonCompletedTasks.filter(
    (t) => t.planned_finish === todayIso,
  ).length;

  const tasksDueThisWeek = nonCompletedTasks.filter(
    (t) =>
      t.planned_finish !== null &&
      t.planned_finish >= todayIso &&
      t.planned_finish <= weekEndIso,
  ).length;

  const overdueTasks = nonCompletedTasks.filter(
    (t) => t.planned_finish !== null && t.planned_finish < todayIso,
  ).length;

  const daysUntilDue = project.estimated_end_date
    ? calcDaysUntil(project.estimated_end_date)
    : null;

  const scheduleRiskLevel = deriveScheduleRiskLevel(
    overdueTasks,
    nonCompletedTasks.length,
    daysUntilDue,
  );

  const onSchedule = scheduleRiskLevel === "none" || scheduleRiskLevel === "low";

  return {
    onSchedule,
    tasksDueToday,
    tasksDueThisWeek,
    scheduleRiskLevel,
    daysUntilDue,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCompletedOrCancelled(status: string) {
  const s = status.trim().toLowerCase();
  return s === "completed" || s === "cancelled";
}

function todayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function calcDaysUntil(isoDate: string): number | null {
  const target = new Date(`${isoDate}T00:00:00Z`);
  if (!Number.isFinite(target.getTime())) {
    return null;
  }

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffMs = target.getTime() - todayUtc;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return Math.abs(days) > 3650 ? null : days;
}

function deriveScheduleRiskLevel(
  overdueTasks: number,
  openTasks: number,
  daysUntilDue: number | null,
): ScheduleIntelligence["scheduleRiskLevel"] {
  if (overdueTasks === 0 && openTasks === 0) {
    return "none";
  }

  const overdueRatio = openTasks > 0 ? overdueTasks / openTasks : 0;

  if (overdueRatio >= 0.5 || overdueTasks >= 5) {
    return "high";
  }

  if (overdueRatio >= 0.25 || overdueTasks >= 2) {
    return "medium";
  }

  if (overdueTasks > 0) {
    return "low";
  }

  // No overdue tasks — check proximity to due date
  if (daysUntilDue !== null && daysUntilDue < 0) {
    return "high";
  }

  if (daysUntilDue !== null && daysUntilDue <= 7 && openTasks > 0) {
    return "medium";
  }

  return "none";
}
