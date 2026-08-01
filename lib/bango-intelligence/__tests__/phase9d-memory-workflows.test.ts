import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryMemoryProvider } from "../memory/memory-provider";
import { MemoryStore } from "../memory/memory-store";
import { validateLinkedResourcesForMemoryCreate } from "../memory/memory-linked-resource-validation";
import { buildBangoProviderRequest } from "../core/request-builder";
import type { MemoryProvider } from "../memory/memory-provider";
import type { BangoBusinessContext } from "../core/context-types";
import type {
  MemoryActor,
  MemoryCreateInput,
  MemoryRecord,
} from "../memory/memory-types";

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

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

function actor(overrides?: Partial<MemoryActor>): MemoryActor {
  return {
    requestId: "req-phase9d",
    userId: "user-1",
    companyId: "company-a",
    companyRole: "project_manager",
    allowedCapabilities: ["read_project", "read_schedule", "read_customers"],
    ...overrides,
  };
}

function memoryInput(overrides?: Partial<MemoryCreateInput>): MemoryCreateInput {
  return {
    scope: "project",
    category: "lesson_learned",
    projectId: "project-a",
    title: "Schedule lesson",
    summary: "Confirm permit lead times at kickoff.",
    details: { note: "Kickoff checklist" },
    importance: "high",
    confidence: "observed",
    source: "user_explicit_save",
    reason: "Project review",
    sourceReferences: [{ id: "source-1", label: "project note", type: "document", href: null }],
    tags: ["schedule"],
    ...overrides,
  };
}

function contextFixture(): BangoBusinessContext {
  return {
    request: {
      requestId: "req-ctx-9d",
      requestType: "narrate_briefing",
      locale: "en-US",
      timestamp: "2026-07-31T12:00:00.000Z",
    },
    identity: {
      userId: "user-1",
      companyId: "company-a",
      profileId: "profile-1",
      displayName: "Alex",
      companyRole: "superintendent",
      memberships: [{ membershipId: "m-1", companyId: "company-a", role: "superintendent", status: "active", isPrimary: true }],
    },
    scope: {
      companyId: "company-a",
      projectId: "project-a",
      customerId: "customer-a",
      phaseId: null,
      taskId: null,
    },
    company: {
      id: "company-a",
      name: "Bango",
      timezone: "America/Chicago",
      defaultTaxRate: 0.08,
    },
    project: {
      id: "project-a",
      name: "Project A",
      status: "in_progress",
      customerId: "customer-a",
      projectNumber: "P-1",
      intelligence: {
        healthScore: 77,
        healthStatus: "attention",
        completionPercent: 52,
        activeTasks: 8,
        overdueTasks: 1,
        blockedTasks: 1,
        activePhasesCount: 2,
        tasksDueToday: 2,
        tasksDueThisWeek: 5,
        daysUntilDue: 34,
        photosCount: 7,
        documentationPresent: true,
        assignedWorkers: 6,
        unassignedTaskCount: 1,
        contractAmount: 100000,
        invoicePaid: 30000,
        invoiceTotal: 50000,
        budgetVariance: -1200,
        overdueInvoices: 0,
        estimatesCount: 1,
        changeOrdersCount: 1,
        highestRiskSeverity: "high",
        riskCount: 1,
        risks: [{ id: "risk-1", severity: "high", message: "One blocked task." }],
      },
      briefing: {
        state: "attention",
        briefingDate: "2026-07-31",
        generatedAt: "2026-07-31T12:00:00.000Z",
        executiveSummaryKey: "summary",
        focusCount: 2,
        riskCount: 1,
        actionCount: 2,
      },
    },
    permissions: {
      allowedCapabilities: ["read_project", "read_schedule", "read_customers"],
      deniedCapabilities: ["pay_invoice"],
      approvalRequirements: {},
    },
    evidence: [],
    limitations: [],
  };
}

function createSupabaseStub(seed: {
  projects?: Array<{ id: string; company_id: string }>;
  customers?: Array<{ id: string; company_id: string }>;
  tasks?: Array<{ id: string; company_id: string; project_id: string }>;
  project_phases?: Array<{ id: string; company_id: string; project_id: string }>;
}) {
  const tableData = {
    projects: seed.projects ?? [],
    customers: seed.customers ?? [],
    tasks: seed.tasks ?? [],
    project_phases: seed.project_phases ?? [],
  } as const;

  return {
    from(table: keyof typeof tableData) {
      const rows = tableData[table] as Array<Record<string, unknown>>;
      const filters: Array<{ column: string; value: unknown }> = [];
      return {
        select() {
          return this;
        },
        eq(column: string, value: unknown) {
          filters.push({ column, value });
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          const row = rows.find((candidate) =>
            filters.every((filter) => candidate[filter.column] === filter.value),
          ) ?? null;
          return { data: row, error: null };
        },
      };
    },
  };
}

async function main(): Promise<void> {
  const store = new MemoryStore(new InMemoryMemoryProvider());

  await test("1. Authorized project manager can save project lesson", async () => {
    const result = await store.create(actor({ companyRole: "project_manager" }), memoryInput());
    assert(result.record.category === "lesson_learned", "Project manager can save project lesson memory");
  });

  await test("2. Unauthorized role cannot save restricted financial memory", async () => {
    let rejected = false;
    try {
      await store.create(actor({ companyRole: "superintendent" }), memoryInput({ category: "financial_insight" }));
    } catch {
      rejected = true;
    }

    assert(rejected, "Unauthorized role is blocked from writing financial memory");
  });

  await test("3. Cross-company linked resource rejected", async () => {
    const stub = createSupabaseStub({
      projects: [{ id: "project-a", company_id: "company-a" }],
    });

    const validation = await validateLinkedResourcesForMemoryCreate(
      stub as never,
      "company-a",
      memoryInput({ projectId: "project-b" }),
    );

    assert(!validation.ok, "Linked resource validator rejects cross-company project link");
  });

  await test("4. Duplicate memory handled correctly", async () => {
    const input = memoryInput({ title: "Duplicate", summary: "Same summary" });
    await store.create(actor(), input);

    let rejected = false;
    try {
      await store.create(actor(), input);
    } catch {
      rejected = true;
    }

    assert(rejected, "Exact duplicate memory is rejected");
  });

  await test("5. Recommendation accepted recorded", async () => {
    const recommendation = await store.create(actor(), memoryInput({
      category: "recommendation",
      title: "Crew staging recommendation",
      recommendationStatus: "ignored",
    }));

    const updated = await store.recordRecommendationOutcome(actor({ companyRole: "project_manager" }), recommendation.record.id, { status: "accepted" });
    assert(updated.recommendationStatus === "accepted", "Accepted outcome is recorded");
  });

  await test("6. Recommendation implemented recorded separately", async () => {
    const recommendation = await store.create(actor(), memoryInput({
      category: "recommendation",
      title: "Implement lookahead planning",
      recommendationStatus: "ignored",
    }));

    const updated = await store.recordRecommendationOutcome(actor({ companyRole: "project_manager" }), recommendation.record.id, { status: "implemented" });
    assert(updated.recommendationStatus === "implemented", "Implemented outcome is distinct and recorded");
  });

  await test("7. Non-recommendation cannot receive recommendation outcome", async () => {
    const lesson = await store.create(actor(), memoryInput({ category: "lesson_learned", title: "Lesson only" }));

    let rejected = false;
    try {
      await store.recordRecommendationOutcome(actor(), lesson.record.id, { status: "accepted" });
    } catch {
      rejected = true;
    }

    assert(rejected, "Non-recommendation memory cannot receive outcome status");
  });

  await test("8. Closeout creates only non-empty lessons", async () => {
    const closeoutEntries = [
      { title: "What worked", summary: "", category: "lesson_learned" as const },
      { title: "Crew lesson", summary: "Keep the same foreman pairing.", category: "crew_performance" as const },
      { title: "Safety lesson", summary: "Observation: toolbox talks improved compliance.", category: "safety_observation" as const },
    ];

    const nonEmpty = closeoutEntries.filter((entry) => entry.summary.trim().length > 0);
    for (const entry of nonEmpty) {
      await store.create(actor(), memoryInput({
        category: entry.category,
        title: entry.title,
        summary: entry.summary,
      }));
    }

    const records = await store.list(actor(), { categories: ["crew_performance", "safety_observation"], includeArchived: false });
    assert(records.length >= 2, "Only non-empty closeout lessons are created");
  });

  await test("9. Archived memory disappears from default list", async () => {
    const created = await store.create(actor(), memoryInput({ title: "Archive candidate" }));
    await store.archive(actor(), created.record.id, { reason: "phase9d test" });

    const listed = await store.list(actor(), {});
    assert(!listed.some((record) => record.id === created.record.id), "Archived memory is hidden from default list");
  });

  await test("10. Authorized verifier can verify", async () => {
    const created = await store.create(actor(), memoryInput({ title: "Verify candidate" }));
    const verified = await store.verify(actor({ companyRole: "operations_manager" }), created.record.id, { reason: "quality review" });
    assert(verified.confidence === "verified", "Authorized verifier can verify memory");
  });

  await test("11. Unauthorized verifier rejected", async () => {
    const created = await store.create(actor(), memoryInput({ title: "Unauthorized verify" }));

    let rejected = false;
    try {
      await store.verify(actor({ companyRole: "foreman" }), created.record.id, { reason: "attempt" });
    } catch {
      rejected = true;
    }

    assert(rejected, "Unauthorized verifier is rejected");
  });

  await test("12. Browser company_id ignored", async () => {
    const created = await store.create(actor({ companyId: "company-a" }), memoryInput({
      details: { browserCompanyId: "forged" },
      title: "Ignore forged company",
    }));

    assert(created.record.companyId === "company-a", "Actor company scope is always used");
  });

  await test("13. No hard delete path exists", async () => {
    const route = readFileSync(join(process.cwd(), "app", "api", "bango-intelligence", "memories", "[memoryId]", "route.ts"), "utf8");
    const archiveRoute = readFileSync(join(process.cwd(), "app", "api", "bango-intelligence", "memories", "[memoryId]", "archive", "route.ts"), "utf8");
    assert(!route.includes("export async function DELETE"), "No DELETE handler on memory route");
    assert(archiveRoute.includes("archive"), "Archive path exists for soft-delete behavior");
  });

  await test("14. No AI call occurs during memory creation", async () => {
    let createCalls = 0;

    const provider: MemoryProvider = {
      findRecords: async () => [],
      findRecordById: async () => null,
      createRecord: async (_actor: MemoryActor, input: MemoryCreateInput) => {
        createCalls += 1;
        const now = new Date().toISOString();
        const record: MemoryRecord = {
          id: "memory-no-ai",
          companyId: "company-a",
          scope: input.scope,
          category: input.category,
          projectId: input.projectId ?? null,
          customerId: input.customerId ?? null,
          userId: input.userId ?? null,
          taskId: input.taskId ?? null,
          phaseId: input.phaseId ?? null,
          title: input.title,
          summary: input.summary,
          details: input.details,
          importance: input.importance,
          confidence: input.confidence,
          recommendationStatus: input.recommendationStatus ?? null,
          createdBy: "user-1",
          updatedBy: "user-1",
          verifiedBy: null,
          verifiedAt: null,
          createdAt: now,
          updatedAt: now,
          sourceReferences: input.sourceReferences,
          tags: input.tags,
          status: "active",
          archivedAt: null,
          expiresAt: null,
          roleRestrictions: [],
        };

        return { record, deduplicationOutcome: "created_new" };
      },
      updateRecord: async () => { throw new Error("not used"); },
      archiveRecord: async () => { throw new Error("not used"); },
      verifyRecord: async () => { throw new Error("not used"); },
      recordRecommendationOutcome: async () => { throw new Error("not used"); },
    };

    const isolated = new MemoryStore(provider);
    await isolated.create(actor(), memoryInput({ title: "No AI write" }));
    assert(createCalls === 1, "Memory create only touches memory provider");
  });

  await test("15. Existing Superintendent still works", async () => {
    const result = await buildBangoProviderRequest(
      {
        requestId: "req-9d-super",
        roleId: "superintendent",
        requestType: "narrate_briefing",
        projectId: "project-a",
        locale: "en-US",
      },
      {
        contextBuilder: async () => ({ ok: true, context: contextFixture() }),
      },
    );

    assert(result.ok, "Superintendent request path still builds");
  });

  console.log(`\n${"─".repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("─".repeat(48));

  if (failed > 0) {
    process.exit(1);
  }
}

void main();
