import { InMemoryMemoryProvider, retrieveRankedMemoryEvidence, buildMemorySummary, buildCompanyDNA, buildProjectDNA, buildCustomerProfileSummary, buildDeterministicMemoryBriefing } from "../memory/memory-index";
import { makeMemoryFixtureRecords } from "../memory/memory-tests";
import { buildMemoryCapabilities } from "../memory/memory-filters";
import { retrieveMemoryContext } from "../memory/memory-service";
import type { MemoryRetrievalQuery } from "../memory/memory-types";
import type { BangoRoleDefinition } from "../core/context-types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

function describe(label: string, fn: () => void | Promise<void>): void {
  console.log(`\n${label}`);
  void fn();
}

const role: BangoRoleDefinition = {
  roleId: "superintendent",
  displayNameKey: "role.superintendent",
  descriptionKey: "role.superintendentDescription",
  version: "1.0.0",
  enabled: true,
  supportedRequestTypes: ["narrate_briefing", "explain_health", "explain_risk"],
  requiredContextScopes: ["project"],
  requiredFutureContextScopes: [],
  allowedCapabilities: [],
  deniedCapabilities: [],
  approvalPolicy: { defaultLevel: "none_required", capabilityOverrides: {} },
  riskClassification: "low",
  groundingRequirements: {
    requireDeterministicBriefing: true,
    requireDeterministicIntelligence: true,
    requiredEvidenceSourceTypes: [],
    minimumEvidenceCount: 0,
  },
};

async function main(): Promise<void> {
  const provider = new InMemoryMemoryProvider(makeMemoryFixtureRecords());
  const query: MemoryRetrievalQuery = {
    companyId: "company-a",
    scope: ["global", "company", "project", "customer"],
    projectId: "project-a",
    customerId: "customer-a",
    roleId: "superintendent",
    requestType: "narrate_briefing",
    maxResults: 10,
  };

  await describe("Test 1: Scope filtering and company isolation", async () => {
    const records = await provider.findRecords(query);
    assert(records.every((record) => record.companyId === "company-a"), "Only company-a records are returned");
    assert(!records.some((record) => record.companyId === "company-b"), "Cross-company records are excluded");
  });

  await describe("Test 2: Importance ranking prefers critical records", async () => {
    const records = await provider.findRecords(query);
    const capabilities = buildMemoryCapabilities("superintendent");
    const ranked = retrieveRankedMemoryEvidence(records, query, capabilities);
    assert(ranked.length > 0, "Ranked memories are returned");
    assert(ranked[0].importance === "critical" || ranked[0].importance === "high", "High-importance memory ranks first");
  });

  await describe("Test 3: Role restrictions hide restricted financial memories", async () => {
    const restricted = await provider.findRecords({ ...query, categories: ["financial_insight"] });
    const capabilities = buildMemoryCapabilities("superintendent");
    const ranked = retrieveRankedMemoryEvidence(restricted, { ...query, categories: ["financial_insight"] }, capabilities);
    assert(ranked.length === 0, "Superintendent cannot read restricted financial memories");
  });

  await describe("Test 4: Summary generation is deterministic", async () => {
    const records = await provider.findRecords(query);
    const capabilities = buildMemoryCapabilities("superintendent");
    const ranked = retrieveRankedMemoryEvidence(records, query, capabilities);
    const summaryOne = buildMemorySummary(records, ranked);
    const summaryTwo = buildMemorySummary(records, ranked);
    assert(JSON.stringify(summaryOne) === JSON.stringify(summaryTwo), "Summary output is stable");
    assert(summaryOne.topLessons.length > 0, "Top lessons are populated");
    assert(summaryOne.knownPreferences.length > 0, "Known preferences are populated");
    assert(summaryOne.knownDecisions.length > 0, "Known decisions are populated");
  });

  await describe("Test 5: Project, company, and customer DNA are supported", async () => {
    const records = await provider.findRecords(query);
    const projectDNA = buildProjectDNA(records);
    const companyDNA = buildCompanyDNA(records);
    const customerSummary = buildCustomerProfileSummary(records);
    assert(projectDNA !== null, "Project DNA exists when project evidence is present");
    assert(companyDNA.traits.length > 0 || companyDNA.confidence === "low", "Company DNA returns deterministic traits or low confidence");
    assert(customerSummary !== null, "Customer profile summary exists when customer evidence is present");
    const briefing = buildDeterministicMemoryBriefing(
      buildMemorySummary(records, retrieveRankedMemoryEvidence(records, query, buildMemoryCapabilities("superintendent"))),
      companyDNA,
      projectDNA,
      customerSummary,
    );
    assert(briefing.includes("Memory count"), "Deterministic briefing includes memory count");
  });

  await describe("Test 6: Memory service returns audit data", async () => {
    const result = await retrieveMemoryContext({
      provider,
      companyId: "company-a",
      role,
      requestType: "narrate_briefing",
      projectId: "project-a",
      customerId: "customer-a",
      maxResults: 10,
    });

    assert(result.audit.memoryCount >= 1, "Audit tracks memory count");
    assert(result.audit.retrievalDurationMs >= 0, "Audit tracks retrieval duration");
    assert(result.audit.rankingDurationMs >= 0, "Audit tracks ranking duration");
    assert(result.audit.summaryDurationMs >= 0, "Audit tracks summary duration");
    assert(result.recommendationHistory.every((entry) => ["accepted", "rejected", "ignored", "expired"].includes(entry.status)), "Recommendation history is typed deterministically");
  });

  console.log(`\n${"─".repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("─".repeat(48));

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
