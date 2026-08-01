export type ProjectHealthStatus = "on_track" | "at_risk" | "behind" | "complete" | "not_enough_data";

export type ProjectHealthTone = "brand" | "success" | "warning" | "danger" | "neutral";

export type ProjectHealthInput = {
  projectStatus: string | null;
  progressPercent: number;
  targetCompletionDate: string | null;
  budget: number | null;
  spent: number;
};

export type ProjectHealthResult = {
  status: ProjectHealthStatus;
  statusLabel: string;
  score: number | null;
  summary: string;
  tone: ProjectHealthTone;
  progressLabel: string;
  scheduleCondition: string;
  budgetCondition: string;
  dueDateCondition: string;
};

export function calculateProjectHealth(input: ProjectHealthInput): ProjectHealthResult {
  const status = (input.projectStatus || "").trim().toLowerCase();
  const progress = clampPercentage(input.progressPercent);
  const dueState = evaluateDueDateState(input.targetCompletionDate, progress, status);
  const budgetState = evaluateBudgetState(input.budget, input.spent);

  if (status === "completed") {
    return {
      status: "complete",
      statusLabel: "Complete",
      score: 100,
      summary: "Project is marked complete. Final closeout and reconciliation are the remaining focus.",
      tone: "success",
      progressLabel: `${progress}%`,
      scheduleCondition: "Completed",
      budgetCondition: budgetState.label,
      dueDateCondition: dueState.label,
    };
  }

  if (!input.targetCompletionDate && (input.budget === null || input.budget <= 0) && progress === 0) {
    return {
      status: "not_enough_data",
      statusLabel: "Not Enough Data",
      score: null,
      summary: "Add a valid target completion date or budget baseline to improve project health confidence.",
      tone: "neutral",
      progressLabel: "0%",
      scheduleCondition: "Limited baseline",
      budgetCondition: "Budget baseline missing",
      dueDateCondition: "Date unavailable",
    };
  }

  const score = calculateScore(progress, dueState.key, budgetState.key);

  if (dueState.key === "behind" || budgetState.key === "behind") {
    return {
      status: "behind",
      statusLabel: "Behind",
      score,
      summary: "Schedule or budget conditions show this project needs immediate recovery actions.",
      tone: "danger",
      progressLabel: `${progress}%`,
      scheduleCondition: dueState.scheduleCondition,
      budgetCondition: budgetState.label,
      dueDateCondition: dueState.label,
    };
  }

  if (dueState.key === "at_risk" || budgetState.key === "at_risk") {
    return {
      status: "at_risk",
      statusLabel: "At Risk",
      score,
      summary: "The project is trending toward risk and should be monitored with near-term corrective actions.",
      tone: "warning",
      progressLabel: `${progress}%`,
      scheduleCondition: dueState.scheduleCondition,
      budgetCondition: budgetState.label,
      dueDateCondition: dueState.label,
    };
  }

  return {
    status: "on_track",
    statusLabel: "On Track",
    score,
    summary: "Current project signals indicate stable performance against the current baseline.",
    tone: "brand",
    progressLabel: `${progress}%`,
    scheduleCondition: dueState.scheduleCondition,
    budgetCondition: budgetState.label,
    dueDateCondition: dueState.label,
  };
}

type ConditionStateKey = "on_track" | "at_risk" | "behind" | "unknown";

type DueDateState = {
  key: ConditionStateKey;
  label: string;
  scheduleCondition: string;
};

function evaluateDueDateState(targetCompletionDate: string | null, progress: number, status: string): DueDateState {
  if (status === "cancelled") {
    return {
      key: "unknown",
      label: "Date unavailable",
      scheduleCondition: "Project cancelled",
    };
  }

  const parsedDate = parseSafeDate(targetCompletionDate);
  if (!parsedDate) {
    return {
      key: "unknown",
      label: "Date unavailable",
      scheduleCondition: progress > 0 ? "Work in progress" : "Not started",
    };
  }

  const now = new Date();
  const utcToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffMs = parsedDate.getTime() - utcToday;
  const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (!Number.isFinite(daysUntilDue) || Math.abs(daysUntilDue) > 3650) {
    return {
      key: "unknown",
      label: "Date unavailable",
      scheduleCondition: "Date needs review",
    };
  }

  if (daysUntilDue < 0 && progress < 100) {
    return {
      key: "behind",
      label: `${Math.abs(daysUntilDue)}d overdue`,
      scheduleCondition: "Late to target",
    };
  }

  if (daysUntilDue <= 14 && progress < 70) {
    return {
      key: "at_risk",
      label: `${Math.max(daysUntilDue, 0)}d remaining`,
      scheduleCondition: "Compressed runway",
    };
  }

  return {
    key: "on_track",
    label: `${Math.max(daysUntilDue, 0)}d remaining`,
    scheduleCondition: progress >= 60 ? "Advancing steadily" : "Early phase",
  };
}

type BudgetState = {
  key: ConditionStateKey;
  label: string;
};

function evaluateBudgetState(budget: number | null, spent: number): BudgetState {
  if (budget === null || budget <= 0) {
    return {
      key: "unknown",
      label: "Budget baseline missing",
    };
  }

  const ratio = spent / budget;

  if (!Number.isFinite(ratio)) {
    return {
      key: "unknown",
      label: "Budget data unavailable",
    };
  }

  if (ratio > 1) {
    return {
      key: "behind",
      label: "Over budget",
    };
  }

  if (ratio >= 0.85) {
    return {
      key: "at_risk",
      label: "Near budget limit",
    };
  }

  return {
    key: "on_track",
    label: "Within budget",
  };
}

function calculateScore(progress: number, dueState: ConditionStateKey, budgetState: ConditionStateKey) {
  let score = progress;

  if (dueState === "on_track") {
    score += 15;
  }

  if (dueState === "at_risk") {
    score -= 15;
  }

  if (dueState === "behind") {
    score -= 30;
  }

  if (budgetState === "on_track") {
    score += 10;
  }

  if (budgetState === "at_risk") {
    score -= 10;
  }

  if (budgetState === "behind") {
    score -= 20;
  }

  return clampPercentage(score);
}

function parseSafeDate(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2100) {
    return null;
  }

  return parsed;
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
