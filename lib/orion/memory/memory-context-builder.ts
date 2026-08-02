import {
  ORION_MEMORY_DEFAULTS,
  ORION_MEMORY_SIMILARITY_THRESHOLDS,
  type OrionHistoricalContextResult,
  type OrionOrganizationalMemoryRecord,
  type OrionPatternSummary,
  type OrionSimilarityResult,
} from "./memory-types";
import { computeMemoryConfidence, resolveMemoryAgeClass } from "./outcome-model";

function dominantSimilarity(matches: OrionSimilarityResult[]): OrionHistoricalContextResult["similarityLevel"] {
  if (matches.length === 0) {
    return "unrelated";
  }

  const strongest = matches[0].score;
  if (strongest >= ORION_MEMORY_SIMILARITY_THRESHOLDS.exact_match) {
    return "exact_match";
  }

  if (strongest >= ORION_MEMORY_SIMILARITY_THRESHOLDS.strong_match) {
    return "strong_match";
  }

  if (strongest >= ORION_MEMORY_SIMILARITY_THRESHOLDS.moderate_match) {
    return "moderate_match";
  }

  if (strongest >= ORION_MEMORY_SIMILARITY_THRESHOLDS.weak_match) {
    return "weak_match";
  }

  return "unrelated";
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildPatternSummaries(params: {
  records: OrionOrganizationalMemoryRecord[];
  nowIso: string;
}): OrionPatternSummary[] {
  const { records } = params;
  const sampleMinimum = ORION_MEMORY_DEFAULTS.patternMinimumSampleSize;
  const windowDays = ORION_MEMORY_DEFAULTS.patternWindowDays;

  if (records.length < sampleMinimum) {
    return [];
  }

  const patterns: OrionPatternSummary[] = [];

  const entityCounter = new Map<string, number>();
  for (const record of records) {
    for (const entity of record.entityReferences) {
      if (!entity.companyId || entity.companyId !== record.companyId) {
        continue;
      }

      const key = `${entity.entityType}:${entity.entityId}`;
      entityCounter.set(key, (entityCounter.get(key) ?? 0) + 1);
    }
  }

  for (const [key, count] of entityCounter.entries()) {
    if (count >= sampleMinimum) {
      const [entityType] = key.split(":");
      patterns.push({
        key: `repeated_entity_${key}`,
        statement: `${count} similar prior signals involved the same ${entityType} entity.`,
        sampleSize: count,
        windowDays,
        evidence: [key],
      });
    }
  }

  const weekdayCounter = new Map<string, number>();
  for (const record of records) {
    const timestamp = Date.parse(record.detectedAt);
    if (Number.isNaN(timestamp)) {
      continue;
    }

    const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(timestamp).getUTCDay()];
    weekdayCounter.set(weekday, (weekdayCounter.get(weekday) ?? 0) + 1);
  }

  for (const [weekday, count] of weekdayCounter.entries()) {
    if (count >= sampleMinimum) {
      patterns.push({
        key: `repeated_weekday_${weekday.toLowerCase()}`,
        statement: `${count} similar prior signals occurred on ${weekday}.`,
        sampleSize: count,
        windowDays,
        evidence: [weekday],
      });
    }
  }

  const missingUpdateCount = records.filter((record) => record.normalizedEvidenceKeys.includes("missing_update")).length;
  if (missingUpdateCount >= sampleMinimum) {
    patterns.push({
      key: "repeated_missing_update",
      statement: `${missingUpdateCount} similar prior signals reported repeated missing updates.`,
      sampleSize: missingUpdateCount,
      windowDays,
      evidence: ["missing_update"],
    });
  }

  const scheduleCompressionCount = records.filter((record) =>
    record.signalType === "schedule_compression" || record.normalizedEvidenceKeys.includes("schedule_compression"),
  ).length;
  if (scheduleCompressionCount >= sampleMinimum) {
    patterns.push({
      key: "repeated_schedule_compression",
      statement: `${scheduleCompressionCount} similar prior signals involved schedule compression.`,
      sampleSize: scheduleCompressionCount,
      windowDays,
      evidence: ["schedule_compression"],
    });
  }

  const equipmentWarningCount = records.filter((record) =>
    record.category.toLowerCase() === "equipment" && record.normalizedEvidenceKeys.includes("inspection_warning"),
  ).length;
  if (equipmentWarningCount >= sampleMinimum) {
    patterns.push({
      key: "repeated_equipment_maintenance_warning",
      statement: `${equipmentWarningCount} similar prior signals involved equipment inspection warnings.`,
      sampleSize: equipmentWarningCount,
      windowDays,
      evidence: ["inspection_warning"],
    });
  }

  const approvalDelayCount = records.filter((record) =>
    record.normalizedEvidenceKeys.includes("approval_delay") &&
    record.entityReferences.some((entity) => entity.entityType === "customer"),
  ).length;
  if (approvalDelayCount >= sampleMinimum) {
    patterns.push({
      key: "repeated_customer_approval_delay",
      statement: `${approvalDelayCount} similar prior signals involved customer approval delay.`,
      sampleSize: approvalDelayCount,
      windowDays,
      evidence: ["approval_delay", "customer"],
    });
  }

  const actionCounter = new Map<string, number>();
  for (const record of records) {
    const isVerifiedOutcome = Boolean(record.outcome.verifiedAt);
    if (!isVerifiedOutcome) {
      continue;
    }

    for (const action of record.actionsTaken) {
      actionCounter.set(action, (actionCounter.get(action) ?? 0) + 1);
    }
  }

  for (const [action, count] of actionCounter.entries()) {
    if (count >= sampleMinimum) {
      patterns.push({
        key: `repeated_action_${action.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`,
        statement: `${count} similar prior cases repeated the same corrective action: ${action}.`,
        sampleSize: count,
        windowDays,
        evidence: [action],
      });
    }
  }

  const unresolvedCount = records.filter((record) => record.outcome.state === "unresolved").length;
  if (unresolvedCount >= sampleMinimum) {
    patterns.push({
      key: "repeated_unresolved_condition",
      statement: `${unresolvedCount} similar prior cases remained unresolved.`,
      sampleSize: unresolvedCount,
      windowDays,
      evidence: ["unresolved"],
    });
  }

  return patterns.sort((left, right) => left.key.localeCompare(right.key));
}

export function buildHistoricalContext(params: {
  currentSignalId: string;
  matches: OrionSimilarityResult[];
  matchedRecords: OrionOrganizationalMemoryRecord[];
  nowIso: string;
}): OrionHistoricalContextResult {
  const strongestMatchScore = params.matches[0]?.score ?? 0;
  const commonEvidence = sortedUnique(params.matchedRecords.flatMap((record) => record.normalizedEvidenceKeys));
  const commonOutcomes = sortedUnique(params.matchedRecords.map((record) => record.outcome.state)) as OrionHistoricalContextResult["commonOutcomes"];
  const commonActions = sortedUnique(params.matchedRecords.flatMap((record) => record.actionsTaken));

  const patterns = buildPatternSummaries({
    records: params.matchedRecords,
    nowIso: params.nowIso,
  });

  const confidence = computeMemoryConfidence({
    matches: params.matches,
    matchedRecords: params.matchedRecords,
    nowIso: params.nowIso,
  });

  const freshnessValues = params.matchedRecords.map((record) => resolveMemoryAgeClass({ detectedAt: record.detectedAt, nowIso: params.nowIso }));
  const freshness = freshnessValues.includes("recent")
    ? "recent"
    : freshnessValues.includes("established")
      ? "established"
      : freshnessValues.includes("historical")
        ? "historical"
        : freshnessValues.includes("stale")
          ? "stale"
          : "unknown";

  const limitations = sortedUnique([
    ...params.matches.flatMap((match) => match.limitations),
    ...(patterns.length === 0 ? ["Not enough matched samples to assert recurring deterministic patterns."] : []),
  ]);

  return {
    currentSignalId: params.currentSignalId,
    matchedMemoryIds: params.matches.map((match) => match.memoryId),
    matchCount: params.matches.length,
    strongestMatchScore,
    similarityLevel: dominantSimilarity(params.matches),
    commonEvidence,
    commonOutcomes,
    commonActions,
    observedPatterns: patterns,
    limitations,
    confidence,
    freshness,
    generatedAt: params.nowIso,
  };
}
