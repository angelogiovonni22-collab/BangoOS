import type { WorkforceFinding, WorkforceSignal } from "./workforce-intelligence-types";

const severityRank: Record<WorkforceFinding["severity"], number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function stableId(parts: Array<string | number>) {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

function typeText(type: WorkforceFinding["type"]) {
  return type
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function recommendation(type: WorkforceFinding["type"]) {
  switch (type) {
    case "ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT":
      return "Review assignment board and place the employee on current or upcoming work.";
    case "ACTIVE_CREW_WITHOUT_ASSIGNMENT":
      return "Review crew schedule and assign the crew to an upcoming assignment.";
    case "EMPLOYEE_ASSIGNMENT_OVERLAP":
    case "CREW_ASSIGNMENT_OVERLAP":
      return "Review assignment dates and resolve overlapping windows.";
    case "EMPLOYEE_WITHOUT_ACTIVE_CREW":
      return "Assign the employee to an active crew membership.";
    case "CREW_WITHOUT_ACTIVE_LEAD":
      return "Add a crew lead or supervisor relationship for this active crew.";
    case "ASSIGNMENT_MISSING_PROJECT_CONTEXT":
      return "Verify project relationship data and refresh workforce project context.";
    case "ASSIGNMENT_MISSING_REQUIRED_ENTITY":
      return "Verify required assignment relationships for employee or crew linkage.";
    case "UPCOMING_ASSIGNMENT_WITHOUT_STAFFING":
      return "Staff the upcoming assignment with a valid crew membership or employee assignment.";
    case "STALE_WORKFORCE_RECORD":
    case "WORKFORCE_CONDITION_UNVERIFIABLE_STALE_DATA":
      return "Update stale workforce data before relying on this condition.";
    case "INCOMPLETE_WORKFORCE_RELATIONSHIP":
      return "Verify and repair unresolved workforce relationships.";
    default:
      return "Review this workforce finding and validate related records.";
  }
}

function observation(signal: WorkforceSignal) {
  const firstEntity = signal.affectedEntities[0];
  const subject = firstEntity?.displayName || firstEntity?.entityId || "workforce entity";
  return `${typeText(signal.type)} detected for ${subject}.`;
}

function explanation(signal: WorkforceSignal) {
  if (signal.type === "WORKFORCE_CONDITION_UNVERIFIABLE_STALE_DATA") {
    return "Workforce condition cannot be verified because the last update is stale.";
  }

  if (!signal.dataCompleteness.isComplete) {
    return "Finding is based on incomplete relationship evidence and should be reviewed as data quality.";
  }

  return "Finding is generated from deterministic workforce rules over verified company-scoped records.";
}

function urgencyIsoFromFinding(finding: {
  evidence: Record<string, unknown>;
  freshness: { latestUpdatedAt: string | null };
}) {
  const evidenceDate = finding.evidence["assignmentStartsAt"];
  if (typeof evidenceDate === "string") {
    return evidenceDate;
  }

  return finding.freshness.latestUpdatedAt || "";
}

function dedupeKey(signal: WorkforceSignal) {
  const entityKey = signal.affectedEntities
    .map((entity) => `${entity.entityType}:${entity.entityId}`)
    .sort()
    .join("|");
  const window = typeof signal.evidence["assignmentStartsAt"] === "string"
    ? signal.evidence["assignmentStartsAt"]
    : signal.dataFreshness.latestUpdatedAt || "no_window";
  return `${signal.type}::${entityKey}::${window}`;
}

function evidenceSpecificity(signal: WorkforceSignal) {
  let score = 0;

  for (const value of Object.values(signal.evidence)) {
    if (Array.isArray(value)) {
      score += value.length;
      continue;
    }

    if (value && typeof value === "object") {
      score += Object.keys(value as Record<string, unknown>).length;
      continue;
    }

    if (value !== null && value !== undefined) {
      score += 1;
    }
  }

  return score;
}

function compareSignalPrecedence(left: WorkforceSignal, right: WorkforceSignal) {
  const severityOrder = severityRank[left.severity] - severityRank[right.severity];
  if (severityOrder !== 0) {
    return severityOrder;
  }

  const specificityOrder = evidenceSpecificity(right) - evidenceSpecificity(left);
  if (specificityOrder !== 0) {
    return specificityOrder;
  }

  const confidenceOrder = right.confidence - left.confidence;
  if (confidenceOrder !== 0) {
    return confidenceOrder;
  }

  return left.id.localeCompare(right.id);
}

export function normalizeWorkforceFindings(params: {
  companyId: string;
  signals: WorkforceSignal[];
}): WorkforceFinding[] {
  const deduped = new Map<string, WorkforceSignal>();

  for (const signal of params.signals) {
    const key = dedupeKey(signal);
    const existing = deduped.get(key);

    if (!existing || compareSignalPrecedence(signal, existing) < 0) {
      deduped.set(key, signal);
    }
  }

  const findings = Array.from(deduped.values()).map((signal) => {
    const findingId = stableId([
      "finding",
      params.companyId,
      signal.ruleId,
      signal.ruleVersion,
      dedupeKey(signal),
    ]);

    return {
      id: findingId,
      companyId: params.companyId,
      type: signal.type,
      category: signal.category,
      severity: signal.severity,
      title: typeText(signal.type),
      observation: observation(signal),
      explanation: explanation(signal),
      confidence: signal.confidence,
      affectedEntities: signal.affectedEntities,
      supportingSignalIds: [signal.id],
      evidence: signal.evidence,
      assumptions: signal.dataCompleteness.isComplete
        ? ["Deterministic evaluation uses available company-scoped workforce records."]
        : ["Some relationship context is unavailable or unresolved."],
      limitations: signal.dataFreshness.isStale
        ? ["Record freshness is stale and may reduce certainty."]
        : signal.dataCompleteness.isComplete
          ? []
          : ["Evidence is incomplete and interpreted as a data-quality issue."],
      recommendedNextStep: recommendation(signal.type),
      detectedAt: signal.detectedAt,
      freshness: signal.dataFreshness,
      status: "open",
    } satisfies WorkforceFinding;
  });

  return findings.sort((left, right) => {
    const severityOrder = severityRank[left.severity] - severityRank[right.severity];
    if (severityOrder !== 0) {
      return severityOrder;
    }

    const urgencyOrder = urgencyIsoFromFinding(left).localeCompare(urgencyIsoFromFinding(right));
    if (urgencyOrder !== 0) {
      return urgencyOrder;
    }

    const typeOrder = left.type.localeCompare(right.type);
    if (typeOrder !== 0) {
      return typeOrder;
    }

    const leftName = left.affectedEntities[0]?.displayName || left.affectedEntities[0]?.entityId || "";
    const rightName = right.affectedEntities[0]?.displayName || right.affectedEntities[0]?.entityId || "";
    const nameOrder = leftName.localeCompare(rightName);
    if (nameOrder !== 0) {
      return nameOrder;
    }

    return left.id.localeCompare(right.id);
  });
}
