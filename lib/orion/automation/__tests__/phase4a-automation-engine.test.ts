import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  createAutomationEngine,
  createAutomationRegistry,
  ORION_AUTOMATION_TRIGGER_EVENTS,
  type OrionAutomationExecutionContext,
  type OrionAutomationHistory,
  type OrionAutomationRule,
  supportsAutomationTrigger,
  validateAutomationRule,
} from "../index";
import type { OrionEventRecord } from "@/lib/orion/events";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function makeContext(): OrionAutomationExecutionContext {
  return {
    supabase: {} as OrionAutomationExecutionContext["supabase"],
    now: () => new Date("2026-08-04T12:00:00.000Z"),
    state: {
      estimateId: null,
      projectId: null,
      depositInvoiceId: null,
      agreementVersionId: null,
      portalEnabled: false,
    },
    config: {
      followupDays: 3,
    },
  };
}

function makeEvent(type: OrionEventRecord["event_type"]): OrionEventRecord {
  return {
    event_id: "evt-100",
    company_id: "cmp-100",
    workspace_id: null,
    actor_profile_id: "profile-100",
    event_type: type,
    aggregate_type: "estimate",
    aggregate_id: "est-100",
    occurred_at: "2026-08-04T11:00:00.000Z",
    version: 1,
    source_module: "workflows",
    payload: {},
    metadata: {},
    correlation_id: null,
    causation_id: null,
    idempotency_key: null,
  };
}

function createHistory(overrides?: Partial<OrionAutomationHistory>): OrionAutomationHistory {
  return {
    async startRun() {
      return { shouldRun: true };
    },
    async completeRun() {
      return;
    },
    async failRun() {
      return;
    },
    async startStep() {
      return;
    },
    async completeStep() {
      return;
    },
    ...overrides,
  };
}

async function main() {
  await test("1. validation rejects duplicate step ids", () => {
    const rule: OrionAutomationRule = {
      id: "duplicate-steps",
      companyId: "*",
      enabled: true,
      triggerEvent: "estimate.approved",
      conditions: [],
      actions: [
        { id: "same", description: "step1", async execute() { return { status: "completed" }; } },
        { id: "same", description: "step2", async execute() { return { status: "completed" }; } },
      ],
      priority: 10,
      createdBy: "test",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };

    const validation = validateAutomationRule(rule);
    check(!validation.ok, "rule with duplicate action ids is rejected");
  });

  await test("2. registry exposes phase 4A system rules", () => {
    const registry = createAutomationRegistry();
    const approvedRules = registry.listForEvent("cmp-100", "estimate.approved");
    const viewedRules = registry.listForEvent("cmp-100", "estimate.viewed");
    const approvedWorkflow = approvedRules.find((rule) => rule.id === "estimate-approved-workflow") || null;

    check(approvedRules.some((rule) => rule.id === "estimate-approved-workflow"), "estimate approved workflow rule exists");
    check(viewedRules.some((rule) => rule.id === "estimate-viewed-followup"), "estimate viewed followup rule exists");
    check(Boolean(approvedWorkflow?.actions.some((action) => action.id === "bootstrap-project-workspace")), "estimate approved workflow includes project workspace bootstrap step");
  });

  await test("3. engine executes in order and stops on first failure", async () => {
    const executed: string[] = [];
    const historyCalls: string[] = [];

    const history = createHistory({
      async startStep(params) {
        historyCalls.push(`start:${params.stepId}`);
      },
      async completeStep(params) {
        historyCalls.push(`end:${params.stepId}:${params.success ? "ok" : "fail"}`);
      },
      async failRun(params) {
        historyCalls.push(`run-failed:${params.stepId}`);
      },
    });

    const rule: OrionAutomationRule = {
      id: "stop-on-failure",
      companyId: "*",
      enabled: true,
      triggerEvent: "estimate.approved",
      conditions: [],
      actions: [
        {
          id: "first",
          description: "first",
          async execute() {
            executed.push("first");
            return { status: "completed" };
          },
        },
        {
          id: "second",
          description: "second",
          async execute() {
            executed.push("second");
            throw new Error("boom");
          },
        },
        {
          id: "third",
          description: "third",
          async execute() {
            executed.push("third");
            return { status: "completed" };
          },
        },
      ],
      priority: 10,
      createdBy: "test",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };

    const engine = createAutomationEngine(makeContext(), { history });
    const result = await engine.executeRule(rule, makeEvent("estimate.approved"));

    check(result.status === "failed", "rule run is marked failed");
    check(executed.join(",") === "first,second", "execution stops after failing step");
    check(historyCalls.includes("run-failed:second"), "failure path recorded in history");
  });

  await test("4. engine skips when run idempotency is already recorded", async () => {
    const history = createHistory({
      async startRun() {
        return { shouldRun: false };
      },
    });

    const rule: OrionAutomationRule = {
      id: "idempotent-rule",
      companyId: "*",
      enabled: true,
      triggerEvent: "estimate.approved",
      conditions: [],
      actions: [{ id: "noop", description: "noop", async execute() { return { status: "completed" }; } }],
      priority: 1,
      createdBy: "test",
      createdAt: "2026-08-04T12:00:00.000Z",
      updatedAt: "2026-08-04T12:00:00.000Z",
    };

    const engine = createAutomationEngine(makeContext(), { history });
    const result = await engine.executeRule(rule, makeEvent("estimate.approved"));

    check(result.status === "skipped", "run is skipped when startRun says already processed");
    check(result.steps.length === 0, "no step executes for idempotent run");
  });

  await test("5. supported trigger gate allows only configured event types", () => {
    check(supportsAutomationTrigger(makeEvent("estimate.approved")), "supported trigger is accepted");
    check(!supportsAutomationTrigger(makeEvent("workflow.executed")), "unsupported trigger is rejected");
    check(!ORION_AUTOMATION_TRIGGER_EVENTS.includes("workflow.executed" as never), "workflow.executed is excluded from automation triggers");
  });

  await test("6. workflow engine is wired to automation runner", () => {
    const workflowEngineSource = readFileSync(resolve(process.cwd(), "lib", "workflows", "workflow-engine.ts"), "utf8");

    check(workflowEngineSource.includes("createOrionAutomationRunner"), "workflow engine imports automation runner");
    check(workflowEngineSource.includes("runForWorkflowEventId"), "workflow engine dispatches event id to automation runner");
  });

  await test("7. automation mutation steps use command router with origin metadata", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "orion", "automation", "automation-context.ts"), "utf8");

    check(source.includes("createOrionCommandRouter"), "automation context routes safe mutations through command router");
    check(source.includes("origin: \"automation\""), "automation command executions are marked with automation origin metadata");
    check(source.includes("commandId: \"project.update_status\""), "project status automation uses executeCommand");
    check(source.includes("commandId: \"estimate.generate_deposit_invoice\""), "deposit invoice automation uses executeCommand");
  });

  console.log(`\nOrion automation phase 4A results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
