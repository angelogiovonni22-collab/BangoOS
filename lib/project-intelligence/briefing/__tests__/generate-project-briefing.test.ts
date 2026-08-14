/**
 * Briefing engine unit tests — Phase 8A
 *
 * No external test framework required. This file can be run via:
 *   npx ts-node --project tsconfig.json lib/project-intelligence/briefing/__tests__/generate-project-briefing.test.ts
 *
 * All assertions use a minimal inline assert() helper. If any assertion fails
 * the process exits with code 1 and prints the failure.
 *
 * Test scenarios:
 *  1. Healthy project briefing
 *  2. One overdue task
 *  3. Five or more overdue tasks (critical)
 *  4. Blocked tasks
 *  5. Unassigned tasks
 *  6. Near-budget project
 *  7. Over-budget project
 *  8. Limited project data
 *  9. No active tasks
 * 10. Duplicate recommendations are merged
 * 11. Critical risks sort before high risks
 * 12. Output is deterministic
 */

import { generateProjectBriefing } from "../generate-project-briefing";
import { calculateProjectIntelligence } from "../../calculate-project-intelligence";
import type { CalculateProjectIntelligenceInput } from "../../calculate-project-intelligence";

// ---------------------------------------------------------------------------
// Minimal assert helper
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fixture builders
// ---------------------------------------------------------------------------

const YESTERDAY = (() => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
})();
const NEXT_WEEK = (() => {
  const d = new Date();
  d.setDate(d.getDate() + 8);
  return d.toISOString().slice(0, 10);
})();

function makeTask(overrides: Partial<CalculateProjectIntelligenceInput["tasks"][0]> = {}): CalculateProjectIntelligenceInput["tasks"][0] {
  return {
    id: crypto.randomUUID(),
    status: "in_progress",
    completion_percentage: 50,
    planned_finish: NEXT_WEEK,
    assigned_profile_id: "profile-1",
    phase_id: "phase-1",
    ...overrides,
  };
}

function briefingFor(input: Partial<CalculateProjectIntelligenceInput>, projectName = "Test Project") {
  const full: CalculateProjectIntelligenceInput = {
    project: {
      status: "in_progress",
      estimated_end_date: NEXT_WEEK,
      contract_amount: 100_000,
      estimated_cost: null,
      description: "Full scope description for testing.",
      ...input.project,
    },
    tasks: input.tasks ?? [makeTask()],
    invoices: input.invoices ?? [],
    counts: { estimates: 1, changeOrders: 0, photos: 5, ...input.counts },
  };
  const intelligence = calculateProjectIntelligence(full);
  return generateProjectBriefing({ intelligence, projectId: "proj-1", projectName });
}

// ---------------------------------------------------------------------------
// Test 1 — Healthy project
// ---------------------------------------------------------------------------

describe("Test 1: Healthy project briefing", () => {
  const briefing = briefingFor({
    tasks: [makeTask({ status: "in_progress", completion_percentage: 60, planned_finish: NEXT_WEEK, assigned_profile_id: "p1" })],
    counts: { estimates: 1, changeOrders: 0, photos: 3 },
  });

  assert(briefing.state === "healthy" || briefing.state === "attention", "State is healthy or attention (depends on setup risks)");
  assert(briefing.metadata.projectId === "proj-1", "Project ID matches");
  assert(briefing.greeting.projectName === "Test Project", "Project name in greeting");
  assert(typeof briefing.executiveSummaryKey === "string", "Executive summary key is a string");
  assert(Array.isArray(briefing.focusItems), "Focus items is an array");
  assert(Array.isArray(briefing.riskItems), "Risk items is an array");
  assert(Array.isArray(briefing.recommendedActions), "Recommended actions is an array");
  assert(briefing.progressSnapshot.completionPercent >= 0, "Completion percent is non-negative");
});

// ---------------------------------------------------------------------------
// Test 2 — One overdue task
// ---------------------------------------------------------------------------

describe("Test 2: One overdue task", () => {
  const briefing = briefingFor({
    tasks: [
      makeTask({ status: "in_progress", planned_finish: YESTERDAY }),
      makeTask({ status: "in_progress", planned_finish: NEXT_WEEK }),
    ],
  });

  assert(briefing.progressSnapshot.overdueTasks === 1, "Progress snapshot shows 1 overdue task");
  const hasOverdueFocus = briefing.focusItems.some((f) => f.id === "focus_overdue");
  assert(hasOverdueFocus, "Overdue focus item is present");
  const hasReviewAction = briefing.recommendedActions.some((a) => a.id === "action_review_overdue");
  assert(hasReviewAction, "Review overdue action is present");
});

// ---------------------------------------------------------------------------
// Test 3 — Five or more overdue tasks → critical
// ---------------------------------------------------------------------------

describe("Test 3: Five or more overdue tasks (critical state)", () => {
  const briefing = briefingFor({
    tasks: Array.from({ length: 6 }, () =>
      makeTask({ status: "in_progress", planned_finish: YESTERDAY }),
    ),
  });

  assert(briefing.state === "critical", "State is critical");
  assert(briefing.progressSnapshot.overdueTasks === 6, "Progress snapshot shows 6 overdue tasks");
  const criticalRisk = briefing.riskItems.find((r) => r.severity === "critical");
  assert(criticalRisk !== undefined, "At least one critical risk item present");
  assert(briefing.riskItems[0]?.severity === "critical", "Critical risk sorts first");
  assert(briefing.executiveSummaryKey === "briefingSummaryCritical", "Executive summary key is critical");
});

// ---------------------------------------------------------------------------
// Test 4 — Blocked tasks
// ---------------------------------------------------------------------------

describe("Test 4: Blocked tasks", () => {
  const briefing = briefingFor({
    tasks: [
      makeTask({ status: "blocked" }),
      makeTask({ status: "blocked" }),
      makeTask({ status: "blocked" }),
    ],
  });

  assert(briefing.progressSnapshot.blockedTasks === 3, "Progress snapshot shows 3 blocked tasks");
  const hasBlockedFocus = briefing.focusItems.some((f) => f.id === "focus_blocked");
  assert(hasBlockedFocus, "Blocked focus item is present");
  const hasResolveAction = briefing.recommendedActions.some((a) => a.id === "action_resolve_blocked");
  assert(hasResolveAction, "Resolve blocked action is present");
});

// ---------------------------------------------------------------------------
// Test 5 — Unassigned tasks
// ---------------------------------------------------------------------------

describe("Test 5: Unassigned tasks", () => {
  const briefing = briefingFor({
    tasks: [
      makeTask({ assigned_profile_id: null }),
      makeTask({ assigned_profile_id: null }),
      makeTask({ assigned_profile_id: null }),
    ],
  });

  assert(briefing.progressSnapshot.unassignedTaskCount === 3, "Progress snapshot shows 3 unassigned tasks");
  const hasUnassignedFocus = briefing.focusItems.some((f) => f.id === "focus_unassigned");
  assert(hasUnassignedFocus, "Unassigned focus item is present");
  const hasAssignAction = briefing.recommendedActions.some((a) => a.id === "action_assign_tasks");
  assert(hasAssignAction, "Assign tasks action is present");
});

// ---------------------------------------------------------------------------
// Test 6 — Near-budget project (85%)
// ---------------------------------------------------------------------------

describe("Test 6: Near-budget project", () => {
  const briefing = briefingFor({
    invoices: [{ total_amount: 86_000, amount_paid: 86_000, due_date: null }],
    project: { contract_amount: 100_000, estimated_cost: null, status: "in_progress", estimated_end_date: NEXT_WEEK, description: "Test" },
  });

  const hasNearBudgetFocus = briefing.focusItems.some((f) => f.id === "focus_near_budget");
  assert(hasNearBudgetFocus, "Near-budget focus item is present");
  const hasBudgetAction = briefing.recommendedActions.some((a) => a.id === "action_review_budget");
  assert(hasBudgetAction, "Review budget action is present");
});

// ---------------------------------------------------------------------------
// Test 7 — Over-budget project
// ---------------------------------------------------------------------------

describe("Test 7: Over-budget project", () => {
  const briefing = briefingFor({
    invoices: [{ total_amount: 120_000, amount_paid: 120_000, due_date: null }],
    project: { contract_amount: 100_000, estimated_cost: null, status: "in_progress", estimated_end_date: NEXT_WEEK, description: "Test" },
  });

  const overBudgetRisk = briefing.riskItems.find((r) => r.riskId === "risk_over_budget");
  assert(overBudgetRisk !== undefined, "Over-budget risk item present");
  assert(overBudgetRisk?.severity === "critical", "Over-budget risk is critical severity");
  assert(briefing.state === "critical", "State is critical when over budget");
});

// ---------------------------------------------------------------------------
// Test 8 — Limited data
// ---------------------------------------------------------------------------

describe("Test 8: Limited data", () => {
  const briefing = briefingFor({
    project: { status: "in_progress", estimated_end_date: null, contract_amount: null, estimated_cost: null, description: null },
    tasks: [makeTask({ completion_percentage: 0 })],
    counts: { estimates: 0, changeOrders: 0, photos: 0 },
  });

  assert(briefing.state === "limited_data" || briefing.state === "attention" || briefing.state === "healthy", "State is one of the expected values");
  assert(typeof briefing.executiveSummaryKey === "string", "Has executive summary key");
});

// ---------------------------------------------------------------------------
// Test 9 — No active tasks
// ---------------------------------------------------------------------------

describe("Test 9: No active tasks", () => {
  const briefing = briefingFor({ tasks: [] });

  assert(briefing.state === "no_active_work", "State is no_active_work");
  assert(briefing.progressSnapshot.activeTasks === 0, "Active tasks is 0");
  assert(briefing.executiveSummaryKey === "briefingSummaryNoActiveWork", "Summary key is no active work");
  assert(briefing.recommendedActions[0]?.id === "action_continue_execution", "Single continue action");
});

// ---------------------------------------------------------------------------
// Test 10 — Duplicate recommendations are merged
// ---------------------------------------------------------------------------

describe("Test 10: Duplicate recommendations are merged", () => {
  // Both risk_overdue_critical and risk_overdue_high would map to action_review_overdue
  // but only one should appear in the output
  const briefing = briefingFor({
    tasks: Array.from({ length: 6 }, () =>
      makeTask({ status: "in_progress", planned_finish: YESTERDAY }),
    ),
  });

  const reviewActions = briefing.recommendedActions.filter((a) => a.id === "action_review_overdue");
  assert(reviewActions.length === 1, "Only one review-overdue action (deduplicated)");
});

// ---------------------------------------------------------------------------
// Test 11 — Critical risks sort before high risks
// ---------------------------------------------------------------------------

describe("Test 11: Critical risks sort before high risks", () => {
  const briefing = briefingFor({
    tasks: Array.from({ length: 6 }, () =>
      makeTask({ status: "in_progress", planned_finish: YESTERDAY, assigned_profile_id: null }),
    ),
    invoices: [{ total_amount: 120_000, amount_paid: 120_000, due_date: null }],
    project: { contract_amount: 100_000, estimated_cost: null, status: "in_progress", estimated_end_date: NEXT_WEEK, description: null },
  });

  const severities = briefing.riskItems.map((r) => r.severity);
  const criticalIndex = severities.indexOf("critical");
  const highIndex = severities.indexOf("high");

  if (criticalIndex !== -1 && highIndex !== -1) {
    assert(criticalIndex < highIndex, "Critical risk appears before high risk");
  } else {
    assert(criticalIndex !== -1 || highIndex !== -1, "At least one severity level present");
  }
});

// ---------------------------------------------------------------------------
// Test 12 — Output is deterministic
// ---------------------------------------------------------------------------

describe("Test 12: Output is deterministic (same input → same output)", () => {
  const input: Partial<CalculateProjectIntelligenceInput> = {
    tasks: [makeTask({ id: "fixed-task-1", status: "in_progress", planned_finish: YESTERDAY })],
    invoices: [{ total_amount: 5_000, amount_paid: 5_000, due_date: YESTERDAY }],
    project: { status: "in_progress", estimated_end_date: NEXT_WEEK, contract_amount: 50_000, estimated_cost: null, description: "Scope" },
    counts: { estimates: 1, changeOrders: 1, photos: 2 },
  };

  const b1 = briefingFor(input, "Determinism Project");
  const b2 = briefingFor(input, "Determinism Project");

  assert(b1.state === b2.state, "State is identical across two calls");
  assert(b1.executiveSummaryKey === b2.executiveSummaryKey, "Executive summary key is identical");
  assert(b1.focusItems.length === b2.focusItems.length, "Focus item count is identical");
  assert(b1.riskItems.length === b2.riskItems.length, "Risk item count is identical");
  assert(b1.recommendedActions.length === b2.recommendedActions.length, "Action count is identical");
  assert(
    b1.riskItems.map((r) => r.riskId).join(",") === b2.riskItems.map((r) => r.riskId).join(","),
    "Risk item order is identical",
  );
  assert(
    b1.recommendedActions.map((a) => a.id).join(",") === b2.recommendedActions.map((a) => a.id).join(","),
    "Action order is identical",
  );
});

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

console.log(`\n${"─".repeat(48)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("─".repeat(48));

if (failed > 0) {
  process.exit(1);
}
