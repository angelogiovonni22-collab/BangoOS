import type { BusinessImpact, BusinessSignalSeverity, SignalFreshness } from "./types";

function severityBase(severity: BusinessSignalSeverity) {
  if (severity === "critical") {
    return 5;
  }

  if (severity === "high") {
    return 4;
  }

  if (severity === "medium") {
    return 3;
  }

  if (severity === "low") {
    return 2;
  }

  return 1;
}

export function deriveBusinessImpact(params: {
  severity: BusinessSignalSeverity;
  freshness: SignalFreshness;
  missingInformationCount: number;
}): BusinessImpact {
  let score = severityBase(params.severity);

  if (params.freshness === "stale") {
    score += 1;
  }

  if (params.freshness === "unknown") {
    score += 1;
  }

  if (params.missingInformationCount >= 3) {
    score += 1;
  }

  if (score <= 1) {
    return "NONE";
  }

  if (score === 2) {
    return "LOW";
  }

  if (score === 3) {
    return "MEDIUM";
  }

  if (score === 4) {
    return "HIGH";
  }

  return "CRITICAL";
}
