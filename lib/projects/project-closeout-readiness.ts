export type ProjectCloseoutSignals = {
  closeoutStarted: boolean;
  finalPaymentRecorded: boolean;
  customerApprovalRecorded: boolean;
  requiredDocumentsCompleted: boolean;
  permitClosureCompleted: boolean;
  crewRemovalCompleted: boolean;
  equipmentReturnCompleted: boolean;
  openPunchItems: number;
};

export type ProjectCloseoutReadiness = {
  score: number;
  status: "Ready" | "In progress" | "Not started";
  checklistCompleted: number;
  checklistTotal: number;
  punchState: "Clear" | "Open items";
};

export function calculateProjectCloseoutReadiness(signals: ProjectCloseoutSignals): ProjectCloseoutReadiness {
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
  const openPunchItems = normalizeCount(signals.openPunchItems);
  const checklistScore = Math.round((checklistCompleted / checklistTotal) * 85);
  const punchScore = openPunchItems === 0 ? 15 : 0;
  const score = signals.closeoutStarted ? checklistScore + punchScore : 0;

  return {
    score,
    status: score === 100 ? "Ready" : signals.closeoutStarted ? "In progress" : "Not started",
    checklistCompleted,
    checklistTotal,
    punchState: openPunchItems === 0 ? "Clear" : "Open items",
  };
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
