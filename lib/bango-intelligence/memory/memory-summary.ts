import type { CompanyDNA, CustomerProfileSummary, MemoryEvidence, MemoryJson, MemoryRecord, MemorySummary, ProjectDNA, RecommendationHistoryEntry } from "./memory-types";

export function buildMemorySummary(records: MemoryRecord[], rankedEvidence: MemoryEvidence[]): MemorySummary {
  const topLessons = uniqueStrings(extractSummaries(records.filter((record) => record.category === "lesson_learned")));
  const knownRisks = uniqueStrings(extractSummaries(records.filter((record) => record.category === "safety_observation" || record.category === "financial_insight")));
  const knownPreferences = uniqueStrings(extractSummaries(records.filter((record) => record.category === "preference" || record.category === "customer_preference" || record.category === "vendor_preference")));
  const knownDecisions = uniqueStrings(extractSummaries(records.filter((record) => record.category === "decision")));
  const knownPatterns = uniqueStrings(extractSummaries(records.filter((record) => record.category === "operational_pattern" || record.category === "project_milestone")));

  return {
    topLessons,
    knownRisks,
    knownPreferences,
    knownDecisions,
    knownPatterns,
    sections: [
      { title: "Top Lessons", items: topLessons },
      { title: "Known Risks", items: knownRisks },
      { title: "Known Preferences", items: knownPreferences },
      { title: "Known Decisions", items: knownDecisions },
      { title: "Known Patterns", items: knownPatterns },
    ],
    memoryCount: records.length,
    categoriesUsed: uniqueCategories(records),
    rankedEvidence,
  };
}

export function buildProjectDNA(records: MemoryRecord[]): ProjectDNA | null {
  const projectRecords = records.filter((record) => record.scope === "project" || record.category === "project_milestone" || record.category === "operational_pattern");
  if (projectRecords.length === 0) {
    return null;
  }

  const confidence = projectRecords.some((record) => record.confidence === "verified")
    ? "high"
    : projectRecords.some((record) => record.confidence === "observed")
      ? "medium"
      : "low";

  return {
    preferredScheduleStyle: deriveStyle(projectRecords, ["schedule", "calendar", "phase"]),
    communicationStyle: deriveStyle(projectRecords, ["email", "text", "phone", "documentation"]),
    changeOrderFrequency: deriveFrequency(projectRecords, "change order"),
    inspectionHistory: deriveFrequency(projectRecords, "inspection"),
    documentationQuality: deriveStyle(projectRecords, ["documentation", "photos", "paperwork"]),
    riskTrend: deriveStyle(projectRecords, ["risk", "delay", "overdue"]),
    budgetTrend: deriveStyle(projectRecords, ["budget", "cost", "variance"]),
    crewReliabilityTrend: deriveStyle(projectRecords, ["crew", "reliability", "attendance"]),
    confidence,
    evidenceCount: projectRecords.length,
  };
}

export function buildCompanyDNA(records: MemoryRecord[]): CompanyDNA {
  const companyRecords = records.filter((record) => record.scope === "company" || record.scope === "global");
  const traits: CompanyDNA["traits"] = [];

  if (matchesAny(companyRecords, ["quality", "defect", "rework"])) traits.push("Quality-first");
  if (matchesAny(companyRecords, ["speed", "fast", "urgent"])) traits.push("Speed-first");
  if (matchesAny(companyRecords, ["budget", "cost", "variance"])) traits.push("Budget-first");
  if (matchesAny(companyRecords, ["documentation", "paperwork", "photos"])) traits.push("Documentation-heavy");
  if (matchesAny(companyRecords, ["inspection", "inspection-heavy"])) traits.push("Inspection-heavy");
  if (matchesAny(companyRecords, ["change order", "scope change"])) traits.push("Change-order-heavy");
  if (matchesAny(companyRecords, ["safety", "incident", "near miss"])) traits.push("Safety-focused");
  if (matchesAny(companyRecords, ["growth", "expansion", "new work"])) traits.push("Growth-focused");
  if (matchesAny(companyRecords, ["risk", "caution", "approval"])) traits.push("Risk-averse");

  const confidence = companyRecords.some((record) => record.confidence === "verified")
    ? "high"
    : companyRecords.some((record) => record.confidence === "observed")
      ? "medium"
      : "low";

  return { traits, confidence, evidenceCount: companyRecords.length };
}

export function buildCustomerProfileSummary(records: MemoryRecord[]): CustomerProfileSummary | null {
  const customerRecords = records.filter((record) => record.scope === "customer" || record.category === "customer_preference");
  if (customerRecords.length === 0) {
    return null;
  }

  const traits = uniqueStrings([
    ...extractSummaries(customerRecords.filter((record) => containsAny(record, ["phone", "call"]))).map((value) => `prefers phone: ${value}`),
    ...extractSummaries(customerRecords.filter((record) => containsAny(record, ["slow approval", "approval"]))).map((value) => `approval pattern: ${value}`),
    ...extractSummaries(customerRecords.filter((record) => containsAny(record, ["quick pay", "payment"]))).map((value) => `payment pattern: ${value}`),
    ...extractSummaries(customerRecords.filter((record) => containsAny(record, ["documentation", "paperwork"]))).map((value) => `documentation style: ${value}`),
    ...extractSummaries(customerRecords.filter((record) => containsAny(record, ["change", "scope"]))).map((value) => `change pattern: ${value}`),
    ...extractSummaries(customerRecords.filter((record) => containsAny(record, ["inspection"]))).map((value) => `inspection pattern: ${value}`),
  ]);

  const confidence = customerRecords.some((record) => record.confidence === "verified")
    ? "high"
    : customerRecords.some((record) => record.confidence === "observed")
      ? "medium"
      : "low";

  return { traits, confidence, evidenceCount: customerRecords.length };
}

export function buildDeterministicMemoryBriefing(
  memorySummary: MemorySummary,
  companyDNA: CompanyDNA,
  projectDNA: ProjectDNA | null,
  customerSummary: CustomerProfileSummary | null,
): string {
  const lines = [
    `Memory count: ${memorySummary.memoryCount}`,
    `Categories used: ${memorySummary.categoriesUsed.join(", ") || "none"}`,
    `Company DNA: ${companyDNA.traits.join(", ") || "unsupported"} (${companyDNA.confidence})`,
    `Project DNA: ${projectDNA ? [projectDNA.preferredScheduleStyle, projectDNA.communicationStyle, projectDNA.changeOrderFrequency, projectDNA.inspectionHistory, projectDNA.documentationQuality, projectDNA.riskTrend, projectDNA.budgetTrend, projectDNA.crewReliabilityTrend].join(" | ") : "not enough evidence"}`,
    `Customer profile: ${customerSummary ? customerSummary.traits.join(", ") : "not enough evidence"}`,
  ];

  return lines.join("\n");
}

export function buildRecommendationHistory(records: MemoryRecord[]): RecommendationHistoryEntry[] {
  return records
    .filter((record) => record.category === "recommendation")
    .map((record) => ({
      id: record.id,
      memoryId: record.id,
      companyId: record.companyId,
      projectId: record.projectId ?? null,
      customerId: record.customerId ?? null,
      status: record.recommendationStatus ?? "ignored",
      recordedAt: record.updatedAt,
      reviewedBy: record.createdBy,
      notes: record.summary,
    }));
}

function extractSummaries(records: MemoryRecord[]): string[] {
  return records.map((record) => record.summary.trim()).filter(Boolean);
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}

function uniqueCategories(records: MemoryRecord[]): MemoryRecord["category"][] {
  return [...new Set(records.map((record) => record.category))];
}

function deriveStyle(records: MemoryRecord[], keywords: string[]): string {
  const matched = records.find((record) => containsAny(record, keywords));
  return matched ? matched.summary : "not enough evidence";
}

function deriveFrequency(records: MemoryRecord[], keyword: string): string {
  const matches = records.filter((record) => containsAny(record, [keyword]));
  if (matches.length === 0) {
    return "not enough evidence";
  }
  if (matches.length >= 5) {
    return "frequent";
  }
  if (matches.length >= 2) {
    return "repeating";
  }
  return "observed once";
}

function matchesAny(records: MemoryRecord[], keywords: string[]): boolean {
  return records.some((record) => containsAny(record, keywords));
}

function containsAny(record: MemoryRecord, keywords: string[]): boolean {
  const text = `${record.title} ${record.summary} ${memoryJsonToText(record.details)} ${record.tags.join(" ")}`.toLowerCase();
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function memoryJsonToText(value: MemoryJson): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}
