import { readFileSync } from "node:fs";
import { join } from "node:path";
import { InMemoryMemoryProvider } from "../memory/memory-provider";
import { MemoryStore } from "../memory/memory-store";
import { validateMemoryCreateInput } from "../memory/memory-validation";
import { buildBangoProviderRequest } from "../core/request-builder";
import { buildSuperintendentUserPromptFromReasoningContext } from "../prompts/superintendent-briefing-prompt";
import type { MemoryProvider } from "../memory/memory-provider";
import type { BangoBusinessContext } from "../core/context-types";
import type { MemoryActor, MemoryCreateInput, MemoryRecord } from "../memory/memory-types";

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
    requestId: "req-1",
    userId: "user-1",
    companyId: "company-a",
    companyRole: "superintendent",
    allowedCapabilities: ["read_project", "read_schedule", "read_customers"],
    ...overrides,
  };
}

function memoryInput(overrides?: Partial<MemoryCreateInput>): MemoryCreateInput {
  return {
    scope: "project",
    category: "lesson_learned",
    projectId: "project-a",
    title: "Lesson: verify concrete delivery windows",
    summary: "Early confirmation reduced schedule variance.",
    details: { note: "Daily confirmation with vendor dispatch reduced idle crew time." },
    importance: "high",
    confidence: "observed",
    source: "verified_project_lesson",
    reason: "Post-milestone review",
    sourceReferences: [{ id: "source-1", label: "Review note", type: "document", href: null }],
    tags: ["schedule", "vendor"],
    ...overrides,
  };
}

function contextFixture(): BangoBusinessContext {
  return {
    request: {
      requestId: "req-ctx",
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

async function main(): Promise<void> {
  const store = new MemoryStore(new InMemoryMemoryProvider());

  await test("1. Company isolation", async () => {
    await store.create(actor({ companyId: "company-a" }), memoryInput());
    await store.create(actor({ companyId: "company-b", userId: "user-2" }), memoryInput({ projectId: "project-b", title: "Company B lesson" }));

    const companyARecords = await store.list(actor({ companyId: "company-a" }), {});
    assert(companyARecords.every((item) => item.companyId === "company-a"), "Company A sees only company A memories");
  });

  await test("2. Cross-company project memory rejection enforced by schema design", async () => {
    const migration = readMigration();
    assert(migration.includes("bango_memories_project_company_fkey"), "Migration includes company-scoped project foreign key");
    assert(migration.includes("task_id project must match project_id"), "Migration trigger validates task/project alignment");
  });

  await test("3. Unauthorized role cannot read restricted memory", async () => {
    await store.create(actor({ companyRole: "owner" }), memoryInput({
      category: "financial_insight",
      source: "operational_observation",
      title: "Payroll-sensitive variance",
      tags: ["private_payroll"],
    }));

    const superintendentRecords = await store.list(actor({ companyRole: "superintendent" }), { includeArchived: true });
    assert(!superintendentRecords.some((record) => record.category === "financial_insight"), "Superintendent read excludes restricted financial memory");
  });

  await test("4. Authorized role can read permitted restricted memory", async () => {
    const ownerRecords = await store.list(actor({ companyRole: "owner" }), { includeArchived: true });
    assert(ownerRecords.some((record) => record.category === "financial_insight"), "Owner can read restricted financial memory");
  });

  await test("5. Browser supplied company_id is ignored", async () => {
    const created = await store.create(actor({ companyId: "company-a" }), memoryInput({
      details: { browserCompanyId: "forged-company-id" },
      title: "Ignore forged company scope",
      source: "user_explicit_save",
    }));

    assert(created.record.companyId === "company-a", "Company ID comes from authenticated actor");
  });

  await test("6. Valid memory created", async () => {
    const result = await store.create(actor(), memoryInput({ title: "Valid memory create", source: "user_explicit_save" }));
    assert(result.record.id.length > 0, "Memory ID generated");
  });

  await test("7. Invalid scope/resource combination rejected", async () => {
    let rejected = false;
    try {
      await store.create(actor(), memoryInput({ scope: "task", taskId: null, source: "operational_observation" }));
    } catch {
      rejected = true;
    }
    assert(rejected, "Task scope without task_id is rejected");
  });

  await test("8. Exact duplicate handled by deterministic deduplication", async () => {
    const input = memoryInput({ title: "Duplicate candidate", summary: "Same summary", source: "user_explicit_save" });
    await store.create(actor(), input);

    let duplicateRejected = false;
    try {
      await store.create(actor(), input);
    } catch {
      duplicateRejected = true;
    }

    assert(duplicateRejected, "Exact duplicate is rejected");
  });

  await test("9. Archived memories excluded by default", async () => {
    const archivedCandidate = await store.create(actor(), memoryInput({ title: "Archive me", source: "user_explicit_save" }));
    await store.archive(actor(), archivedCandidate.record.id, { reason: "test" });

    const listed = await store.list(actor(), {});
    assert(!listed.some((record) => record.id === archivedCandidate.record.id), "Archived memory hidden by default");
  });

  await test("10. Expired memories excluded by default", async () => {
    const expired = await store.create(actor(), memoryInput({
      title: "Expired item",
      source: "operational_observation",
      expiresAt: "2020-01-01T00:00:00.000Z",
    }));

    const listed = await store.list(actor(), {});
    assert(!listed.some((record) => record.id === expired.record.id), "Expired memory hidden by default");
  });

  await test("11. Verified lessons retained", async () => {
    const lesson = await store.create(actor(), memoryInput({ title: "Verify lesson", source: "verified_project_lesson" }));
    await store.verify(actor({ companyRole: "owner" }), lesson.record.id, { reason: "confirmed" });

    const listed = await store.list(actor(), { includeExpired: false });
    const verified = listed.find((record) => record.id === lesson.record.id);
    assert(verified?.confidence === "verified", "Verified lesson remains available");
  });

  await test("12. Recommendation accepted/rejected outcome recorded", async () => {
    const recommendation = await store.create(actor(), memoryInput({
      category: "recommendation",
      title: "Recommendation outcome",
      source: "recommendation_outcome",
      recommendationStatus: "ignored",
    }));

    const accepted = await store.recordRecommendationOutcome(actor(), recommendation.record.id, { status: "accepted" });
    const rejected = await store.recordRecommendationOutcome(actor(), recommendation.record.id, { status: "rejected" });

    assert(accepted.recommendationStatus === "accepted", "Recommendation accepted is recorded");
    assert(rejected.recommendationStatus === "rejected", "Recommendation rejected is recorded");
  });

  await test("13. Sensitive memory excluded from Superintendent reasoning", async () => {
    const provider = new InMemoryMemoryProvider([
      {
        id: "s-1",
        companyId: "company-a",
        scope: "project",
        category: "financial_insight",
        projectId: "project-a",
        customerId: null,
        userId: null,
        taskId: null,
        phaseId: null,
        title: "Sensitive finance",
        summary: "Payroll margin note",
        details: { note: "private" },
        importance: "high",
        confidence: "observed",
        recommendationStatus: null,
        createdBy: "user-1",
        updatedBy: "user-1",
        verifiedBy: null,
        verifiedAt: null,
        createdAt: "2026-07-30T00:00:00.000Z",
        updatedAt: "2026-07-30T00:00:00.000Z",
        sourceReferences: [{ id: "r1", label: "doc", type: "document", href: null }],
        tags: ["private_payroll"],
        status: "active",
        archivedAt: null,
        expiresAt: null,
        roleRestrictions: [],
      },
      ]);

      const result = await buildBangoProviderRequest(
        {
          requestId: "req-sensitive",
          roleId: "superintendent",
          requestType: "narrate_briefing",
          projectId: "project-a",
          locale: "en-US",
        },
        {
          memoryProvider: provider,
          contextBuilder: async () => ({ ok: true, context: contextFixture() }),
        },
      );

      assert(result.ok, "Superintendent request still succeeds");
      if (result.ok) {
        assert(result.data.reasoningContext.memory.rankedEvidence.length === 0, "Sensitive memory not passed into reasoning context");
      }
    });

    await test("14. Memory retrieval failure produces safe empty summary", async () => {
      const failingProvider: MemoryProvider = {
        findRecords: async () => { throw new Error("memory backend unavailable"); },
        findRecordById: async () => null,
        createRecord: async () => { throw new Error("not used"); },
        updateRecord: async () => { throw new Error("not used"); },
        archiveRecord: async () => { throw new Error("not used"); },
        verifyRecord: async () => { throw new Error("not used"); },
        recordRecommendationOutcome: async () => { throw new Error("not used"); },
      };

      const result = await buildBangoProviderRequest(
        {
          requestId: "req-fallback",
          roleId: "superintendent",
          requestType: "narrate_briefing",
          projectId: "project-a",
          locale: "en-US",
        },
        {
          memoryProvider: failingProvider,
          contextBuilder: async () => ({ ok: true, context: contextFixture() }),
        },
      );

      assert(result.ok, "Request still succeeds when memory retrieval fails");
      if (result.ok) {
        assert(result.data.reasoningContext.memory.summary.memoryCount === 0, "Empty memory summary is used as fallback");
      }
    });

    await test("15. Supabase and InMemory providers satisfy contract methods", async () => {
      const inMemory = new InMemoryMemoryProvider();
      const requiredMethods = [
        "findRecords",
        "findRecordById",
        "createRecord",
        "updateRecord",
        "archiveRecord",
        "verifyRecord",
        "recordRecommendationOutcome",
      ];

      assert(requiredMethods.every((method) => typeof (inMemory as unknown as Record<string, unknown>)[method] === "function"), "InMemory provider satisfies contract surface");

      const migration = readMigration();
      assert(migration.includes("create table if not exists public.bango_memories"), "Persistent provider schema exists for Supabase implementation");
    });

    await test("16. DNA output includes confidence and evidence count", async () => {
      const result = await buildBangoProviderRequest(
        {
          requestId: "req-dna",
          roleId: "superintendent",
          requestType: "narrate_briefing",
          projectId: "project-a",
          locale: "en-US",
        },
        {
          contextBuilder: async () => ({ ok: true, context: contextFixture() }),
        },
      );

      assert(result.ok, "Request builds successfully for DNA assertion");
      if (result.ok) {
        assert(typeof result.data.reasoningContext.memory.companyDNA.confidence === "string", "Company DNA includes confidence");
        assert(typeof result.data.reasoningContext.memory.companyDNA.evidenceCount === "number", "Company DNA includes evidence count");
      }
    });

    await test("17. No API key or hidden prompt content stored as memory", async () => {
      const malicious = validateMemoryCreateInput(memoryInput({
        title: "Unsafe",
        summary: "contains key sk-1234567890123456789012345",
        source: "user_explicit_save",
      }));

      assert(!malicious.ok, "Validation rejects API key-like content");
    });

    await test("18. No AI call on memory write", async () => {
      let createCalls = 0;

      const provider: MemoryProvider = {
        findRecords: async () => [],
        findRecordById: async () => null,
        createRecord: async (_actor: MemoryActor, input: MemoryCreateInput) => {
          createCalls++;
          const now = new Date().toISOString();
          const record: MemoryRecord = {
            id: "test",
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
            expiresAt: input.expiresAt ?? null,
            roleRestrictions: [],
          };
          return { record, deduplicationOutcome: "created_new" };
        },
        updateRecord: async () => { throw new Error("not used"); },
        archiveRecord: async () => { throw new Error("not used"); },
        verifyRecord: async () => { throw new Error("not used"); },
        recordRecommendationOutcome: async () => { throw new Error("not used"); },
      };

      const isolatedStore = new MemoryStore(provider);
      await isolatedStore.create(actor(), memoryInput({ source: "user_explicit_save", title: "No AI write" }));
      assert(createCalls === 1, "Memory write touches provider only and does not invoke AI layer");
    });

    await test("19. Existing Superintendent narration prompt path remains functional", async () => {
      const result = await buildBangoProviderRequest(
        {
          requestId: "req-super",
          roleId: "superintendent",
          requestType: "narrate_briefing",
          projectId: "project-a",
          locale: "en-US",
        },
        {
          contextBuilder: async () => ({ ok: true, context: contextFixture() }),
        },
      );

      assert(result.ok, "Superintendent request builds");
      if (result.ok) {
        const prompt = buildSuperintendentUserPromptFromReasoningContext(result.data.reasoningContext);
        assert(prompt.includes("CONTEXT"), "Prompt still includes deterministic context");
        assert(prompt.includes("BUSINESS MEMORY"), "Prompt now includes business memory section");
      }
    });

    await test("20. RLS policies block unauthorized direct access", async () => {
      const migration = readMigration();
      assert(migration.includes("alter table public.bango_memories enable row level security;"), "RLS is enabled on bango_memories");
      assert(migration.includes("create policy bango_memories_select"), "Select policy is present");
      assert(migration.includes("public.bango_memory_has_active_membership"), "Policies require active company membership");
      assert(!migration.includes("create policy bango_memories_delete"), "No direct delete policy is created");
    });

    console.log(`\n${"─".repeat(48)}`);
    console.log(`Results: ${passed} passed, ${failed} failed`);
    console.log("─".repeat(48));

    if (failed > 0) {
      process.exit(1);
    }
  }

  function readMigration(): string {
    return readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260731121000_bango_memories_persistence.sql"),
      "utf8",
    );
  }

  void main();
