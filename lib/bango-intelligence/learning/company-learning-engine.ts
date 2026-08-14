import { computeDeterministicConfidence } from "./confidence-engine";
import type { LearningEngineOutput } from "./learning-types";
import type {
  LearningEquipmentRow,
  LearningMaterialRow,
  LearningMemoryRow,
  LearningProjectRow,
  LearningTaskRow,
} from "./learning-provider";
import type { LearningMetricRecord, LearningTimeWindow } from "./metric-types";

export function buildCompanyLearning(
  companyId: string,
  memories: ReadonlyArray<LearningMemoryRow>,
  tasks: ReadonlyArray<LearningTaskRow>,
  projects: ReadonlyArray<LearningProjectRow>,
  equipment: ReadonlyArray<LearningEquipmentRow>,
  materials: ReadonlyArray<LearningMaterialRow>,
  timeWindow: LearningTimeWindow,
): LearningEngineOutput {
  const recurringLessonCount = memories.filter((memory) => memory.category === "lesson_learned").length;
  const recurringScheduleRiskCount = memories.filter((memory) => memory.category === "schedule_risk").length;
  const documentationGapCount = memories.filter((memory) => memory.category === "documentation_gap").length;
  const vendorPreferenceCount = memories.filter((memory) => memory.category === "vendor_preference").length;
  const customerPreferenceCount = memories.filter((memory) => memory.category === "customer_preference").length;

  const crewUtilizationSignalCount = tasks.filter(
    (task) => task.status === "in_progress" || task.status === "overdue" || task.status === "blocked",
  ).length;

  const projectTypeGroups = new Map<string, LearningProjectRow[]>();
  for (const project of projects) {
    const projectType = project.project_type ?? "unspecified";
    const group = projectTypeGroups.get(projectType) ?? [];
    group.push(project);
    projectTypeGroups.set(projectType, group);
  }

  let projectTypeAverageContractAmount = 0;
  let projectTypeAverageEstimatedCost = 0;
  let projectTypeAverageChangeOrderCount = 0;
  let projectTypeAverageDurationDays = 0;

  const projectTypeCount = projectTypeGroups.size;
  if (projectTypeCount > 0) {
    for (const group of projectTypeGroups.values()) {
      projectTypeAverageContractAmount +=
        group.reduce((sum, project) => sum + (project.contract_amount ?? 0), 0) / group.length;
      projectTypeAverageEstimatedCost +=
        group.reduce((sum, project) => sum + (project.estimated_cost ?? 0), 0) / group.length;
      projectTypeAverageChangeOrderCount += memories.filter((memory) =>
        group.some((project) => project.id === memory.project_id) && memory.category === "change_order_pattern",
      ).length;

      const durations = group
        .map((project) => {
          if (!project.estimated_start_date || !project.estimated_end_date) {
            return null;
          }

          const start = new Date(project.estimated_start_date).getTime();
          const end = new Date(project.estimated_end_date).getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end < start) {
            return null;
          }

          return Math.round((end - start) / (1000 * 60 * 60 * 24));
        })
        .filter((duration): duration is number => duration !== null);

      if (durations.length > 0) {
        projectTypeAverageDurationDays += durations.reduce((sum, duration) => sum + duration, 0) / durations.length;
      }
    }

    projectTypeAverageContractAmount = Number((projectTypeAverageContractAmount / projectTypeCount).toFixed(2));
    projectTypeAverageEstimatedCost = Number((projectTypeAverageEstimatedCost / projectTypeCount).toFixed(2));
    projectTypeAverageChangeOrderCount = Number((projectTypeAverageChangeOrderCount / projectTypeCount).toFixed(2));
    projectTypeAverageDurationDays = Number((projectTypeAverageDurationDays / projectTypeCount).toFixed(2));
  }

  const sourceEvidenceIds = [
    ...memories.map((memory) => memory.id),
    ...tasks.map((task) => task.id),
    ...projects.map((project) => project.id),
    ...equipment.map((item) => item.id),
    ...materials.map((item) => item.id),
  ];

  const baselineSample = memories.length + tasks.length + projects.length;

  const metrics: LearningMetricRecord[] = [
    {
      id: `company-recurring-lessons-${companyId}`,
      metricType: "company_recurring_lesson_count",
      subjectType: "company",
      subjectId: companyId,
      companyId,
      value: recurringLessonCount,
      unit: "count",
      direction: recurringLessonCount > 0 ? "improving" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: recurringLessonCount,
        sampleSize: baselineSample,
        requiredSampleSize: 10,
      }),
      sourceCount: recurringLessonCount,
      sampleSize: baselineSample,
      timeWindow,
      calculationMethod: "count(memories where category=lesson_learned)",
      evidenceIds: sourceEvidenceIds,
      limitations: memories.length === 0 ? ["No memory records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `company-recurring-schedule-risk-${companyId}`,
      metricType: "company_recurring_schedule_risk_count",
      subjectType: "company",
      subjectId: companyId,
      companyId,
      value: recurringScheduleRiskCount,
      unit: "count",
      direction: recurringScheduleRiskCount > 0 ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: recurringScheduleRiskCount,
        sampleSize: baselineSample,
        requiredSampleSize: 10,
      }),
      sourceCount: recurringScheduleRiskCount,
      sampleSize: baselineSample,
      timeWindow,
      calculationMethod: "count(memories where category=schedule_risk)",
      evidenceIds: sourceEvidenceIds,
      limitations: memories.length === 0 ? ["No memory records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `company-documentation-gap-${companyId}`,
      metricType: "company_documentation_gap_count",
      subjectType: "company",
      subjectId: companyId,
      companyId,
      value: documentationGapCount,
      unit: "count",
      direction: documentationGapCount > 0 ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: documentationGapCount,
        sampleSize: baselineSample,
        requiredSampleSize: 8,
      }),
      sourceCount: documentationGapCount,
      sampleSize: baselineSample,
      timeWindow,
      calculationMethod: "count(memories where category=documentation_gap)",
      evidenceIds: sourceEvidenceIds,
      limitations: memories.length === 0 ? ["No memory records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `company-vendor-preference-${companyId}`,
      metricType: "company_vendor_preference_count",
      subjectType: "company",
      subjectId: companyId,
      companyId,
      value: vendorPreferenceCount,
      unit: "count",
      direction: vendorPreferenceCount > 0 ? "improving" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: vendorPreferenceCount,
        sampleSize: baselineSample,
        requiredSampleSize: 6,
      }),
      sourceCount: vendorPreferenceCount,
      sampleSize: baselineSample,
      timeWindow,
      calculationMethod: "count(memories where category=vendor_preference)",
      evidenceIds: sourceEvidenceIds,
      limitations: memories.length === 0 ? ["No memory records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `company-customer-preference-${companyId}`,
      metricType: "company_customer_preference_count",
      subjectType: "company",
      subjectId: companyId,
      companyId,
      value: customerPreferenceCount,
      unit: "count",
      direction: customerPreferenceCount > 0 ? "improving" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: customerPreferenceCount,
        sampleSize: baselineSample,
        requiredSampleSize: 6,
      }),
      sourceCount: customerPreferenceCount,
      sampleSize: baselineSample,
      timeWindow,
      calculationMethod: "count(memories where category=customer_preference)",
      evidenceIds: sourceEvidenceIds,
      limitations: memories.length === 0 ? ["No memory records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `company-crew-utilization-signal-${companyId}`,
      metricType: "company_crew_utilization_signal_count",
      subjectType: "company",
      subjectId: companyId,
      companyId,
      value: crewUtilizationSignalCount,
      unit: "count",
      direction: crewUtilizationSignalCount > 0 ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: crewUtilizationSignalCount,
        sampleSize: tasks.length,
        requiredSampleSize: 12,
      }),
      sourceCount: crewUtilizationSignalCount,
      sampleSize: tasks.length,
      timeWindow,
      calculationMethod: "count(tasks where status in (in_progress, overdue, blocked))",
      evidenceIds: sourceEvidenceIds,
      limitations: tasks.length === 0 ? ["No task records in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-type-average-contract-${companyId}`,
      metricType: "project_type_average_contract_amount",
      subjectType: "project_type",
      subjectId: companyId,
      companyId,
      value: projectTypeAverageContractAmount,
      unit: "currency",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: projectTypeCount,
        sampleSize: projects.length,
        requiredSampleSize: 5,
      }),
      sourceCount: projectTypeCount,
      sampleSize: projects.length,
      timeWindow,
      calculationMethod: "avg by project_type of projects.contract_amount",
      evidenceIds: sourceEvidenceIds,
      limitations: projects.length === 0 ? ["No projects found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-type-average-estimated-cost-${companyId}`,
      metricType: "project_type_average_estimated_cost",
      subjectType: "project_type",
      subjectId: companyId,
      companyId,
      value: projectTypeAverageEstimatedCost,
      unit: "currency",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: projectTypeCount,
        sampleSize: projects.length,
        requiredSampleSize: 5,
      }),
      sourceCount: projectTypeCount,
      sampleSize: projects.length,
      timeWindow,
      calculationMethod: "avg by project_type of projects.estimated_cost",
      evidenceIds: sourceEvidenceIds,
      limitations: projects.length === 0 ? ["No projects found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-type-average-change-order-count-${companyId}`,
      metricType: "project_type_average_change_order_count",
      subjectType: "project_type",
      subjectId: companyId,
      companyId,
      value: projectTypeAverageChangeOrderCount,
      unit: "count",
      direction: projectTypeAverageChangeOrderCount > 0 ? "declining" : "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: projectTypeCount,
        sampleSize: projects.length + memories.length,
        requiredSampleSize: 5,
      }),
      sourceCount: projectTypeCount,
      sampleSize: projects.length + memories.length,
      timeWindow,
      calculationMethod: "avg by project_type of change_order_pattern memory observations",
      evidenceIds: sourceEvidenceIds,
      limitations: projects.length === 0 ? ["No projects found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
    {
      id: `project-type-average-duration-days-${companyId}`,
      metricType: "project_type_average_completion_duration_days",
      subjectType: "project_type",
      subjectId: companyId,
      companyId,
      value: projectTypeAverageDurationDays,
      unit: "days",
      direction: "stable",
      confidence: computeDeterministicConfidence({
        sourceCount: projectTypeCount,
        sampleSize: projects.length,
        requiredSampleSize: 5,
      }),
      sourceCount: projectTypeCount,
      sampleSize: projects.length,
      timeWindow,
      calculationMethod: "avg by project_type of estimated_end_date-estimated_start_date",
      evidenceIds: sourceEvidenceIds,
      limitations: projects.length === 0 ? ["No projects found in selected time window."] : [],
      generatedAt: timeWindow.endAt,
    },
  ];

  const traits = [
    {
      traitId: "company-learning-discipline",
      labelKey: "learning.traits.companyLearningDiscipline",
      metricType: "company_recurring_lesson_count" as const,
      confidence: computeDeterministicConfidence({
        sourceCount: recurringLessonCount + vendorPreferenceCount + customerPreferenceCount,
        sampleSize: baselineSample,
        requiredSampleSize: 12,
      }),
      evidenceCount: sourceEvidenceIds.length,
      timeWindow,
      sourceIds: sourceEvidenceIds,
      limitations: [
        "Company learning discipline is based on explicit operational memory capture, not implicit behavior inference.",
      ],
    },
  ];

  const limitations: string[] = [];
  if (baselineSample < 8) {
    limitations.push("Company learning has limited reliability because the observed sample size is below 8 records.");
  }

  return {
    subjectType: "company",
    metrics,
    traits,
    limitations,
  };
}
