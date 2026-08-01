import type { BangoEvidence, BangoRoleDefinition } from "../core/context-types";
import type { MemoryProvider } from "./memory-provider";
import { buildCompanyDNA, buildCustomerProfileSummary, buildDeterministicMemoryBriefing, buildMemorySummary, buildProjectDNA, buildRecommendationHistory } from "./memory-summary";
import { buildMemoryCapabilities } from "./memory-filters";
import { retrieveRankedMemoryEvidence } from "./memory-query";
import type { MemoryRecord, MemoryRetrievalQuery, MemoryRetrievalResult } from "./memory-types";

export type { MemoryProvider } from "./memory-provider";

export type MemoryServiceContext = {
  provider: MemoryProvider;
  companyId: string;
  role: BangoRoleDefinition;
  allowedCapabilities?: string[];
  requestType: string;
  projectId?: string | null;
  customerId?: string | null;
  userId?: string | null;
  taskId?: string | null;
  phaseId?: string | null;
  categories?: MemoryRetrievalQuery["categories"];
  maxResults?: number;
};

export async function retrieveMemoryContext(context: MemoryServiceContext): Promise<MemoryRetrievalResult> {
  const capabilities = buildMemoryCapabilities(context.role.roleId);
  const query: MemoryRetrievalQuery = {
    companyId: context.companyId,
    projectId: context.projectId ?? null,
    customerId: context.customerId ?? null,
    userId: context.userId ?? null,
    taskId: context.taskId ?? null,
    phaseId: context.phaseId ?? null,
    categories: context.categories,
    maxResults: context.maxResults ?? 12,
    roleId: context.role.roleId,
    allowedCapabilities: context.allowedCapabilities,
    requestType: context.requestType,
  };

  const retrievalStartedAt = Date.now();
  const records = await context.provider.findRecords(query);
  const retrievalDurationMs = Date.now() - retrievalStartedAt;

  const rankingStartedAt = Date.now();
  const rankedEvidence = retrieveRankedMemoryEvidence(records, query, capabilities);
  const rankingDurationMs = Date.now() - rankingStartedAt;

  const summaryStartedAt = Date.now();
  const summary = buildMemorySummary(records, rankedEvidence);
  const projectDNA = buildProjectDNA(records);
  const companyDNA = buildCompanyDNA(records);
  const customerProfileSummary = buildCustomerProfileSummary(records);
  const recommendationHistory = buildRecommendationHistory(records);
  const summaryDurationMs = Date.now() - summaryStartedAt;

  return {
    records,
    rankedEvidence,
    summary,
    projectDNA,
    companyDNA,
    customerProfileSummary,
    recommendationHistory,
    audit: {
      memoryCount: records.length,
      categoriesUsed: summary.categoriesUsed,
      rankingDurationMs,
      retrievalDurationMs,
      summaryDurationMs,
    },
  };
}

export function buildMemoryBriefingLineup(result: MemoryRetrievalResult): string {
  return buildDeterministicMemoryBriefing(result.summary, result.companyDNA, result.projectDNA, result.customerProfileSummary);
}

export function createMemoryEvidenceFromBusinessContext(evidence: BangoEvidence[]): MemoryRecord[] {
  return evidence.map((item) => ({
    id: item.id,
    scope: item.projectId ? "project" : "company",
    category: "operational_pattern",
    companyId: item.companyId,
    projectId: item.projectId,
    customerId: null,
    userId: null,
    taskId: null,
    phaseId: null,
    title: item.label,
    summary: String(item.value ?? item.label),
    details: item.label,
    importance: item.sensitivity === "restricted" ? "high" : "medium",
    confidence: "observed",
    createdBy: item.sourceId,
    createdAt: item.timestamp ?? new Date().toISOString(),
    updatedAt: item.timestamp ?? new Date().toISOString(),
    sourceReferences: [{ id: item.sourceId, label: item.label, type: item.sourceType, href: item.route }],
    tags: [item.sourceType],
    status: "active",
  }));
}
