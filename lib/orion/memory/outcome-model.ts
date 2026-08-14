import type {
  OrionMemoryAgeClass,
  OrionMemoryConfidence,
  OrionOrganizationalMemoryRecord,
  OrionSimilarityResult,
} from "./memory-types";

export function resolveMemoryAgeClass(params: { detectedAt: string; nowIso: string }): OrionMemoryAgeClass {
  const detectedAt = Date.parse(params.detectedAt);
  const now = Date.parse(params.nowIso);

  if (Number.isNaN(detectedAt) || Number.isNaN(now) || now < detectedAt) {
    return "unknown";
  }

  const ageDays = (now - detectedAt) / (1000 * 60 * 60 * 24);

  if (ageDays <= 30) {
    return "recent";
  }

  if (ageDays <= 120) {
    return "established";
  }

  if (ageDays <= 365) {
    return "historical";
  }

  return "stale";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function computeMemoryConfidence(params: {
  matches: OrionSimilarityResult[];
  matchedRecords: OrionOrganizationalMemoryRecord[];
  nowIso: string;
}): OrionMemoryConfidence {
  if (params.matches.length === 0 || params.matchedRecords.length === 0) {
    return {
      score: 0,
      level: "low",
      reasons: ["No sufficiently similar historical memory records were found."],
    };
  }

  const reasons: string[] = [];

  const averageSimilarity = average(params.matches.map((match) => match.score));
  const sampleScore = Math.min(1, params.matches.length / 5);

  const verifiedOutcomes = params.matchedRecords.filter((record) => Boolean(record.outcome.verifiedAt)).length;
  const verificationScore = verifiedOutcomes / params.matchedRecords.length;

  const completeRecords = params.matchedRecords.filter((record) => record.dataCompleteness.isComplete).length;
  const completenessScore = completeRecords / params.matchedRecords.length;

  const freshnessScores = params.matchedRecords.map((record) => {
    const ageClass = resolveMemoryAgeClass({ detectedAt: record.detectedAt, nowIso: params.nowIso });
    if (ageClass === "recent") {
      return 1;
    }

    if (ageClass === "established") {
      return 0.85;
    }

    if (ageClass === "historical") {
      return 0.65;
    }

    if (ageClass === "stale") {
      return 0.4;
    }

    return 0.25;
  });
  const freshnessScore = average(freshnessScores);

  const unresolvedCount = params.matchedRecords.filter((record) => record.outcome.state === "unresolved").length;
  const unresolvedPenalty = unresolvedCount / params.matchedRecords.length;

  const distinctOutcomeStates = new Set(params.matchedRecords.map((record) => record.outcome.state));
  const conflictingOutcomesPenalty = distinctOutcomeStates.size >= 3 ? 0.1 : 0;

  const scoreRaw =
    averageSimilarity * 0.35
    + sampleScore * 0.2
    + verificationScore * 0.2
    + completenessScore * 0.15
    + freshnessScore * 0.1
    - unresolvedPenalty * 0.08
    - conflictingOutcomesPenalty;

  const score = Number(Math.max(0, Math.min(1, scoreRaw)).toFixed(4));

  reasons.push(`Similarity strength average is ${averageSimilarity.toFixed(2)} across ${params.matches.length} matches.`);
  reasons.push(`${verifiedOutcomes}/${params.matchedRecords.length} matched memories have verified outcomes.`);
  reasons.push(`${completeRecords}/${params.matchedRecords.length} matched memories are data-complete.`);

  if (unresolvedCount > 0) {
    reasons.push(`${unresolvedCount} matched memories remain unresolved, reducing confidence.`);
  }

  if (conflictingOutcomesPenalty > 0) {
    reasons.push("Matched memories contain conflicting outcome states.");
  }

  const level: OrionMemoryConfidence["level"] =
    score >= 0.75 ? "high" :
      score >= 0.45 ? "medium" : "low";

  return {
    score,
    level,
    reasons,
  };
}
