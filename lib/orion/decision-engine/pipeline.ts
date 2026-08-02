import { computeSignalConfidence } from "./confidence";
import { clamp, stableId } from "./helpers";
import { deriveBusinessImpact } from "./impact";
import { buildAdvisoryRecommendation } from "./recommendations";
import type { BusinessSignal, BusinessSignalInput, DecisionPack } from "./types";

function normalizeEvidence(input: BusinessSignalInput["evidence"]) {
  const seen = new Set<string>();

  return input
    .filter((item) => item.id && item.label && item.source)
    .map((item) => ({
      ...item,
      label: item.label.trim(),
      value: item.value.trim(),
      source: item.source.trim(),
    }))
    .filter((item) => {
      const key = `${item.id}:${item.source}:${item.observedAt}`;
      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function normalizeMissingInformation(items: string[]) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

export function buildBusinessSignal(input: BusinessSignalInput): BusinessSignal {
  const evidence = normalizeEvidence(input.evidence);
  const missingInformation = normalizeMissingInformation(input.missingInformation);
  const confidence = computeSignalConfidence({
    evidence,
    missingInformation,
    freshness: input.freshness,
  });

  const businessImpact = deriveBusinessImpact({
    severity: input.severity,
    freshness: input.freshness,
    missingInformationCount: missingInformation.length,
  });

  const recommendation = buildAdvisoryRecommendation({
    category: input.category,
    severity: input.severity,
    observation: input.observation,
    businessImpact,
    recommendationHint: input.recommendationHint,
  });

  const id = stableId([
    "business-signal",
    input.category,
    input.severity,
    input.observation,
    input.createdAt,
  ]);

  return {
    id,
    category: input.category,
    severity: input.severity,
    confidence: {
      percent: clamp(confidence.percent, 0, 100),
      reasons: confidence.reasons,
    },
    observation: input.observation.trim(),
    businessImpact,
    evidence,
    missingInformation,
    recommendation,
    approvalRequired: recommendation.approvalRequired,
    freshness: input.freshness,
    createdAt: input.createdAt,
  };
}

export function normalizeBusinessSignals(signals: BusinessSignal[]) {
  return [...signals].sort((left, right) => {
    const impactOrder = impactRank(right.businessImpact) - impactRank(left.businessImpact);
    if (impactOrder !== 0) {
      return impactOrder;
    }

    const confidenceOrder = right.confidence.percent - left.confidence.percent;
    if (confidenceOrder !== 0) {
      return confidenceOrder;
    }

    const categoryOrder = left.category.localeCompare(right.category);
    if (categoryOrder !== 0) {
      return categoryOrder;
    }

    return left.id.localeCompare(right.id);
  });
}

function impactRank(impact: BusinessSignal["businessImpact"]) {
  if (impact === "CRITICAL") {
    return 4;
  }

  if (impact === "HIGH") {
    return 3;
  }

  if (impact === "MEDIUM") {
    return 2;
  }

  if (impact === "LOW") {
    return 1;
  }

  return 0;
}

export function buildDecisionPack(signal: BusinessSignal, relatedSignals: BusinessSignal[] = []): DecisionPack {
  const related = relatedSignals
    .filter((item) => item.id !== signal.id)
    .map((item) => item.id)
    .sort((a, b) => a.localeCompare(b));

  return {
    signalId: signal.id,
    observation: signal.observation,
    businessImpact: signal.businessImpact,
    evidence: signal.evidence,
    confidence: signal.confidence,
    missingInformation: signal.missingInformation,
    recommendation: signal.recommendation,
    approvalBoundary: signal.approvalRequired,
    relatedSignals: related,
  };
}
