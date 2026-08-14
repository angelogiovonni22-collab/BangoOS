import type { DailyReport, LaborTotals } from "./types";

function formatHours(value: number) {
  return `${value.toFixed(1)}h`;
}

function summarizeLabor(totals: LaborTotals) {
  return [
    `${totals.presentWorkers}/${totals.scheduledWorkers} crew members present`,
    `${totals.absentWorkers} absent`,
    `${totals.lateWorkers} late arrivals`,
    `${formatHours(totals.totalLaborHours)} total labor`,
  ].join(", ");
}

export function buildDeterministicDailySummary(report: DailyReport): string {
  const completedMilestones = report.workCompleted.filter((item) => item.milestoneCompleted).length;
  const productionUnits = report.workCompleted.reduce((acc, item) => acc + item.quantity, 0);
  const delayHours = report.delays.reduce((acc, item) => acc + item.durationHours, 0);
  const incidentCount = report.safety.filter((item) => item.type === "incident" || item.type === "near_miss").length;

  const lines = [
    "AI DAILY SUMMARY - deterministic output",
    `${report.header.date} ${report.header.shift.toUpperCase()} shift at ${report.header.projectName}.`,
    `Weather: ${report.header.weather}, ${report.header.temperatureF}F, site ${report.header.siteConditions}.`,
    `Labor: ${summarizeLabor(report.laborTotals)}.`,
    `Work completed: ${report.workCompleted.length} activities, ${productionUnits.toFixed(1)} total units, ${completedMilestones} milestones completed.`,
    `Materials: ${report.materials.length} deliveries logged with ${report.materials.filter((item) => item.shortages).length} shortages and ${report.materials.filter((item) => item.rejected).length} rejected loads.`,
    `Safety: ${report.safety.length} observations, ${incidentCount} incidents/near misses, ${report.safety.filter((item) => item.status !== "resolved").length} open items.`,
    `Delays: ${report.delays.length} events totaling ${formatHours(delayHours)} with primary category ${report.delays[0]?.category || "none"}.`,
    "Recommended next actions: close open safety items, reconcile delayed scopes, and confirm next-shift staffing.",
  ];

  return lines.join("\n");
}
