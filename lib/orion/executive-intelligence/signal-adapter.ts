import type { BusinessSignalInput } from "../decision-engine";
import type { ExecutiveSignalFact, SignalAdapterOutput } from "./executive-intelligence-types";

function normalizeCategory(category: ExecutiveSignalFact["category"]): BusinessSignalInput["category"] {
  switch (category) {
    case "workforce":
      return "Workforce";
    case "schedule":
      return "Schedule";
    case "equipment":
      return "Equipment";
    case "customer":
      return "Customer";
    case "financial":
      return "Financial";
    case "safety":
      return "Safety";
    default:
      return "Productivity";
  }
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function adaptFixtureSignals(params: {
  companyId: string;
  facts: ExecutiveSignalFact[];
}): SignalAdapterOutput {
  const limitations: string[] = [];
  const unsupported: string[] = [];
  const adapted: SignalAdapterOutput["adapted"] = [];

  for (const fact of params.facts) {
    if (!fact.companyId || fact.companyId !== params.companyId) {
      unsupported.push(`Cross-company signal fact rejected for ${fact.canonicalConditionType}.`);
      continue;
    }

    if (!fact.observation.trim() || fact.evidence.length === 0) {
      unsupported.push(`Incomplete signal fact rejected for ${fact.canonicalConditionType}.`);
      continue;
    }

    const input: BusinessSignalInput = {
      category: normalizeCategory(fact.category),
      severity: fact.severity,
      observation: normalizeText(fact.observation),
      evidence: fact.evidence.map((item) => ({
        id: item.id,
        label: normalizeText(item.label),
        value: normalizeText(item.value),
        source: normalizeText(item.source),
        observedAt: item.observedAt,
      })),
      missingInformation: fact.missingInformation.map((item) => normalizeText(item)).filter(Boolean),
      freshness: fact.freshness,
      createdAt: fact.createdAt,
      recommendationHint: `Review ${fact.canonicalConditionType}`,
    };

    if (input.missingInformation.length > 0) {
      limitations.push(`Signal ${fact.canonicalConditionType} is missing ${input.missingInformation.length} context fields.`);
    }

    adapted.push({ fact, input });
  }

  return {
    adapted,
    limitations: [...new Set(limitations)].sort((a, b) => a.localeCompare(b)),
    unsupported: [...new Set(unsupported)].sort((a, b) => a.localeCompare(b)),
  };
}
