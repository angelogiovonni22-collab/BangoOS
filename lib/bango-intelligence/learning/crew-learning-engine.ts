import { computeDeterministicConfidence } from "./confidence-engine";
import type { LearningEngineOutput } from "./learning-types";
import type { LearningTaskRow } from "./learning-provider";
import type { LearningMetricRecord, LearningTimeWindow } from "./metric-types";

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number(((numerator / denominator) * 100).toFixed(2));
}

export function buildCrewLearning(
  companyId: string,
  tasks: ReadonlyArray<LearningTaskRow>,
  timeWindow: LearningTimeWindow,
): LearningEngineOutput {
  const sourceTaskIds = tasks.map((task) => task.id);
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((task) => task.status === "completed").length;
  const overdueTasks = tasks.filter((task) => task.status === "overdue").length;
  const avgCompletion =
    totalTasks > 0
      ? Number(
          (
            tasks.reduce((sum, task) => sum + Math.max(0, Math.min(100, task.completion_percentage ?? 0)), 0) / totalTasks
          ).toFixed(2),
        )
      : 0;

  let withHoursCount = 0;
  let totalEstimated = 0;
  let totalActual = 0;
  for (const task of tasks) {
    if (typeof task.estimated_hours === "number" && typeof task.actual_hours === "number" && task.estimated_hours > 0) {
      totalEstimated += task.estimated_hours;
      totalActual += task.actual_hours;
      withHoursCount += 1;
    }
  }

  const hoursVariance = totalEstimated > 0 ? Number((totalActual / totalEstimated).toFixed(4)) : 0;
  const projectsWorked = new Set(tasks.map((task) => task.project_id)).size;

  const metricSeed = {
    sourceCount: totalTasks,
    sampleSize: totalTasks,
  };

  const baseConfidence = computeDeterministicConfidence({
    ...metricSeed,
    requiredSampleSize: 12,
  });

  const hoursConfidence = computeDeterministicConfidence({
    sourceCount: withHoursCount,
    sampleSize: withHoursCount,
    requiredSampleSize: 8,
  });

  const metrics: LearningMetricRecord[] = [
    {
      id: `crew-assigned-${companyId}`,
      metricType: "crew_assigned_task_count",
      subjectType: "crew",
      subjectId: companyId,
      companyId,
      value: totalTasks,
      unit: "count",
      direction: "stable",
      confidence: baseConfidence,
      sourceCount: totalTasks,
      sampleSize: totalTasks,
      timeWindow,
      calculationMethod: "count(tasks)",
      evidenceIds: sourceTaskIds,
      limitations: totalTasks === 0 ? ["No task records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `crew-completed-${companyId}`,
      metricType: "crew_completed_task_count",
      subjectType: "crew",
      subjectId: companyId,
      companyId,
      value: completedTasks,
      unit: "count",
      direction: "stable",
      confidence: baseConfidence,
      sourceCount: totalTasks,
      sampleSize: totalTasks,
      timeWindow,
      calculationMethod: "count(tasks where status=completed)",
      evidenceIds: sourceTaskIds,
      limitations: totalTasks === 0 ? ["No task records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `crew-overdue-${companyId}`,
      metricType: "crew_overdue_task_count",
      subjectType: "crew",
      subjectId: companyId,
      companyId,
      value: overdueTasks,
      unit: "count",
      direction: overdueTasks > 0 ? "declining" : "stable",
      confidence: baseConfidence,
      sourceCount: totalTasks,
      sampleSize: totalTasks,
      timeWindow,
      calculationMethod: "count(tasks where status=overdue)",
      evidenceIds: sourceTaskIds,
      limitations: totalTasks === 0 ? ["No task records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `crew-completion-${companyId}`,
      metricType: "crew_average_completion_percent",
      subjectType: "crew",
      subjectId: companyId,
      companyId,
      value: avgCompletion,
      unit: "percent",
      direction: avgCompletion >= 85 ? "improving" : "stable",
      confidence: baseConfidence,
      sourceCount: totalTasks,
      sampleSize: totalTasks,
      timeWindow,
      calculationMethod: "avg(tasks.completion_percentage)",
      evidenceIds: sourceTaskIds,
      limitations: totalTasks === 0 ? ["No task records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `crew-hours-variance-${companyId}`,
      metricType: "crew_hours_variance_ratio",
      subjectType: "crew",
      subjectId: companyId,
      companyId,
      value: hoursVariance,
      unit: "ratio",
      direction: hoursVariance > 1.1 ? "declining" : "stable",
      confidence: hoursConfidence,
      sourceCount: withHoursCount,
      sampleSize: withHoursCount,
      timeWindow,
      calculationMethod: "sum(actual_hours)/sum(estimated_hours)",
      evidenceIds: sourceTaskIds,
      limitations:
        withHoursCount === 0
          ? ["No tasks had both estimated_hours and actual_hours values."]
          : [
              `Only ${withHoursCount}/${totalTasks} tasks included hours pairs.`,
            ],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `crew-projects-worked-${companyId}`,
      metricType: "crew_projects_worked_count",
      subjectType: "crew",
      subjectId: companyId,
      companyId,
      value: projectsWorked,
      unit: "count",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: projectsWorked,
        sampleSize: totalTasks,
        requiredSampleSize: 6,
      }),
      sourceCount: projectsWorked,
      sampleSize: totalTasks,
      timeWindow,
      calculationMethod: "count(distinct tasks.project_id)",
      evidenceIds: sourceTaskIds,
      limitations: totalTasks === 0 ? ["No task records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
  ];

  const completionRate = percent(completedTasks, Math.max(1, totalTasks));
  const overdueRate = percent(overdueTasks, Math.max(1, totalTasks));

  const traits = [
    {
      traitId: "crew-reliability",
      labelKey: "learning.traits.crewReliability",
      metricType: "crew_average_completion_percent" as const,
      confidence: baseConfidence,
      evidenceCount: totalTasks,
      timeWindow,
      sourceIds: sourceTaskIds,
      limitations: [
        `Completion rate observed at ${completionRate}% with overdue rate ${overdueRate}%.`,
      ],
    },
  ];

  const limitations: string[] = [];
  if (totalTasks < 3) {
    limitations.push("Crew learning has limited reliability because fewer than 3 tasks were observed.");
  }

  return {
    subjectType: "crew",
    metrics,
    traits,
    limitations,
  };
}
