export type ProjectExecutionSignals = {
  complianceScore: number;
  overdueTasks: number;
  blockedTasks: number;
  activeTasks: number;
  documentationPresent: boolean;
};

export type ProjectExecutionReadiness = {
  score: number;
  status: "Ready" | "Watch" | "Action required";
  nextAction: "compliance" | "blocked" | "overdue" | "documentation" | "execution";
};

export function calculateProjectExecutionReadiness(signals: ProjectExecutionSignals): ProjectExecutionReadiness {
  const complianceScore = clamp(signals.complianceScore);
  const overdueTasks = count(signals.overdueTasks);
  const blockedTasks = count(signals.blockedTasks);
  const activeTasks = count(signals.activeTasks);

  const complianceContribution = Math.round(complianceScore * 0.45);
  const taskContribution = Math.max(0, 35 - Math.min(20, blockedTasks * 5) - Math.min(15, overdueTasks * 3));
  const documentationContribution = signals.documentationPresent ? 10 : 0;
  const activityContribution = activeTasks > 0 ? 10 : 5;
  const score = clamp(complianceContribution + taskContribution + documentationContribution + activityContribution);

  const nextAction = complianceScore < 55
    ? "compliance"
    : blockedTasks > 0
      ? "blocked"
      : overdueTasks > 0
        ? "overdue"
        : !signals.documentationPresent
          ? "documentation"
          : "execution";

  return {
    score,
    status: score >= 85 ? "Ready" : score >= 60 ? "Watch" : "Action required",
    nextAction,
  };
}

function count(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}
