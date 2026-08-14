import type {
  OrionOrganizationalMemoryRecord,
  OrionSignalMemoryInput,
  OrionMemorySignature,
} from "./memory-types";

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeArray(values: string[]): string[] {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function buildTimeWindowClass(iso: string): string {
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    return "unknown_window";
  }

  const weekday = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"][new Date(timestamp).getUTCDay()];
  return `weekday_${weekday}`;
}

function buildMissingInformationClass(keys: string[]): string {
  if (keys.length === 0) {
    return "none_missing";
  }

  if (keys.length <= 2) {
    return "limited_missing";
  }

  return "material_missing";
}

function stableKey(parts: Array<string | number>): string {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

export function buildMemorySignature(input: OrionSignalMemoryInput): OrionMemorySignature {
  const normalizedEvidenceKeys = normalizeArray(input.normalizedEvidenceKeys);
  const affectedEntityTypes = normalizeArray(input.entityReferences.map((entity) => entity.entityType));
  const missingInformationClass = buildMissingInformationClass(normalizeArray(input.dataCompleteness.missingInformationKeys));
  const timeWindowClass = buildTimeWindowClass(input.detectedAt);

  const key = stableKey([
    "orion-memory-signature",
    input.companyId,
    normalizeText(input.category),
    normalizeText(input.signalType),
    affectedEntityTypes.join("|"),
    normalizeText(input.ruleId),
    normalizeText(input.ruleVersion),
    normalizedEvidenceKeys.join("|"),
    input.businessImpact,
    timeWindowClass,
    missingInformationClass,
  ]);

  return {
    companyId: input.companyId,
    category: normalizeText(input.category),
    signalType: normalizeText(input.signalType),
    affectedEntityTypes,
    ruleId: normalizeText(input.ruleId),
    ruleVersion: normalizeText(input.ruleVersion),
    normalizedEvidenceKeys,
    businessImpactClass: input.businessImpact,
    timeWindowClass,
    missingInformationClass,
    key,
  };
}

export function buildMemorySignatureFromRecord(record: OrionOrganizationalMemoryRecord): OrionMemorySignature {
  return buildMemorySignature({
    signalId: record.sourceSignalId,
    companyId: record.companyId,
    category: record.category,
    signalType: record.signalType,
    entityReferences: record.entityReferences,
    normalizedObservation: record.normalizedObservation,
    normalizedEvidenceKeys: record.normalizedEvidenceKeys,
    businessImpact: record.businessImpact,
    severity: record.severity,
    freshness: record.freshness,
    detectedAt: record.detectedAt,
    dataCompleteness: record.dataCompleteness,
    ruleId: record.ruleId,
    ruleVersion: record.ruleVersion,
  });
}

export function buildDeterministicMemoryId(input: {
  companyId: string;
  sourceSignalId: string;
  sourceDecisionPackId: string;
  ruleId: string;
  ruleVersion: string;
  memoryVersion: string;
}): string {
  return stableKey([
    "orion-memory-record",
    input.companyId,
    input.sourceSignalId,
    input.sourceDecisionPackId,
    input.ruleId,
    input.ruleVersion,
    input.memoryVersion,
  ]);
}
