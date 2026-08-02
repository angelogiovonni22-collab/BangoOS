import { clamp } from "./helpers";
import type {
  BusinessImpact,
  BusinessSignal,
  BusinessSignalCategory,
  ContributionWeights,
  SignalContributionResult,
} from "./types";

const CATEGORY_WEIGHTS: Record<BusinessSignalCategory, ContributionWeights> = {
  Schedule: { Operations: 0.55, Financial: 0.15, Workforce: 0.15, Safety: 0.05, Equipment: 0.05, Customer: 0.05 },
  Financial: { Operations: 0.1, Financial: 0.7, Workforce: 0.05, Safety: 0.0, Equipment: 0.05, Customer: 0.1 },
  Workforce: { Operations: 0.25, Financial: 0.05, Workforce: 0.55, Safety: 0.1, Equipment: 0.0, Customer: 0.05 },
  Safety: { Operations: 0.2, Financial: 0.05, Workforce: 0.15, Safety: 0.55, Equipment: 0.05, Customer: 0.0 },
  Equipment: { Operations: 0.2, Financial: 0.1, Workforce: 0.1, Safety: 0.1, Equipment: 0.45, Customer: 0.05 },
  Customer: { Operations: 0.15, Financial: 0.1, Workforce: 0.05, Safety: 0.0, Equipment: 0.0, Customer: 0.7 },
  Documents: { Operations: 0.2, Financial: 0.2, Workforce: 0.1, Safety: 0.1, Equipment: 0.0, Customer: 0.4 },
  Communication: { Operations: 0.35, Financial: 0.1, Workforce: 0.15, Safety: 0.05, Equipment: 0.05, Customer: 0.3 },
  Compliance: { Operations: 0.2, Financial: 0.15, Workforce: 0.15, Safety: 0.35, Equipment: 0.05, Customer: 0.1 },
  Weather: { Operations: 0.55, Financial: 0.15, Workforce: 0.1, Safety: 0.1, Equipment: 0.05, Customer: 0.05 },
  Productivity: { Operations: 0.45, Financial: 0.15, Workforce: 0.25, Safety: 0.05, Equipment: 0.05, Customer: 0.05 },
  Quality: { Operations: 0.25, Financial: 0.2, Workforce: 0.1, Safety: 0.1, Equipment: 0.0, Customer: 0.35 },
};

function impactMultiplier(impact: BusinessImpact) {
  if (impact === "NONE") {
    return 10;
  }

  if (impact === "LOW") {
    return 30;
  }

  if (impact === "MEDIUM") {
    return 55;
  }

  if (impact === "HIGH") {
    return 78;
  }

  return 95;
}

function freshnessMultiplier(freshness: BusinessSignal["freshness"]) {
  if (freshness === "live") {
    return 1;
  }

  if (freshness === "partial") {
    return 0.85;
  }

  if (freshness === "stale") {
    return 0.65;
  }

  return 0.5;
}

export function computePulseContributions(signal: BusinessSignal): SignalContributionResult {
  const weights = CATEGORY_WEIGHTS[signal.category];
  const impact = impactMultiplier(signal.businessImpact);
  const freshness = freshnessMultiplier(signal.freshness);
  const confidence = signal.confidence.percent / 100;

  const contributions = {
    Operations: clamp(Math.round(weights.Operations * impact * freshness * confidence), 0, 100),
    Financial: clamp(Math.round(weights.Financial * impact * freshness * confidence), 0, 100),
    Workforce: clamp(Math.round(weights.Workforce * impact * freshness * confidence), 0, 100),
    Safety: clamp(Math.round(weights.Safety * impact * freshness * confidence), 0, 100),
    Equipment: clamp(Math.round(weights.Equipment * impact * freshness * confidence), 0, 100),
    Customer: clamp(Math.round(weights.Customer * impact * freshness * confidence), 0, 100),
  };

  return {
    signalId: signal.id,
    contributions,
    weights,
    impactMultiplier: impact,
    freshnessMultiplier: freshness,
    confidenceMultiplier: confidence,
  };
}
