export type ProjectComplianceSignals = {
  permitsTotal: number;
  openPermits: number;
  inspectionsTotal: number;
  pendingInspections: number;
  documentsTotal: number;
};

export type ProjectComplianceReadiness = {
  score: number;
  status: "Ready" | "Watch" | "Setup required";
  permitState: "Clear" | "Action required" | "Not recorded";
  inspectionState: "Clear" | "Pending" | "Not recorded";
  documentState: "Available" | "Missing";
};

export function calculateProjectComplianceReadiness(signals: ProjectComplianceSignals): ProjectComplianceReadiness {
  const permitsTotal = normalizeCount(signals.permitsTotal);
  const openPermits = Math.min(permitsTotal, normalizeCount(signals.openPermits));
  const inspectionsTotal = normalizeCount(signals.inspectionsTotal);
  const pendingInspections = Math.min(inspectionsTotal, normalizeCount(signals.pendingInspections));
  const documentsTotal = normalizeCount(signals.documentsTotal);

  const permitState = permitsTotal === 0 ? "Not recorded" : openPermits > 0 ? "Action required" : "Clear";
  const inspectionState = inspectionsTotal === 0 ? "Not recorded" : pendingInspections > 0 ? "Pending" : "Clear";
  const documentState = documentsTotal > 0 ? "Available" : "Missing";

  const score =
    (permitsTotal === 0 ? 0 : openPermits > 0 ? 20 : 35) +
    (inspectionsTotal === 0 ? 0 : pendingInspections > 0 ? 20 : 35) +
    (documentsTotal > 0 ? 30 : 0);

  return {
    score,
    status: score >= 85 ? "Ready" : score >= 55 ? "Watch" : "Setup required",
    permitState,
    inspectionState,
    documentState,
  };
}

function normalizeCount(value: number) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
