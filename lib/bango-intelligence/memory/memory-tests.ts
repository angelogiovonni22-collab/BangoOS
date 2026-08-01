import { InMemoryMemoryProvider } from "./memory-provider";
import { buildCompanyDNA, buildCustomerProfileSummary, buildDeterministicMemoryBriefing, buildMemorySummary, buildProjectDNA } from "./memory-summary";
import { retrieveRankedMemoryEvidence } from "./memory-query";
import type { MemoryRecord, MemoryRetrievalQuery } from "./memory-types";

export function makeMemoryFixtureRecords(): MemoryRecord[] {
  return [
    {
      id: "m-global-1",
      scope: "global",
      category: "operational_pattern",
      companyId: "company-a",
      title: "Weekly planning cadence",
      summary: "Runs weekly planning meetings on Monday mornings.",
      details: "The superintendent expects Monday planning and Friday lookahead reviews.",
      importance: "high",
      confidence: "verified",
      createdBy: "user-1",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-20T10:00:00.000Z",
      sourceReferences: [{ id: "src-1", label: "meeting note", type: "document", href: null }],
      tags: ["schedule", "planning"],
      status: "active",
    },
    {
      id: "m-project-1",
      scope: "project",
      category: "lesson_learned",
      companyId: "company-a",
      projectId: "project-a",
      title: "Change order lesson",
      summary: "Approve change orders early to avoid schedule slip.",
      details: "Late approvals caused rework and delayed inspections.",
      importance: "critical",
      confidence: "observed",
      createdBy: "user-2",
      createdAt: "2026-07-15T10:00:00.000Z",
      updatedAt: "2026-07-25T10:00:00.000Z",
      sourceReferences: [{ id: "src-2", label: "project review", type: "document", href: null }],
      tags: ["change order", "inspection", "delay"],
      status: "active",
    },
    {
      id: "m-customer-1",
      scope: "customer",
      category: "customer_preference",
      companyId: "company-a",
      customerId: "customer-a",
      title: "Customer phone preference",
      summary: "Prefers a phone call before written updates.",
      details: "Slow approvals but quick response when called directly.",
      importance: "high",
      confidence: "verified",
      createdBy: "user-3",
      createdAt: "2026-07-18T10:00:00.000Z",
      updatedAt: "2026-07-28T10:00:00.000Z",
      sourceReferences: [{ id: "src-3", label: "customer call", type: "call", href: null }],
      tags: ["phone", "approval", "documentation"],
      status: "active",
    },
    {
      id: "m-company-1",
      scope: "company",
      category: "financial_insight",
      companyId: "company-a",
      title: "Budget pressure",
      summary: "Company prefers budget control over rapid scope expansion.",
      details: "Cost variance has stayed negative on recent jobs.",
      importance: "medium",
      confidence: "observed",
      createdBy: "user-4",
      createdAt: "2026-07-10T10:00:00.000Z",
      updatedAt: "2026-07-29T10:00:00.000Z",
      sourceReferences: [{ id: "src-4", label: "financial review", type: "report", href: null }],
      tags: ["budget", "variance", "cost"],
      status: "active",
      roleRestrictions: [{ deniedRoles: ["superintendent"], prohibitedCategories: ["financial_insight"] }],
    },
    {
      id: "m-company-2",
      scope: "company",
      category: "decision",
      companyId: "company-a",
      title: "Inspection-first decision",
      summary: "The team decided to front-load inspections on quality-sensitive jobs.",
      details: "This reduced rework on the last two projects.",
      importance: "high",
      confidence: "verified",
      createdBy: "user-5",
      createdAt: "2026-07-12T10:00:00.000Z",
      updatedAt: "2026-07-30T10:00:00.000Z",
      sourceReferences: [{ id: "src-5", label: "ops decision", type: "document", href: null }],
      tags: ["inspection", "quality", "rework"],
      status: "active",
    },
    {
      id: "m-company-3",
      scope: "company",
      category: "recommendation",
      companyId: "company-a",
      title: "Crew check-in recommendation",
      summary: "Use morning crew check-ins to reduce schedule drift.",
      details: "This recommendation was ignored last week.",
      importance: "low",
      confidence: "draft",
      createdBy: "user-6",
      createdAt: "2026-07-14T10:00:00.000Z",
      updatedAt: "2026-07-15T10:00:00.000Z",
      sourceReferences: [{ id: "src-6", label: "superintendent note", type: "note", href: null }],
      tags: ["crew", "schedule"],
      status: "active",
    },
    {
      id: "m-other-company",
      scope: "company",
      category: "preference",
      companyId: "company-b",
      title: "Other company record",
      summary: "Must never appear in company-a retrieval.",
      details: "Cross-company isolation check.",
      importance: "critical",
      confidence: "verified",
      createdBy: "user-7",
      createdAt: "2026-07-01T10:00:00.000Z",
      updatedAt: "2026-07-31T10:00:00.000Z",
      sourceReferences: [{ id: "src-7", label: "private note", type: "note", href: null }],
      tags: ["isolated"],
      status: "active",
    },
  ];
}

export async function runMemoryModuleChecks(): Promise<void> {
  const provider = new InMemoryMemoryProvider(makeMemoryFixtureRecords());
  const query: MemoryRetrievalQuery = {
    companyId: "company-a",
    scope: ["company", "project", "customer", "global"],
    projectId: "project-a",
    customerId: "customer-a",
    maxResults: 10,
    roleId: "superintendent",
    requestType: "narrate_briefing",
  };

  const records = await provider.findRecords(query);
  const rankedEvidence = retrieveRankedMemoryEvidence(records, query, {
    roleId: "superintendent",
    allowedCategories: [],
    deniedCategories: [],
    canReadRestrictedFinancials: false,
    canReadRestrictedHR: false,
  });
  const summary = buildMemorySummary(records, rankedEvidence);
  const companyDNA = buildCompanyDNA(records);
  const projectDNA = buildProjectDNA(records);
  const customer = buildCustomerProfileSummary(records);

  void buildDeterministicMemoryBriefing(summary, companyDNA, projectDNA, customer);
}
