import { computeDeterministicConfidence } from "./confidence-engine";
import { calculateTrendDirection } from "./trend-calculator";
import type { LearningEngineOutput } from "./learning-types";
import type {
  LearningChangeOrderRow,
  LearningEstimateRow,
  LearningInvoiceRow,
  LearningMemoryRow,
  LearningProjectRow,
  LearningTaskRow,
} from "./learning-provider";
import type { LearningMetricRecord, LearningTimeWindow } from "./metric-types";

function ratio(numerator: number, denominator: number): number {
  if (denominator <= 0) {
    return 0;
  }

  return Number((numerator / denominator).toFixed(4));
}

export function buildProjectLearning(
  companyId: string,
  project: LearningProjectRow | null,
  tasks: ReadonlyArray<LearningTaskRow>,
  changeOrders: ReadonlyArray<LearningChangeOrderRow>,
  estimates: ReadonlyArray<LearningEstimateRow>,
  invoices: ReadonlyArray<LearningInvoiceRow>,
  memories: ReadonlyArray<LearningMemoryRow>,
  timeWindow: LearningTimeWindow,
): LearningEngineOutput {
  if (!project) {
    return {
      subjectType: "project",
      metrics: [],
      traits: [],
      limitations: ["No project selected for project-level learning."],
    };
  }

  const projectTasks = tasks.filter((task) => task.project_id === project.id);
  const projectChangeOrders = changeOrders.filter((co) => co.project_id === project.id);
  const projectEstimates = estimates.filter((estimate) => estimate.project_id === project.id);
  const projectInvoices = invoices.filter((invoice) => invoice.project_id === project.id);
  const projectMemories = memories.filter((memory) => memory.project_id === project.id);

  const completedTasks = projectTasks.filter((task) => task.status === "completed").length;
  const overdueTasks = projectTasks.filter((task) => task.status === "overdue").length;
  const blockedTasks = projectTasks.filter((task) => task.status === "blocked").length;
  const completionPercent =
    projectTasks.length > 0
      ? Number(((completedTasks / projectTasks.length) * 100).toFixed(2))
      : 0;
  const overdueRatio = ratio(overdueTasks, projectTasks.length);
  const blockedRatio = ratio(blockedTasks, projectTasks.length);

  const estimateTotal = projectEstimates.reduce((sum, estimate) => sum + (estimate.total_amount ?? 0), 0);
  const invoiceTotal = projectInvoices.reduce((sum, invoice) => sum + (invoice.total_amount ?? 0), 0);
  const estimateToInvoiceRatio = ratio(invoiceTotal, estimateTotal);

  const changeOrderCount = projectChangeOrders.length;
  const changeOrderValue = Number(
    projectChangeOrders.reduce((sum, co) => sum + (co.total_amount ?? 0), 0).toFixed(2),
  );

  const documentationVolume = projectMemories.length;

  const windowStartTime = timeWindow.startAt ? new Date(timeWindow.startAt).getTime() : NaN;
  const windowEndTime = new Date(timeWindow.endAt).getTime();
  const hasValidWindow = Number.isFinite(windowStartTime) && Number.isFinite(windowEndTime) && windowEndTime > windowStartTime;
  const midpointTime = hasValidWindow ? windowStartTime + (windowEndTime - windowStartTime) / 2 : null;

  let previousTasks = 0;
  let currentTasks = 0;
  if (midpointTime !== null) {
    for (const task of projectTasks) {
      const createdTime = new Date(task.created_at).getTime();
      if (!Number.isFinite(createdTime)) {
        continue;
      }

      if (createdTime < midpointTime) {
        previousTasks += 1;
      } else {
        currentTasks += 1;
      }
    }
  }

  const completionDirection = midpointTime === null
    ? "insufficient_data"
    : calculateTrendDirection({
      current: currentTasks,
      previous: previousTasks,
      minimumDeltaPercent: 2,
    });

  const evidenceIds = [
    ...projectTasks.map((task) => task.id),
    ...projectChangeOrders.map((co) => co.id),
    ...projectEstimates.map((estimate) => estimate.id),
    ...projectInvoices.map((invoice) => invoice.id),
    ...projectMemories.map((memory) => memory.id),
  ];

  const taskConfidence = computeDeterministicConfidence({
    sourceCount: projectTasks.length,
    sampleSize: projectTasks.length,
    requiredSampleSize: 10,
  });

  const financeConfidence = computeDeterministicConfidence({
    sourceCount: projectEstimates.length + projectInvoices.length,
    sampleSize: projectEstimates.length + projectInvoices.length,
    requiredSampleSize: 6,
  });

  const metrics: LearningMetricRecord[] = [
    {
      id: `project-completion-${project.id}`,
      metricType: "project_completion_percent",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: completionPercent,
      unit: "percent",
      direction: completionDirection,
      confidence: taskConfidence,
      sourceCount: projectTasks.length,
      sampleSize: projectTasks.length,
      timeWindow,
      calculationMethod: "completed_tasks/total_tasks",
      evidenceIds,
      limitations: projectTasks.length === 0 ? ["No project tasks in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-overdue-ratio-${project.id}`,
      metricType: "project_overdue_task_ratio",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: overdueRatio,
      unit: "ratio",
      direction: overdueRatio > 0.2 ? "declining" : "stable",
      confidence: taskConfidence,
      sourceCount: projectTasks.length,
      sampleSize: projectTasks.length,
      timeWindow,
      calculationMethod: "overdue_tasks/total_tasks",
      evidenceIds,
      limitations: projectTasks.length === 0 ? ["No project tasks in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-blocked-ratio-${project.id}`,
      metricType: "project_blocked_task_ratio",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: blockedRatio,
      unit: "ratio",
      direction: blockedRatio > 0.15 ? "declining" : "stable",
      confidence: taskConfidence,
      sourceCount: projectTasks.length,
      sampleSize: projectTasks.length,
      timeWindow,
      calculationMethod: "blocked_tasks/total_tasks",
      evidenceIds,
      limitations: projectTasks.length === 0 ? ["No project tasks in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-estimate-invoice-ratio-${project.id}`,
      metricType: "project_estimate_to_invoice_ratio",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: estimateToInvoiceRatio,
      unit: "ratio",
      direction: estimateToInvoiceRatio >= 1 ? "improving" : "stable",
      confidence: financeConfidence,
      sourceCount: projectEstimates.length + projectInvoices.length,
      sampleSize: projectEstimates.length + projectInvoices.length,
      timeWindow,
      calculationMethod: "sum(invoices.total_amount)/sum(estimates.total_amount)",
      evidenceIds,
      limitations:
        projectEstimates.length === 0
          ? ["No project estimates found for selected time window."]
          : projectInvoices.length === 0
            ? ["No project invoices found for selected time window."]
            : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-change-order-count-${project.id}`,
      metricType: "project_change_order_count",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: changeOrderCount,
      unit: "count",
      direction: changeOrderCount > 0 ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: changeOrderCount,
        sampleSize: projectChangeOrders.length,
        requiredSampleSize: 3,
      }),
      sourceCount: changeOrderCount,
      sampleSize: projectChangeOrders.length,
      timeWindow,
      calculationMethod: "count(change_orders for project)",
      evidenceIds,
      limitations: projectChangeOrders.length === 0 ? ["No project change orders in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-change-order-value-${project.id}`,
      metricType: "project_change_order_value",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: changeOrderValue,
      unit: "currency",
      direction: changeOrderValue > 0 ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: projectChangeOrders.length,
        sampleSize: projectChangeOrders.length,
        requiredSampleSize: 3,
      }),
      sourceCount: projectChangeOrders.length,
      sampleSize: projectChangeOrders.length,
      timeWindow,
      calculationMethod: "sum(change_orders.total_amount)",
      evidenceIds,
      limitations: projectChangeOrders.length === 0 ? ["No project change orders in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-documentation-volume-${project.id}`,
      metricType: "project_documentation_volume",
      subjectType: "project",
      subjectId: project.id,
      companyId,
      value: documentationVolume,
      unit: "count",
      direction: documentationVolume >= 3 ? "improving" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: documentationVolume,
        sampleSize: documentationVolume,
        requiredSampleSize: 5,
      }),
      sourceCount: documentationVolume,
      sampleSize: documentationVolume,
      timeWindow,
      calculationMethod: "count(project-linked memories)",
      evidenceIds,
      limitations: documentationVolume === 0 ? ["No project-linked memories in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
  ];

  const traits = [
    {
      traitId: "project-execution-predictability",
      labelKey: "learning.traits.projectExecutionPredictability",
      metricType: "project_overdue_task_ratio" as const,
      confidence: taskConfidence,
      evidenceCount: projectTasks.length,
      timeWindow,
      sourceIds: projectTasks.map((task) => task.id),
      limitations: [
        "Predictability trait is based on task status distribution only, not direct schedule baselines.",
      ],
    },
  ];

  const limitations: string[] = [];
  if (projectTasks.length < 3) {
    limitations.push("Project learning has limited reliability because fewer than 3 tasks were observed.");
  }

  return {
    subjectType: "project",
    metrics,
    traits,
    limitations,
  };
}
