export type ProjectCloseoutSignals = {
  closeoutStarted: boolean;
  closeoutReady: boolean;
  projectProgress: number;
  openPunchItems: number;
  pendingInspections: number;
  openPermits: number;
};

export type ProjectCloseoutNextAction =
  | "start_closeout"
  | "punch_items"
  | "inspections"
  | "permits"
  | "finish_work"
  | "closeout_checklist"
  | "complete";

export type ProjectCloseoutReadiness = {
  score: number;
  status: "Ready" | "In progress" | "Blocked" | "Not started";
  nextAction: ProjectCloseoutNextAction;
};

export function calculateProjectCloseoutReadiness(signals: ProjectCloseoutSignals): ProjectCloseoutReadiness {
  const projectProgress = clamp(signals.projectProgress);
  const openPunchItems = normalizeCount(signals.openPunchItems);
  const pendingInspections = normalizeCount(signals.pendingInspections);
  const openPermits = normalizeCount(signals.openPermits);

  if (!signals.closeoutStarted) {
    return { score: 0, status: "Not started", nextAction: "start_closeout" };
  }

  const progressContribution = Math.round(projectProgress * 0.4);
  const punchContribution = openPunchItems === 0 ? 15 : 0;
  const inspectionContribution = pendingInspections === 0 ? 15 : 0;
  const permitContribution = openPermits === 0 ? 15 : 0;
  const checklistContribution = signals.closeoutReady ? 15 : 0;
  const score = clamp(progressContribution + punchContribution + inspectionContribution + permitContribution + checklistContribution);

  const nextAction: ProjectCloseoutNextAction =
    openPunchItems > 0
      ? "punch_items"
      : pendingInspections > 0
        ? "inspections"
        : openPermits > 0
          ? "permits"
          : projectProgress < 100
            ? "finish_work"
            : !signals.closeoutReady
              ? "closeout_checklist"
              : "complete";

  const blocked = openPunchItems > 0 || pendingInspections > 0 || openPermits > 0;
  const ready = signals.closeoutReady && projectProgress === 100 && !blocked;

  return {
    score,
    status: ready ? "Ready" : blocked ? "Blocked" : "In progress",
    nextAction,
  };
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}
