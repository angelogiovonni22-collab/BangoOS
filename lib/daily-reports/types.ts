export const DAILY_REPORT_STATUSES = ["draft", "submitted", "reviewed", "approved"] as const;
export type DailyReportStatus = (typeof DAILY_REPORT_STATUSES)[number];

export const DAILY_REPORT_SHIFTS = ["day", "swing", "night"] as const;
export type DailyReportShift = (typeof DAILY_REPORT_SHIFTS)[number];

export const SITE_CONDITIONS = ["dry", "wet", "muddy", "windy", "frozen", "restricted"] as const;
export type SiteCondition = (typeof SITE_CONDITIONS)[number];

export const WEATHER_CONDITIONS = ["sunny", "cloudy", "rain", "storm", "snow", "mixed"] as const;
export type WeatherCondition = (typeof WEATHER_CONDITIONS)[number];

export const DELAY_CATEGORIES = ["weather", "material", "equipment", "client", "utility", "inspection", "safety", "other"] as const;
export type DelayCategory = (typeof DELAY_CATEGORIES)[number];

export const SAFETY_SEVERITIES = ["low", "medium", "high", "critical"] as const;
export type SafetySeverity = (typeof SAFETY_SEVERITIES)[number];

export const SAFETY_STATUSES = ["open", "monitoring", "resolved"] as const;
export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

export const ATTACHMENT_CATEGORIES = ["progress", "safety", "quality", "delivery", "incident", "other"] as const;
export type AttachmentCategory = (typeof ATTACHMENT_CATEGORIES)[number];

export const PRICING_PROVIDERS = [
  "Lowe's",
  "Home Depot",
  "Menards",
  "Sherwin-Williams",
  "ABC Supply",
  "84 Lumber",
  "Local Supplier",
] as const;
export type PricingProvider = (typeof PRICING_PROVIDERS)[number];

export type DailyReportHeader = {
  projectId: string;
  projectName: string;
  date: string;
  shift: DailyReportShift;
  superintendentId: string;
  superintendentName: string;
  projectManagerName: string;
  weather: WeatherCondition;
  temperatureF: number;
  siteConditions: SiteCondition;
  overallStatus: DailyReportStatus;
};

export type LaborEntry = {
  id: string;
  crewName: string;
  employeeName: string;
  trade: string;
  scheduled: boolean;
  present: boolean;
  late: boolean;
  regularHours: number;
  overtimeHours: number;
  notes: string;
};

export type WorkCompletedItem = {
  id: string;
  activity: string;
  quantity: number;
  unit: string;
  percentComplete: number;
  productionNotes: string;
  milestoneCompleted: boolean;
};

export type MaterialItem = {
  id: string;
  delivery: string;
  supplier: string;
  quantity: number;
  unit: string;
  receivedTime: string;
  shortages: boolean;
  rejected: boolean;
  notes: string;
};

export type EquipmentUsageItem = {
  id: string;
  equipmentId: string;
  operatorName: string;
  runtimeHours: number;
  idleHours: number;
  downtimeHours: number;
  maintenanceNotes: string;
};

export type SafetyItem = {
  id: string;
  type: "toolbox_talk" | "inspection" | "incident" | "near_miss" | "ppe" | "corrective_action";
  attendees: number;
  severity: SafetySeverity;
  status: SafetyStatus;
  notes: string;
};

export type DelayItem = {
  id: string;
  category: DelayCategory;
  durationHours: number;
  description: string;
  impact: string;
  correctiveAction: string;
};

export type AttachmentItem = {
  id: string;
  fileName: string;
  caption: string;
  category: AttachmentCategory;
  uploadedAt: string;
};

export type TimelineEvent = {
  id: string;
  happenedAt: string;
  eventType: "crew_arrival" | "delivery" | "inspection" | "incident" | "delay" | "shift_complete";
  description: string;
};

export type SchedulingPreload = {
  assignmentId: string;
  assignmentTitle: string;
  plannedHours: number;
  scheduledProjectId: string;
  scheduledProjectName: string;
  assignedCrewNames: string[];
  scheduledEmployees: string[];
  supervisor: string;
};

export type LaborTotals = {
  scheduledWorkers: number;
  presentWorkers: number;
  absentWorkers: number;
  lateWorkers: number;
  overtimeWorkers: number;
  totalLaborHours: number;
};

export type DailyReport = {
  id: string;
  reportNumber: string;
  header: DailyReportHeader;
  schedulingPreload: SchedulingPreload | null;
  labor: LaborEntry[];
  laborTotals: LaborTotals;
  workCompleted: WorkCompletedItem[];
  materials: MaterialItem[];
  equipment?: EquipmentUsageItem[];
  safety: SafetyItem[];
  delays: DelayItem[];
  attachments: AttachmentItem[];
  timeline: TimelineEvent[];
  aiSummary: string;
  aiSummaryVersion: number;
  submittedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type DailyReportUpsertInput = {
  header: DailyReportHeader;
  schedulingPreload: SchedulingPreload | null;
  labor: LaborEntry[];
  workCompleted: WorkCompletedItem[];
  materials: MaterialItem[];
  equipment?: EquipmentUsageItem[];
  safety: SafetyItem[];
  delays: DelayItem[];
  attachments: AttachmentItem[];
  timeline: TimelineEvent[];
  aiSummaryVersion: number;
};

export type DailyReportSortKey = "date_desc" | "date_asc" | "project_asc" | "status";

export type DailyReportFilters = {
  date: string;
  projectId: string;
  superintendentId: string;
  status: DailyReportStatus | "all";
  query: string;
  sortBy: DailyReportSortKey;
  page: number;
  pageSize: number;
};

export type DailyReportListResult = {
  items: DailyReport[];
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
};

export type DailyReportDashboardMetrics = {
  reportsCreatedToday: number;
  reportsPendingReview: number;
  reportsSubmitted: number;
  lateReports: number;
  safetyIncidents: number;
  delaysLogged: number;
  laborHours: number;
  weatherSnapshot: string;
};

export type DailyReportAnalytics = {
  laborHours: number;
  productionUnits: number;
  delayEvents: number;
  incidentCount: number;
  completionRate: number;
  averageSubmissionHours: number;
};

export type DailyReportDashboardPayload = {
  metrics: DailyReportDashboardMetrics;
  analytics: DailyReportAnalytics;
  weatherSnapshotText: string;
  projectOptions: Array<{ id: string; name: string }>;
  superintendentOptions: Array<{ id: string; name: string }>;
};

export type ValidationResult = {
  isValid: boolean;
  errors: string[];
};
