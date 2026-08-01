/**
 * Bango Intelligence Core — Phase 8B unit tests.
 *
 * Run with:
 *   npx ts-node --project tsconfig.json lib/bango-intelligence/__tests__/bango-intelligence.test.ts
 *
 * No external test framework is used. The inline assert() helper exits with
 * code 1 on any failure.
 *
 * Test scenarios:
 *  1.  Grounding contains only allowed briefing facts.
 *  2.  Invalid request body is rejected.
 *  3.  Unsupported request type is rejected.
 *  4.  Valid structured response passes validation.
 *  5.  Malformed model response triggers fallback (null returned).
 *  6.  Partially-invalid model response triggers fallback.
 *  7.  Spanish locale is passed correctly in the user prompt.
 *  8.  English locale is passed correctly in the user prompt.
 *  9.  Input size limit is enforced.
 * 10.  Same deterministic input creates stable grounding.
 * 11.  All required grounding fields are present.
 * 12.  Response validation strips oversized strings.
 */

import { validateNarratedBriefing } from "../response-validation";
import { buildGroundingContext } from "../grounding";
import { buildSuperintendentUserPrompt } from "../prompts/superintendent-briefing-prompt";
import { BANGO_AI_CONFIG, isInputTooLarge } from "../cost-controls";
import { SUPPORTED_REQUEST_TYPES } from "../types";
import { calculateProjectIntelligence } from "../../project-intelligence/calculate-project-intelligence";
import { generateProjectBriefing } from "../../project-intelligence/briefing/generate-project-briefing";
import type { NarratedBriefing } from "../types";

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
// Fixture helpers
// ---------------------------------------------------------------------------

const NEXT_WEEK = (() => { const d = new Date(); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();

function makeBaseIntelligence() {
  return calculateProjectIntelligence({
    project: { status: "in_progress", estimated_end_date: NEXT_WEEK, contract_amount: 100_000, estimated_cost: null, description: "Test scope." },
    tasks: [{ id: "t1", status: "in_progress", completion_percentage: 50, planned_finish: NEXT_WEEK, assigned_profile_id: "p1", phase_id: "ph1" }],
    invoices: [{ total_amount: 20_000, amount_paid: 20_000, due_date: null }],
    counts: { estimates: 1, changeOrders: 0, photos: 3 },
  });
}

function makeBaseBriefing() {
  const intel = makeBaseIntelligence();
  return { intelligence: intel, briefing: generateProjectBriefing({ intelligence: intel, projectId: "proj-1", projectName: "Test Project" }) };
}

const VALID_NARRATION: NarratedBriefing = {
  headline: "Project on track",
  executive_summary: "All systems operational with no significant risks.",
  today_focus: [{ title: "Close open tasks", explanation: "2 tasks due today.", priority: "high", source_ids: ["risk_1"] }],
  risks: [],
  recommended_actions: [{ title: "Monitor schedule", explanation: "Review daily.", priority: "low", source_ids: [], requires_approval: false }],
  confidence: "high",
  limitations: [],
};

// ---------------------------------------------------------------------------
// Test 1 — Grounding contains only allowed briefing facts
// ---------------------------------------------------------------------------

describe("Test 1: Grounding contains allowed facts only", () => {
  const { intelligence, briefing } = makeBaseBriefing();
  const ctx = buildGroundingContext("Test Project", "in_progress", intelligence, briefing);

  assert(ctx.projectName === "Test Project", "projectName is correct");
  assert(ctx.projectStatus === "in_progress", "projectStatus is correct");
  assert(typeof ctx.healthScore === "number" || ctx.healthScore === null, "healthScore is number or null");
  assert(typeof ctx.completionPercent === "number", "completionPercent is number");
  assert(Array.isArray(ctx.risks), "risks is an array");
  // Ensure no raw database objects leaked into grounding
  const riskEntry = ctx.risks[0];
  if (riskEntry) {
    assert(typeof riskEntry.id === "string", "risk.id is string");
    assert(typeof riskEntry.severity === "string", "risk.severity is string");
    assert(typeof riskEntry.message === "string", "risk.message is string");
    assert(Object.keys(riskEntry).length === 3, "risk entry has exactly 3 fields (id, severity, message)");
  }
});

// ---------------------------------------------------------------------------
// Test 2 — Invalid request body is rejected
// ---------------------------------------------------------------------------

describe("Test 2: Invalid request body detection", () => {
  // This tests the body validation logic directly
  function validateBody(body: unknown): { ok: boolean; error?: string } {
    if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid body" };
    const obj = body as Record<string, unknown>;
    if (typeof obj.projectId !== "string" || !obj.projectId) return { ok: false, error: "projectId required" };
    if (typeof obj.requestType !== "string" || !SUPPORTED_REQUEST_TYPES.includes(obj.requestType as typeof SUPPORTED_REQUEST_TYPES[number])) return { ok: false, error: "invalid requestType" };
    return { ok: true };
  }

  assert(!validateBody(null).ok, "null body is rejected");
  assert(!validateBody("string").ok, "string body is rejected");
  assert(!validateBody({ requestType: "narrate_briefing" }).ok, "missing projectId is rejected");
  assert(!validateBody({ projectId: "p1", requestType: "invalid_type" }).ok, "invalid requestType is rejected");
  assert(validateBody({ projectId: "p1", requestType: "narrate_briefing" }).ok, "valid body is accepted");
});

// ---------------------------------------------------------------------------
// Test 3 — Unsupported request type is rejected
// ---------------------------------------------------------------------------

describe("Test 3: Unsupported request types", () => {
  assert(!SUPPORTED_REQUEST_TYPES.includes("chat" as typeof SUPPORTED_REQUEST_TYPES[number]), "'chat' is not supported");
  assert(!SUPPORTED_REQUEST_TYPES.includes("autonomous_action" as typeof SUPPORTED_REQUEST_TYPES[number]), "'autonomous_action' is not supported");
  assert(SUPPORTED_REQUEST_TYPES.includes("narrate_briefing"), "'narrate_briefing' is supported");
  assert(SUPPORTED_REQUEST_TYPES.includes("explain_health"), "'explain_health' is supported");
  assert(SUPPORTED_REQUEST_TYPES.includes("explain_risk"), "'explain_risk' is supported");
  assert(SUPPORTED_REQUEST_TYPES.length === 3, "Exactly 3 supported request types");
});

// ---------------------------------------------------------------------------
// Test 4 — Valid structured response passes validation
// ---------------------------------------------------------------------------

describe("Test 4: Valid structured response passes validation", () => {
  const result = validateNarratedBriefing(JSON.stringify(VALID_NARRATION));
  assert(result !== null, "Valid response is not null");
  assert(result?.headline === "Project on track", "Headline preserved");
  assert(result?.confidence === "high", "Confidence preserved");
  assert(result?.today_focus.length === 1, "Focus items preserved");
  assert(result?.recommended_actions.length === 1, "Actions preserved");
  assert(result?.limitations.length === 0, "Limitations array preserved");
});

// ---------------------------------------------------------------------------
// Test 5 — Malformed model response triggers fallback
// ---------------------------------------------------------------------------

describe("Test 5: Malformed responses return null (trigger fallback)", () => {
  assert(validateNarratedBriefing("not json") === null, "Non-JSON returns null");
  assert(validateNarratedBriefing("{}") === null, "Empty object returns null");
  assert(validateNarratedBriefing("null") === null, "Literal null returns null");
  assert(validateNarratedBriefing("[1,2,3]") === null, "Array returns null");
  assert(
    validateNarratedBriefing(JSON.stringify({ headline: "ok", confidence: "high" })) === null,
    "Missing executive_summary returns null"
  );
});

// ---------------------------------------------------------------------------
// Test 6 — Partially invalid model response triggers fallback
// ---------------------------------------------------------------------------

describe("Test 6: Partially invalid responses return null", () => {
  const missingConfidence = { ...VALID_NARRATION, confidence: "ultra_high" };
  assert(validateNarratedBriefing(JSON.stringify(missingConfidence)) === null, "Invalid confidence returns null");

  const invalidPriority = { ...VALID_NARRATION, today_focus: [{ title: "t", explanation: "e", priority: "extreme", source_ids: [] }] };
  assert(validateNarratedBriefing(JSON.stringify(invalidPriority)) === null, "Invalid priority returns null");

  const invalidSeverity = { ...VALID_NARRATION, risks: [{ title: "r", explanation: "e", severity: "catastrophic", source_ids: [] }] };
  assert(validateNarratedBriefing(JSON.stringify(invalidSeverity)) === null, "Invalid severity returns null");
});

// ---------------------------------------------------------------------------
// Test 7 — Spanish locale is passed correctly
// ---------------------------------------------------------------------------

describe("Test 7: Spanish locale instruction in user prompt", () => {
  const { intelligence, briefing } = makeBaseBriefing();
  const ctx = buildGroundingContext("Test Project", "in_progress", intelligence, briefing);
  const prompt = buildSuperintendentUserPrompt(ctx, "narrate_briefing", "es-ES");
  assert(prompt.includes("Respond in Spanish"), "Spanish instruction present for es-ES");
  assert(!prompt.includes("Respond in English"), "English instruction absent for es-ES");
});

// ---------------------------------------------------------------------------
// Test 8 — English locale is passed correctly
// ---------------------------------------------------------------------------

describe("Test 8: English locale instruction in user prompt", () => {
  const { intelligence, briefing } = makeBaseBriefing();
  const ctx = buildGroundingContext("Test Project", "in_progress", intelligence, briefing);
  const prompt = buildSuperintendentUserPrompt(ctx, "narrate_briefing", "en-US");
  assert(prompt.includes("Respond in English"), "English instruction present for en-US");
  assert(!prompt.includes("Respond in Spanish"), "Spanish instruction absent for en-US");
});

// ---------------------------------------------------------------------------
// Test 9 — Input size limit is enforced
// ---------------------------------------------------------------------------

describe("Test 9: Input size limit enforcement", () => {
  const smallInput = "small context";
  const oversizedInput = "x".repeat(BANGO_AI_CONFIG.maxInputChars + 1);

  assert(!isInputTooLarge(smallInput), "Small input is within limit");
  assert(isInputTooLarge(oversizedInput), "Oversized input is caught");
  assert(BANGO_AI_CONFIG.maxOutputTokens <= 2000, "Max output tokens is within safe range");
  assert(BANGO_AI_CONFIG.maxRetries === 0, "No automatic retries configured");
  assert(BANGO_AI_CONFIG.temperature <= 0.5, "Temperature is low");
});

// ---------------------------------------------------------------------------
// Test 10 — Same deterministic input creates stable grounding
// ---------------------------------------------------------------------------

describe("Test 10: Grounding is deterministic", () => {
  const { intelligence, briefing } = makeBaseBriefing();
  const ctx1 = buildGroundingContext("Test Project", "in_progress", intelligence, briefing);
  const ctx2 = buildGroundingContext("Test Project", "in_progress", intelligence, briefing);
  const prompt1 = buildSuperintendentUserPrompt(ctx1, "narrate_briefing", "en-US");
  const prompt2 = buildSuperintendentUserPrompt(ctx2, "narrate_briefing", "en-US");

  assert(JSON.stringify(ctx1) === JSON.stringify(ctx2), "Grounding context is identical");
  assert(prompt1 === prompt2, "User prompt is identical");
  assert(ctx1.completionPercent === ctx2.completionPercent, "Completion percent is stable");
  assert(ctx1.risks.length === ctx2.risks.length, "Risk count is stable");
});

// ---------------------------------------------------------------------------
// Test 11 — All required grounding fields are present
// ---------------------------------------------------------------------------

describe("Test 11: All required grounding fields present", () => {
  const { intelligence, briefing } = makeBaseBriefing();
  const ctx = buildGroundingContext("Test Project", "in_progress", intelligence, briefing);

  const requiredFields = ["projectName", "projectStatus", "briefingDate", "briefingState", "healthStatus", "completionPercent", "activeTasks", "overdueTasks", "blockedTasks", "tasksDueToday", "tasksDueThisWeek", "photosCount", "assignedWorkers", "unassignedTaskCount", "invoicePaid", "invoiceTotal", "overdueInvoices", "estimatesCount", "changeOrdersCount", "documentationPresent", "risks"] as const;

  for (const field of requiredFields) {
    assert(field in ctx, `Field '${field}' present in grounding context`);
  }
});

// ---------------------------------------------------------------------------
// Test 12 — Response validation strips oversized strings
// ---------------------------------------------------------------------------

describe("Test 12: Validation sanitizes string lengths", () => {
  const longHeadline = "H".repeat(300);
  const longSummary = "S".repeat(2000);
  const input = { ...VALID_NARRATION, headline: longHeadline, executive_summary: longSummary };
  const result = validateNarratedBriefing(JSON.stringify(input));

  assert(result !== null, "Valid structure with long strings is not rejected");
  assert((result?.headline?.length ?? 0) <= 200, "Headline is capped at 200 chars");
  assert((result?.executive_summary?.length ?? 0) <= 1000, "Summary is capped at 1000 chars");
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
