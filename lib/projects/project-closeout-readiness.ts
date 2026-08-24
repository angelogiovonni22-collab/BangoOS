export type ProjectCloseoutSignals = {
  closeoutStarted: boolean;
  finalPaymentRecorded: boolean;
  customerApprovalRecorded: boolean;
  requiredDocumentsCompleted: boolean;
  permitClosureCompleted: boolean;
  crewRemovalCompleted: boolean;
  equipmentReturnCompleted: boolean;
  openPunchItems: number;
  pendingInspections: number;
  openPermits: number;
};

export type ProjectCloseoutNextAction =
  | "start_closeout"
  | "punch_items"
  | "inspections"
  | "permits"
  | "documents"
  | "final_payment"
  | "customer_approval"
  | "crew_removal"
  | "equipment_return"
  | "complete";

export type ProjectCloseoutReadiness = {
  score: number;
  status: "Ready" | "In progress" | "Blocked" | "Not started";
  checklistCompleted: number;
  checklistTotal: number;
  nextAction: ProjectCloseoutNextAction;
};

export function calculateProjectCloseoutReadiness(signals: ProjectCloseoutSignals): ProjectCloseoutReadiness {
  const openPunchItems = normalizeCount(signals.openPunchItems);
  const pendingInspections = normalizeCount(signals.pendingInspections);
  const openPermits = normalizeCount(signals.openPermits);

  const checklist = [
    signals.finalPaymentRecorded,
    signals.customerApprovalRecorded,
    signals.requiredDocumentsCompleted,
    signals.permitClosureCompleted,
    signals.crewRemovalCompleted,
    signals.equipmentReturnCompleted,
  ];
  const checklistCompleted = checklist.filter(Boolean).length;
  const checklistTotal = checklist.length;

  if (!signals.closeoutStarted) {
    return {
      score: 0,
      status: "Not started",
      checklistCompleted,
      checklistTotal,
      nextAction: "start_closeout",
    };
  }

  const checklistContribution = Math.round((checklistCompleted / checklistTotal) * 72);
  const punchContribution = openPunchItems === 0 ? 10 : 0;
  const inspectionContribution = pendingInspections === 0 ? 9 : 0;
  const permitContribution = openPermits === 0 ? 9 : 0;
  const score = clamp(checklistContribution + punchContribution + inspectionContribution + permitContribution);

  const nextAction: ProjectCloseoutNextAction =
    openPunchItems > 0
      ? "punch_items"
      : pendingInspections > 0
        ? "inspections"
        : openPermits > 0 || !signals.permitClosureCompleted
          ? "permits"
          : !signals.requiredDocumentsCompleted
            ? "documents"
            : !signals.finalPaymentRecorded
              ? "final_payment"
              : !signals.customerApprovalRecorded
                ? "customer_approval"
                : !signals.crewRemovalCompleted
                  ? "crew_removal"
                  : !signals.equipmentReturnCompleted
                    ? "equipment_return"
                    : "complete";

  const blocked = openPunchItems > 0 || pendingInspections > 0 || openPermits > 0;

  return {
    score,
    status: score === 100 ? "Ready" : blocked ? "Blocked" : "In progress",
    checklistCompleted,
    checklistTotal,
    nextAction,
  };
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(Number.isFinite(value) ? value : 0)));
}
