/**
 * Briefing copy constants — all i18n key names used by the briefing engine.
 *
 * These are the translation keys that must exist in the projects locale files.
 * Values must match the entries in locales/en/projects.json and
 * locales/es/projects.json.
 *
 * Keeping keys in a single place prevents typos and makes future locale
 * additions easier to audit.
 */

// ---------------------------------------------------------------------------
// Executive summary keys (one per briefing state)
// ---------------------------------------------------------------------------

export const BRIEFING_SUMMARY_KEYS = {
  healthy: "briefingSummaryHealthy",
  attention: "briefingSummaryAttention",
  critical: "briefingSummaryCritical",
  limited_data: "briefingSummaryLimitedData",
  no_active_work: "briefingSummaryNoActiveWork",
} as const;

// ---------------------------------------------------------------------------
// Focus item keys
// ---------------------------------------------------------------------------

export const BRIEFING_FOCUS_KEYS = {
  tasksDueToday: {
    title: "briefingFocusDueTodayTitle",
    description: "briefingFocusDueTodayDescription",
  },
  overdueTasks: {
    title: "briefingFocusOverdueTitle",
    description: "briefingFocusOverdueDescription",
  },
  blockedTasks: {
    title: "briefingFocusBlockedTitle",
    description: "briefingFocusBlockedDescription",
  },
  unassignedTasks: {
    title: "briefingFocusUnassignedTitle",
    description: "briefingFocusUnassignedDescription",
  },
  overdueInvoices: {
    title: "briefingFocusOverdueInvoicesTitle",
    description: "briefingFocusOverdueInvoicesDescription",
  },
  nearBudget: {
    title: "briefingFocusNearBudgetTitle",
    description: "briefingFocusNearBudgetDescription",
  },
  noTargetDate: {
    title: "briefingFocusNoTargetDateTitle",
    description: "briefingFocusNoTargetDateDescription",
  },
  noDescription: {
    title: "briefingFocusNoDescriptionTitle",
    description: "briefingFocusNoDescriptionDescription",
  },
  noPhotos: {
    title: "briefingFocusNoPhotosTitle",
    description: "briefingFocusNoPhotosDescription",
  },
  tasksDueThisWeek: {
    title: "briefingFocusDueThisWeekTitle",
    description: "briefingFocusDueThisWeekDescription",
  },
} as const;

// ---------------------------------------------------------------------------
// Risk item keys
// ---------------------------------------------------------------------------

export const BRIEFING_RISK_KEYS: Record<
  string,
  { title: string; explanation: string; response: string }
> = {
  risk_overdue_critical: {
    title: "briefingRiskOverdueCriticalTitle",
    explanation: "briefingRiskOverdueCriticalExplanation",
    response: "briefingRiskOverdueCriticalResponse",
  },
  risk_overdue_high: {
    title: "briefingRiskOverdueHighTitle",
    explanation: "briefingRiskOverdueHighExplanation",
    response: "briefingRiskOverdueHighResponse",
  },
  risk_overdue_medium: {
    title: "briefingRiskOverdueMediumTitle",
    explanation: "briefingRiskOverdueMediumExplanation",
    response: "briefingRiskOverdueMediumResponse",
  },
  risk_no_target_date: {
    title: "briefingRiskNoTargetDateTitle",
    explanation: "briefingRiskNoTargetDateExplanation",
    response: "briefingRiskNoTargetDateResponse",
  },
  risk_blocked_high: {
    title: "briefingRiskBlockedHighTitle",
    explanation: "briefingRiskBlockedHighExplanation",
    response: "briefingRiskBlockedHighResponse",
  },
  risk_blocked_medium: {
    title: "briefingRiskBlockedMediumTitle",
    explanation: "briefingRiskBlockedMediumExplanation",
    response: "briefingRiskBlockedMediumResponse",
  },
  risk_no_progress: {
    title: "briefingRiskNoProgressTitle",
    explanation: "briefingRiskNoProgressExplanation",
    response: "briefingRiskNoProgressResponse",
  },
  risk_unassigned_high: {
    title: "briefingRiskUnassignedHighTitle",
    explanation: "briefingRiskUnassignedHighExplanation",
    response: "briefingRiskUnassignedHighResponse",
  },
  risk_unassigned_medium: {
    title: "briefingRiskUnassignedMediumTitle",
    explanation: "briefingRiskUnassignedMediumExplanation",
    response: "briefingRiskUnassignedMediumResponse",
  },
  risk_unassigned_low: {
    title: "briefingRiskUnassignedLowTitle",
    explanation: "briefingRiskUnassignedLowExplanation",
    response: "briefingRiskUnassignedLowResponse",
  },
  risk_invoice_overdue_high: {
    title: "briefingRiskInvoiceOverdueHighTitle",
    explanation: "briefingRiskInvoiceOverdueHighExplanation",
    response: "briefingRiskInvoiceOverdueHighResponse",
  },
  risk_invoice_overdue_medium: {
    title: "briefingRiskInvoiceOverdueMediumTitle",
    explanation: "briefingRiskInvoiceOverdueMediumExplanation",
    response: "briefingRiskInvoiceOverdueMediumResponse",
  },
  risk_over_budget: {
    title: "briefingRiskOverBudgetTitle",
    explanation: "briefingRiskOverBudgetExplanation",
    response: "briefingRiskOverBudgetResponse",
  },
  risk_near_budget: {
    title: "briefingRiskNearBudgetTitle",
    explanation: "briefingRiskNearBudgetExplanation",
    response: "briefingRiskNearBudgetResponse",
  },
  risk_no_budget: {
    title: "briefingRiskNoBudgetTitle",
    explanation: "briefingRiskNoBudgetExplanation",
    response: "briefingRiskNoBudgetResponse",
  },
  risk_no_description: {
    title: "briefingRiskNoDescriptionTitle",
    explanation: "briefingRiskNoDescriptionExplanation",
    response: "briefingRiskNoDescriptionResponse",
  },
  risk_no_photos: {
    title: "briefingRiskNoPhotosTitle",
    explanation: "briefingRiskNoPhotosExplanation",
    response: "briefingRiskNoPhotosResponse",
  },
};

// ---------------------------------------------------------------------------
// Fallback keys (used when a risk ID is not in the table above)
// ---------------------------------------------------------------------------

export const BRIEFING_RISK_FALLBACK = {
  title: "briefingRiskGenericTitle",
  explanation: "briefingRiskGenericExplanation",
  response: "briefingRiskGenericResponse",
} as const;
