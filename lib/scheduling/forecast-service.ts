import type {
  LaborDemand,
  LaborForecast,
  LaborForecastRange,
  ScheduleAssignment,
} from "./types";

function aggregateDemand(
  assignments: ScheduleAssignment[],
  keyPicker: (assignment: ScheduleAssignment) => string,
  labelPicker: (assignment: ScheduleAssignment) => string,
): LaborDemand[] {
  const map = new Map<string, LaborDemand>();

  for (const assignment of assignments) {
    const key = keyPicker(assignment);
    const existing = map.get(key);
    const required = assignment.requiredHeadcount;
    const scheduled = assignment.assignedEmployeeIds.length;
    const available = Math.max(0, required + Math.round(required * 0.25) - scheduled);

    if (!existing) {
      map.set(key, {
        key,
        label: labelPicker(assignment),
        requiredHeadcount: required,
        scheduledHeadcount: scheduled,
        availableHeadcount: available,
        laborShortage: Math.max(0, required - scheduled),
        laborSurplus: Math.max(0, scheduled - required),
        overtimeForecast: scheduled > required ? Math.round((scheduled - required) * 1.5) : 0,
        utilizationForecast: Math.min(100, Math.round((scheduled / Math.max(required, 1)) * 100)),
        openShifts: assignment.isOpenShift ? 1 : 0,
        upcomingPto: 0,
        expiringCertifications: 0,
      });
      continue;
    }

    existing.requiredHeadcount += required;
    existing.scheduledHeadcount += scheduled;
    existing.availableHeadcount += available;
    existing.laborShortage += Math.max(0, required - scheduled);
    existing.laborSurplus += Math.max(0, scheduled - required);
    existing.overtimeForecast += scheduled > required ? Math.round((scheduled - required) * 1.5) : 0;
    existing.utilizationForecast = Math.min(
      100,
      Math.round((existing.scheduledHeadcount / Math.max(existing.requiredHeadcount, 1)) * 100),
    );
    existing.openShifts += assignment.isOpenShift ? 1 : 0;
  }

  return Array.from(map.values()).sort((a, b) => b.laborShortage - a.laborShortage);
}

function rangeDays(range: LaborForecastRange) {
  if (range === "tomorrow") {
    return 1;
  }

  if (range === "7d") {
    return 7;
  }

  if (range === "14d") {
    return 14;
  }

  return 30;
}

function inRange(date: string, start: Date, days: number) {
  const value = new Date(`${date}T00:00:00Z`).getTime();
  const startMs = new Date(`${start.toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  const endMs = startMs + (days * 24 * 60 * 60 * 1000);
  return value >= startMs && value < endMs;
}

export function buildLaborForecast(assignments: ScheduleAssignment[], range: LaborForecastRange): LaborForecast {
  const start = new Date();
  const days = rangeDays(range);
  const scoped = assignments.filter((item) => inRange(item.date, start, days));

  const demandByTrade = aggregateDemand(scoped, (item) => item.requiredTrade, (item) => item.requiredTrade);
  const demandByProject = aggregateDemand(scoped, (item) => item.scope.projectId, (item) => item.scope.projectName);
  const demandByCrew = aggregateDemand(
    scoped,
    (item) => item.assignedCrewIds.join("|") || "unassigned-crew",
    (item) => item.assignedCrewIds.length > 0 ? `${item.assignedCrewIds.length} assigned crew(s)` : "Unassigned crew",
  );
  const demandByLocation = aggregateDemand(scoped, (item) => item.scope.location, (item) => item.scope.location);
  const demandByShift = aggregateDemand(scoped, (item) => item.shift, (item) => item.shift.toUpperCase());

  const totalRequired = scoped.reduce((sum, item) => sum + item.requiredHeadcount, 0);
  const totalScheduled = scoped.reduce((sum, item) => sum + item.assignedEmployeeIds.length, 0);
  const totalOpenShifts = scoped.filter((item) => item.isOpenShift).length;
  const totalOvertimeRisk = scoped.filter((item) => item.assignedEmployeeIds.length > item.requiredHeadcount).length;

  return {
    range,
    summaryCards: [
      {
        id: "required",
        label: "scheduling.forecast.cards.required",
        value: String(totalRequired),
        trend: "scheduling.forecast.trend.required",
        status: "watch",
      },
      {
        id: "scheduled",
        label: "scheduling.forecast.cards.scheduled",
        value: String(totalScheduled),
        trend: "scheduling.forecast.trend.scheduled",
        status: totalScheduled >= totalRequired ? "good" : "watch",
      },
      {
        id: "shortage",
        label: "scheduling.forecast.cards.shortage",
        value: String(Math.max(0, totalRequired - totalScheduled)),
        trend: "scheduling.forecast.trend.shortage",
        status: totalRequired > totalScheduled ? "risk" : "good",
      },
      {
        id: "openShifts",
        label: "scheduling.forecast.cards.openShifts",
        value: String(totalOpenShifts),
        trend: "scheduling.forecast.trend.openShifts",
        status: totalOpenShifts > 3 ? "risk" : "watch",
      },
      {
        id: "overtime",
        label: "scheduling.forecast.cards.overtime",
        value: String(totalOvertimeRisk),
        trend: "scheduling.forecast.trend.overtime",
        status: totalOvertimeRisk > 2 ? "risk" : "watch",
      },
    ],
    demandByTrade,
    demandByProject,
    demandByCrew,
    demandByLocation,
    demandByShift,
    risks: [
      "Upcoming certification expirations in electrical and sitework coverage.",
      "Potential carpenter shortage on Project Oak in the next seven days.",
      "Night-shift utilization exceeds healthy threshold in dock expansion scope.",
    ],
  };
}
