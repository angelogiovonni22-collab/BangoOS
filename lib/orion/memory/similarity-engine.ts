import { buildMemorySignature, buildMemorySignatureFromRecord } from "./memory-signature";
import type {
  OrionMemorySimilarityWeights,
  OrionSimilarityFactorResult,
  OrionSimilarityLevel,
  OrionSimilarityResult,
} from "./similarity-types";
import {
  ORION_MEMORY_SIMILARITY_THRESHOLDS,
  ORION_MEMORY_SIMILARITY_WEIGHTS,
  type OrionOrganizationalMemoryRecord,
  type OrionSignalMemoryInput,
} from "./memory-types";

function overlapRatio(left: string[], right: string[]): number {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);

  if (union.size === 0) {
    return 0;
  }

  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) {
      intersection += 1;
    }
  }

  return intersection / union.size;
}

function levelFromScore(score: number): OrionSimilarityLevel {
  if (score >= ORION_MEMORY_SIMILARITY_THRESHOLDS.exact_match) {
    return "exact_match";
  }

  if (score >= ORION_MEMORY_SIMILARITY_THRESHOLDS.strong_match) {
    return "strong_match";
  }

  if (score >= ORION_MEMORY_SIMILARITY_THRESHOLDS.moderate_match) {
    return "moderate_match";
  }

  if (score >= ORION_MEMORY_SIMILARITY_THRESHOLDS.weak_match) {
    return "weak_match";
  }

  return "unrelated";
}

function factorResult(params: {
  factor: keyof OrionMemorySimilarityWeights;
  weight: number;
  ratio: number;
  matched: boolean;
}): OrionSimilarityFactorResult {
  const contribution = Number((params.weight * Math.max(0, Math.min(1, params.ratio))).toFixed(4));
  return {
    factor: params.factor,
    weight: params.weight,
    contribution,
    matched: params.matched,
  };
}

function primaryEntityKey(input: OrionSignalMemoryInput | OrionOrganizationalMemoryRecord): string {
  const first = [...input.entityReferences]
    .sort((a, b) => `${a.entityType}:${a.entityId}`.localeCompare(`${b.entityType}:${b.entityId}`))[0];

  return first ? `${first.entityType}:${first.entityId}` : "none";
}

export function scoreMemorySimilarity(
  currentSignal: OrionSignalMemoryInput,
  memoryRecord: OrionOrganizationalMemoryRecord,
): OrionSimilarityResult {
  const signalSignature = buildMemorySignature(currentSignal);
  const memorySignature = buildMemorySignatureFromRecord(memoryRecord);

  const evidenceOverlap = overlapRatio(signalSignature.normalizedEvidenceKeys, memorySignature.normalizedEvidenceKeys);
  const entityTypeOverlap = overlapRatio(signalSignature.affectedEntityTypes, memorySignature.affectedEntityTypes);

  const sameCategory = signalSignature.category === memorySignature.category;
  const sameSignalType = signalSignature.signalType === memorySignature.signalType;
  const sameRule = signalSignature.ruleId === memorySignature.ruleId && signalSignature.ruleVersion === memorySignature.ruleVersion;
  const sameBusinessImpact = signalSignature.businessImpactClass === memorySignature.businessImpactClass;
  const sameSeverity = currentSignal.severity === memoryRecord.severity;
  const sameFreshness = currentSignal.freshness === memoryRecord.freshness;
  const sameMissingPattern = signalSignature.missingInformationClass === memorySignature.missingInformationClass;
  const samePrimaryEntity = primaryEntityKey(currentSignal) === primaryEntityKey(memoryRecord);

  const factors = [
    factorResult({ factor: "sameCategory", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.sameCategory, ratio: sameCategory ? 1 : 0, matched: sameCategory }),
    factorResult({ factor: "sameSignalType", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.sameSignalType, ratio: sameSignalType ? 1 : 0, matched: sameSignalType }),
    factorResult({ factor: "sameEntityType", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.sameEntityType, ratio: entityTypeOverlap, matched: entityTypeOverlap > 0 }),
    factorResult({ factor: "sameRule", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.sameRule, ratio: sameRule ? 1 : 0, matched: sameRule }),
    factorResult({ factor: "overlappingEvidence", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.overlappingEvidence, ratio: evidenceOverlap, matched: evidenceOverlap > 0 }),
    factorResult({ factor: "businessImpact", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.businessImpact, ratio: sameBusinessImpact ? 1 : 0, matched: sameBusinessImpact }),
    factorResult({ factor: "severity", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.severity, ratio: sameSeverity ? 1 : 0, matched: sameSeverity }),
    factorResult({ factor: "freshness", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.freshness, ratio: sameFreshness ? 1 : 0, matched: sameFreshness }),
    factorResult({ factor: "missingPattern", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.missingPattern, ratio: sameMissingPattern ? 1 : 0, matched: sameMissingPattern }),
    factorResult({ factor: "samePrimaryEntity", weight: ORION_MEMORY_SIMILARITY_WEIGHTS.samePrimaryEntity, ratio: samePrimaryEntity ? 1 : 0, matched: samePrimaryEntity }),
  ];

  const score = Number(factors.reduce((sum, factor) => sum + factor.contribution, 0).toFixed(4));
  const level = levelFromScore(score);

  const limitations: string[] = [];
  if (evidenceOverlap === 0) {
    limitations.push("No overlapping normalized evidence keys between current signal and memory.");
  }

  if (!sameRule) {
    limitations.push("Rule or rule version does not match exactly.");
  }

  return {
    memoryId: memoryRecord.id,
    score,
    level,
    matchedFactors: factors.filter((factor) => factor.matched),
    unmatchedFactors: factors.filter((factor) => !factor.matched),
    limitations,
  };
}

export function rankSimilarMemories(params: {
  currentSignal: OrionSignalMemoryInput;
  memories: OrionOrganizationalMemoryRecord[];
  minimumScore?: number;
}): OrionSimilarityResult[] {
  const minimumScore = params.minimumScore ?? ORION_MEMORY_SIMILARITY_THRESHOLDS.weak_match;

  const scored = params.memories
    .map((memory) => scoreMemorySimilarity(params.currentSignal, memory))
    .filter((result) => result.score >= minimumScore)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.memoryId.localeCompare(right.memoryId);
    });

  return scored;
}
