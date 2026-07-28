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
  actionLabelKey: string;
  projectName?: string;
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
  period: "morning" | "afternoon" | "evening";
  timeLabel: string;
  titleKey: string;
  projectName: string;
  location: string;
  employeesAssigned: number;
  status: "confirmed" | "pending" | "travel" | "complete";
  href: string;
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
  weather: WeatherSnapshot;
  businessScore: AIBusinessScoreSnapshot;
  recommendations: AIRecommendation[];
  widgetDefinitions: DashboardWidgetDefinition[];
};
