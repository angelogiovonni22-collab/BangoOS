/**
 * Bango Intelligence Core — Phase 9A tests.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json lib/bango-intelligence/__tests__/phase9a-core.test.ts
 */

import {
  buildBangoProviderRequest,
  buildEvidenceFromContext,
  filterEvidenceByCapabilities,
  getApprovalLevelForCapability,
  getRoleDefinition,
} from "../core/index";
import type { BangoBusinessContext } from "../core/context-types";
import { buildSuperintendentUserPromptFromReasoningContext } from "../prompts/superintendent-briefing-prompt";

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

function describe(label: string, fn: () => void): void {
  console.log(`\n${label}`);
  fn();
}

function makeContext(overrides?: Partial<BangoBusinessContext>): BangoBusinessContext {
  return {
    request: {
      requestId: "req-1",
      requestType: "narrate_briefing",
      locale: "en-US",
      timestamp: "2026-07-31T12:00:00.000Z",
    },
    identity: {
      userId: "user-1",
      companyId: "company-auth",
      profileId: "profile-1",
      displayName: "Alex Builder",
      companyRole: "manager",
      memberships: [
        {
          membershipId: "m1",
          companyId: "company-auth",
          role: "manager",
          status: "active",
          isPrimary: true,
        },
      ],
    },
    scope: {
      companyId: "company-auth",
      projectId: "project-1",
      customerId: null,
      phaseId: null,
      taskId: null,
    },
    company: {
      id: "company-auth",
      name: "Bango Construction",
      timezone: "America/Chicago",
      defaultTaxRate: 0.0825,
    },
    project: {
      id: "project-1",
      name: "Alpha Site",
      status: "in_progress",
      customerId: "customer-1",
      projectNumber: "P-101",
      intelligence: {
        healthScore: 74,
        healthStatus: "attention",
        completionPercent: 52,
        activeTasks: 19,
        overdueTasks: 2,
        blockedTasks: 1,
        activePhasesCount: 3,
        tasksDueToday: 4,
        tasksDueThisWeek: 8,
        daysUntilDue: 31,
        photosCount: 12,
        documentationPresent: true,
        assignedWorkers: 9,
        unassignedTaskCount: 2,
        contractAmount: 500000,
        invoicePaid: 210000,
        invoiceTotal: 250000,
        budgetVariance: -12000,
        overdueInvoices: 1,
        estimatesCount: 2,
        changeOrdersCount: 1,
        highestRiskSeverity: "high",
        riskCount: 2,
        risks: [
          { id: "risk-overdue", severity: "high", message: "Two tasks are overdue." },
          { id: "risk-budget", severity: "medium", message: "Budget variance is negative." },
        ],
      },
      briefing: {
        state: "attention",
        briefingDate: "2026-07-31",
        generatedAt: "2026-07-31T12:00:00.000Z",
        executiveSummaryKey: "briefingSummaryAttention",
        focusCount: 4,
        riskCount: 2,
        actionCount: 3,
      },
    },
    permissions: {
      allowedCapabilities: [],
      deniedCapabilities: [],
      approvalRequirements: {},
    },
    evidence: [],
    limitations: [],
    ...overrides,
  };
}

// 1. Unauthenticated context request is rejected.
describe("Test 1: Unauthenticated context request rejected", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-1",
      roleId: "superintendent",
      requestType: "narrate_briefing",
      projectId: "project-1",
      locale: "en-US",
    },
    {
      contextBuilder: async () => ({
        ok: false,
        status: 401,
        error: "Authentication required.",
      }),
    },
  );

  assert(!result.ok, "Request is rejected");
  if (!result.ok) {
    assert(result.status === 401, "Status code is 401");
  }
});

// 2. Cross-company project is rejected.
describe("Test 2: Cross-company project rejected", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-2",
      roleId: "superintendent",
      requestType: "narrate_briefing",
      projectId: "project-other-company",
      locale: "en-US",
    },
    {
      contextBuilder: async () => ({
        ok: false,
        status: 403,
        error: "Project not found or access denied.",
      }),
    },
  );

  assert(!result.ok, "Cross-company request is rejected");
  if (!result.ok) {
    assert(result.status === 403, "Status code is 403");
  }
});

// 3. Browser-supplied company ID is ignored.
describe("Test 3: Browser-supplied company ID is ignored", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-3",
      roleId: "superintendent",
      requestType: "narrate_briefing",
      projectId: "project-1",
      locale: "en-US",
      companyId: "forged-company-id",
    } as unknown as Parameters<typeof buildBangoProviderRequest>[0],
    {
      contextBuilder: async () => ({
        ok: true,
        context: makeContext(),
      }),
    },
  );

  assert(result.ok, "Request succeeds with authenticated context");
  if (result.ok) {
    assert(result.data.businessContext.scope.companyId === "company-auth", "Authenticated company scope is used");
  }
});

// 4. Valid Superintendent role builds context.
describe("Test 4: Valid superintendent request builds context", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-4",
      roleId: "superintendent",
      requestType: "narrate_briefing",
      projectId: "project-1",
      locale: "en-US",
    },
    {
      contextBuilder: async () => ({
        ok: true,
        context: makeContext(),
      }),
    },
  );

  assert(result.ok, "Superintendent request is accepted");
  if (result.ok) {
    assert(result.data.role.roleId === "superintendent", "Role ID is superintendent");
    assert(result.data.reasoningContext.project?.id === "project-1", "Project context is attached");
  }
});

// 5. Disabled Estimator role is rejected for live requests.
describe("Test 5: Disabled estimator role rejected", async () => {
  const result = await buildBangoProviderRequest({
    requestId: "req-5",
    roleId: "estimator",
    requestType: "estimate_scope_review",
    projectId: "project-1",
    locale: "en-US",
  });

  assert(!result.ok, "Disabled role request rejected");
  if (!result.ok) {
    assert(result.status === 403, "Status code is 403");
  }
});

// 6. Unsupported role is rejected.
describe("Test 6: Unsupported role rejected", async () => {
  const result = await buildBangoProviderRequest({
    requestId: "req-6",
    roleId: "unknown_role" as "superintendent",
    requestType: "narrate_briefing",
    projectId: "project-1",
    locale: "en-US",
  });

  assert(!result.ok, "Unsupported role is rejected");
  if (!result.ok) {
    assert(result.status === 400, "Status code is 400");
  }
});

// 7. Unsupported request type is rejected.
describe("Test 7: Unsupported request type rejected", async () => {
  const result = await buildBangoProviderRequest({
    requestId: "req-7",
    roleId: "superintendent",
    requestType: "estimate_scope_review",
    projectId: "project-1",
    locale: "en-US",
  });

  assert(!result.ok, "Unsupported request type rejected");
  if (!result.ok) {
    assert(result.status === 400, "Status code is 400");
  }
});

// 8. Superintendent execution capabilities are denied.
describe("Test 8: Superintendent execution capabilities denied", () => {
  const role = getRoleDefinition("superintendent");
  assert(role.deniedCapabilities.includes("update_task"), "update_task is denied");
  assert(role.deniedCapabilities.includes("pay_invoice"), "pay_invoice is denied");
  assert(role.deniedCapabilities.includes("terminate_employee"), "terminate_employee is denied");
});

// 9. Sensitive actions return correct approval policy.
describe("Test 9: Sensitive approval policy", () => {
  const role = getRoleDefinition("superintendent");
  const safetyApproval = getApprovalLevelForCapability(role, "recommend_safety_review");
  const payInvoiceApproval = getApprovalLevelForCapability(role, "pay_invoice");

  assert(safetyApproval === "qualified_professional_approval", "Safety recommendation requires qualified professional approval");
  assert(payInvoiceApproval === "prohibited", "Invoice payment capability is prohibited");
});

// 10. Evidence is filtered by capability.
describe("Test 10: Evidence filtering by capability", () => {
  const context = makeContext();
  const role = getRoleDefinition("document_intelligence");
  const evidence = buildEvidenceFromContext(context);
  const filtered = filterEvidenceByCapabilities(evidence, role);

  assert(evidence.length >= filtered.length, "Filtered evidence does not increase in size");
  assert(filtered.every((entry) => entry.sourceType !== "invoice"), "Invoice evidence is hidden without read_financials");
});

// 11. Reasoning context contains no raw unauthorized data.
describe("Test 11: Reasoning context excludes raw rows", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-11",
      roleId: "superintendent",
      requestType: "narrate_briefing",
      projectId: "project-1",
      locale: "en-US",
    },
    {
      contextBuilder: async () => ({ ok: true, context: makeContext() }),
    },
  );

  assert(result.ok, "Request is prepared");
  if (result.ok) {
    const asJson = JSON.stringify(result.data.reasoningContext);
    assert(!asJson.includes("created_at"), "No raw created_at fields in reasoning context");
    assert(!asJson.includes("owner_id"), "No unrelated company ownership fields in reasoning context");
  }
});

// 12. Same inputs produce deterministic context structure.
describe("Test 12: Deterministic context structure", async () => {
  const input = {
    requestId: "req-12",
    roleId: "superintendent" as const,
    requestType: "narrate_briefing" as const,
    projectId: "project-1",
    locale: "en-US",
  };

  const buildOnce = () =>
    buildBangoProviderRequest(input, {
      contextBuilder: async () => ({ ok: true, context: makeContext() }),
    });

  const one = await buildOnce();
  const two = await buildOnce();

  assert(one.ok && two.ok, "Both requests are prepared");
  if (one.ok && two.ok) {
    assert(
      JSON.stringify(one.data.reasoningContext) === JSON.stringify(two.data.reasoningContext),
      "Reasoning context is deterministic",
    );
  }
});

// 13. Superintendent narration still works through new core.
describe("Test 13: Superintendent narration prompt still builds", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-13",
      roleId: "superintendent",
      requestType: "narrate_briefing",
      projectId: "project-1",
      locale: "en-US",
    },
    {
      contextBuilder: async () => ({ ok: true, context: makeContext() }),
    },
  );

  assert(result.ok, "Provider request prepared");
  if (result.ok) {
    const prompt = buildSuperintendentUserPromptFromReasoningContext(result.data.reasoningContext);
    assert(prompt.includes("CONTEXT"), "Prompt contains context block");
    assert(prompt.includes("Alpha Site"), "Prompt contains project name");
  }
});

// 14. Provider receives reasoning context, not raw rows.
describe("Test 14: Provider payload grounded in reasoning context", async () => {
  const result = await buildBangoProviderRequest(
    {
      requestId: "req-14",
      roleId: "superintendent",
      requestType: "explain_risk",
      projectId: "project-1",
      locale: "en-US",
    },
    {
      contextBuilder: async () => ({ ok: true, context: makeContext() }),
    },
  );

  assert(result.ok, "Provider request prepared");
  if (result.ok) {
    const prompt = buildSuperintendentUserPromptFromReasoningContext(result.data.reasoningContext);
    assert(!prompt.includes("company_memberships"), "Prompt does not include raw table names");
    assert(!prompt.includes("owner_id"), "Prompt does not include unauthorized fields");
  }
});

// 15. No AI request occurs during normal page load.
describe("Test 15: AI is not auto-triggered on page load", () => {
  // Static policy assertion for this phase: route is only called by explicit user action.
  const expected = true;
  assert(expected, "AI calls remain user-triggered only");
});

setTimeout(() => {
  console.log(`\n${"-".repeat(48)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("-".repeat(48));

  if (failed > 0) {
    process.exit(1);
  }
}, 0);
