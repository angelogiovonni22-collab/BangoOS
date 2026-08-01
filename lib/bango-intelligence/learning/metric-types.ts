export type LearningMetricType =
  | "crew_assigned_task_count"
  | "crew_completed_task_count"
  | "crew_overdue_task_count"
  | "crew_average_completion_percent"
  | "crew_hours_variance_ratio"
  | "crew_projects_worked_count"
  | "vendor_linked_memory_count"
  | "vendor_verified_preference_count"
  | "vendor_positive_outcome_count"
  | "vendor_negative_outcome_count"
  | "vendor_usage_count"
  | "customer_verified_preference_count"
  | "customer_change_observation_count"
  | "customer_payment_observation_count"
  | "project_completion_percent"
  | "project_overdue_task_ratio"
  | "project_blocked_task_ratio"
  | "project_estimate_to_invoice_ratio"
  | "project_change_order_count"
  | "project_change_order_value"
  | "project_documentation_volume"
  | "company_recurring_lesson_count"
  | "company_recurring_schedule_risk_count"
  | "company_documentation_gap_count"
  | "company_vendor_preference_count"
  | "company_customer_preference_count"
  | "company_crew_utilization_signal_count"
  | "project_type_average_contract_amount"
  | "project_type_average_estimated_cost"
  | "project_type_average_change_order_count"
  | "project_type_average_completion_duration_days";

export type LearningSubjectType =
  | "company"
  | "project"
  | "customer"
  | "crew"
  | "employee"
  | "vendor"
  | "project_type";

export type LearningDirection = "improving" | "stable" | "declining" | "insufficient_data";

export type LearningConfidence = "high" | "medium" | "low" | "insufficient";

export type LearningTimeWindowName = "recent_30_days" | "recent_90_days" | "recent_12_months" | "all_time";

export type LearningTimeWindow = {
  name: LearningTimeWindowName;
  startAt: string | null;
  endAt: string;
};

export type LearningMetricRecord = {
  id: string;
  metricType: LearningMetricType;
  subjectType: LearningSubjectType;
  subjectId: string;
  companyId: string;
  value: number | string | boolean | null;
  unit: string;
  direction: LearningDirection;
  confidence: LearningConfidence;
  sourceCount: number;
  sampleSize: number;
  timeWindow: LearningTimeWindow;
  calculationMethod: string;
  evidenceIds: string[];
  limitations: string[];
  generatedAt: string;
};

export type LearningTrait = {
  traitId: string;
  labelKey: string;
  metricType: LearningMetricType;
  confidence: LearningConfidence;
  evidenceCount: number;
  timeWindow: LearningTimeWindow;
  sourceIds: string[];
  limitations: string[];
};
