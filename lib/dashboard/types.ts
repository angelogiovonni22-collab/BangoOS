export type TrendDirection = "up" | "down" | "flat";

export type MetricValueKind = "number" | "currency" | "score";

export type WidgetId =
  | "kpi"
  | "schedule"
  | "project-health"
  | "weather"
  | "activity"
  | "business-score"
  | "command-center";

export type DashboardMetric = {
  id: string;
  icon: string;
  titleKey: string;
  value: number;
  valueKind: MetricValueKind;
  href: string;
  tooltipKey: string;
  displayValueKey?: string;
  trendPercent?: number;
  subtitleKey?: string;
  trendLabelKey?: string;
  trendDirection?: TrendDirection;
};

export type DashboardActivityItem = {
  id: string;
  icon: string;
  category: "customer" | "project" | "sitecam" | "estimate" | "invoice" | "team";
  timestampMinutesAgo: number;
  user: string;
  avatarLabel: string;
  actionLabelKey: string | null;
  actionLabel?: string | null;
  projectName?: string;
  href?: string;
};

export type ProjectHealthRow = {
  id: string;
  projectName: string;
  healthScore: number;
  budgetStatusKey: string;
  scheduleStatusKey: string;
  lastPhotoUpload: string;
  lastDailyReport: string;
  currentPhase: string;
  riskIndicator: "low" | "medium" | "high";
  href: string;
};

export type ProjectHealthSummary = {
  onScheduleCount: number;
  atRiskCount: number;
  behindScheduleCount: number;
  projects: ProjectHealthRow[];
};

export type ScheduleEvent = {
  id: string;
  period: "morning" | "afternoon" | "evening" | "all_day" | "time_unavailable";
  timeLabel: string;
  titleKey: string | null;
  title?: string;
  projectName: string;
  location: string;
  employeesAssigned: number;
  status: "confirmed" | "pending" | "travel" | "complete";
  href: string;
  occurredAt?: string | null;
};

export type WeatherSnapshot = {
  location: string;
  temperatureF: number;
  conditionKey: string;
  windMph: number;
  rainProbabilityPercent: number;
  highF: number;
  lowF: number;
  tomorrow: {
    conditionKey: string;
    highF: number;
    lowF: number;
    rainProbabilityPercent: number;
  };
};

export type BusinessScoreBreakdownItem = {
  id: "projects" | "financial" | "scheduling" | "documentation" | "safety";
  labelKey: string;
  score: number;
  detailsKey: string;
};

export type AIBusinessScoreSnapshot = {
  score: number;
  ratingKey: string;
  breakdown: BusinessScoreBreakdownItem[];
};

export type BusinessHealthSummaryItem = {
  id: "projects" | "financial" | "scheduling" | "documentation" | "safety";
  labelKey: string;
  state: "healthy" | "attention" | "restricted" | "unavailable";
  detailsKey: string;
};

export type BusinessHealthSummary = {
  items: BusinessHealthSummaryItem[];
};

export type AIRecommendationAction = {
  id: string;
  labelKey: string;
  intent: "primary" | "secondary" | "ghost";
};

export type AIRecommendation = {
  id: string;
  icon: string;
  priority: "critical" | "high" | "medium" | "low";
  timestampMinutesAgo: number;
  messageKey: string;
  actions: AIRecommendationAction[];
};

export type DashboardLayoutState = {
  order: WidgetId[];
  hidden: WidgetId[];
  collapsed: WidgetId[];
};

export type DashboardWidgetDefinition = {
  id: WidgetId;
  titleKey: string;
  descriptionKey: string;
};

export type ExecutiveDashboardData = {
  metrics: DashboardMetric[];
  activities: DashboardActivityItem[];
  projectHealth: ProjectHealthSummary;
  schedule: ScheduleEvent[];
  weather: WeatherSnapshot | null;
  businessScore: AIBusinessScoreSnapshot | null;
  businessSummary: BusinessHealthSummary | null;
  recommendations: AIRecommendation[];
  widgetDefinitions: DashboardWidgetDefinition[];
};

export type DashboardSectionId = WidgetId | "weather";

export type DashboardSectionErrors = Partial<Record<DashboardSectionId, string>>;
