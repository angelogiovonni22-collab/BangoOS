import { normalizeIntentInput } from "./parser";
import { resolveIntentFromEntitySet } from "./resolver";
import { createOrionCommandRegistry } from "@/lib/orion/commands";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { OrionIntentEntityRecord, OrionIntentInput } from "./types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

const entities: OrionIntentEntityRecord[] = [
  {
    entityType: "customer",
    entityId: "cust-1",
    label: "Robert Mason",
    subtitle: "Customer active",
    terms: ["robert mason", "123 maple street", "maple", "robert", "mason", "bob mason"],
  },
  {
    entityType: "customer",
    entityId: "cust-2",
    label: "Robert Mason",
    subtitle: "Customer active",
    terms: ["robert mason", "122 maple street", "maple", "robert", "mason"],
  },
  {
    entityType: "customer",
    entityId: "cust-abc",
    label: "ABC Construction",
    subtitle: "Customer active",
    terms: ["abc construction", "abc", "construction"],
  },
  {
    entityType: "project",
    entityId: "proj-1",
    label: "North Ridge Build",
    subtitle: "Project active",
    terms: ["north ridge", "north ridge build", "nrb"],
  },
  {
    entityType: "estimate",
    entityId: "est-1",
    label: "EST-1023 Kitchen Remodel",
    subtitle: "Estimate draft",
    terms: ["est-1023", "1023", "kitchen remodel"],
  },
  {
    entityType: "invoice",
    entityId: "inv-1",
    label: "INV-2044 Payment 1",
    subtitle: "Invoice sent",
    terms: ["inv-2044", "2044", "payment 1"],
  },
  {
    entityType: "dashboard",
    entityId: "dashboard",
    label: "Dashboard",
    subtitle: "Executive dashboard",
    terms: ["dashboard", "priorities", "alerts"],
  },
  {
    entityType: "timeline",
    entityId: "timeline",
    label: "Timeline",
    subtitle: "Activity timeline",
    terms: ["timeline", "history", "activity"],
  },
];

function buildInput(input: string): OrionIntentInput {
  return {
    input,
    route: {
      pathname: "/projects/proj-1",
      projectId: "proj-1",
      customerId: null,
      estimateId: null,
      invoiceId: null,
      employeeId: null,
      crewId: null,
      dashboardWidgetId: null,
      timelineItemId: null,
    },
  };
}

function main() {
  test("1. Partial names resolve customers", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open rob mason"),
      role: "owner",
      entities,
    });

    assert(result.candidates.length > 0, "returns candidate list for partial customer name");
    assert(result.candidates.some((candidate) => candidate.entityType === "customer"), "customer candidate appears for partial name");
  });

  test("2. Duplicate names trigger ambiguity", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open robert mason"),
      role: "owner",
      entities,
    });

    assert(result.requiresClarification, "duplicate customer names require clarification");
    assert(result.candidates.length >= 2, "multiple candidates are returned for ambiguous duplicate names");
  });

  test("3. Ambiguous customers can be clarified", () => {
    const initial = resolveIntentFromEntitySet({
      input: buildInput("open robert mason"),
      role: "owner",
      entities,
    });

    const selectedId = initial.candidates[1]?.entityId || "cust-2";
    const clarified = resolveIntentFromEntitySet({
      input: {
        ...buildInput("open robert mason"),
        selectedCandidateId: selectedId,
      },
      role: "owner",
      entities,
    });

    assert(!clarified.requiresClarification, "clarification selection resolves ambiguity");
    assert(clarified.resolvedEntity?.entityId === selectedId, "clarification respects explicit candidate selection");
  });

  test("4. Project names are resolved", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open north ridge"),
      role: "owner",
      entities,
    });

    assert(result.candidates.some((candidate) => candidate.entityId === "proj-1"), "project name lookup returns project candidate");
  });

  test("5. Estimate number lookup resolves estimate", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("send est-1023"),
      role: "owner",
      entities,
    });

    assert(result.resolvedEntity?.entityType === "estimate", "estimate number resolves estimate entity");
    assert(result.suggestedCommand?.commandId === "estimate.send", "estimate send intent resolves estimate.send command");
  });

  test("6. Invoice number lookup resolves invoice", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("record payment inv-2044"),
      role: "owner",
      entities,
    });

    assert(result.resolvedEntity?.entityType === "invoice", "invoice number resolves invoice entity");
    assert(result.suggestedCommand?.commandId === "invoice.record_payment", "record payment resolves invoice.record_payment command");
  });

  test("7. Address lookup resolves customer", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open 123 maple"),
      role: "owner",
      entities,
    });

    assert(result.candidates.some((candidate) => candidate.entityId === "cust-1"), "partial address resolves customer candidate");
  });

  test("8. Context boosting promotes current project", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open project"),
      role: "owner",
      entities,
    });

    assert(result.candidates[0]?.entityId === "proj-1", "current route project is boosted to top candidate");
  });

  test("9. Permission filtering blocks unauthorized suggestions", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("send est-1023"),
      role: "employee",
      entities,
    });

    assert(result.suggestedCommand === null, "unauthorized role does not receive restricted command suggestion");
    assert(result.message.toLowerCase().includes("permission") || result.message.toLowerCase().includes("no send command"), "permission message is returned");
  });

  test("10. Clarification flow returns ranked choices", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open robert mason"),
      role: "owner",
      entities,
    });

    assert(result.requiresClarification, "ambiguous query requests clarification");
    assert(result.candidates.length > 1, "clarification flow includes multiple ranked candidates");
  });

  test("11. No match behavior is deterministic", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open totally unknown record"),
      role: "owner",
      entities,
    });

    assert(result.message === "No matching record found.", "no-match response message is exact and deterministic");
    assert(result.candidates.length === 0, "no-match response returns zero candidates");
    assert(result.suggestedCommand === null, "no-match response does not invent command suggestions");
  });

  test("12. Open up dashboard is deterministic and high confidence", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("open up dashboard"),
      role: "owner",
      entities,
    });

    assert(result.suggestedCommand?.commandId === "dashboard.open", "dashboard phrase maps to dashboard.open");
    assert(result.suggestedCommand?.params.deepLink === "/dashboard", "dashboard deep link is deterministic");
    assert(result.confidence >= 0.9, "dashboard phrase resolves with high confidence");
  });

  test("13. Navigation synonyms map to valid commands", () => {
    const checks = [
      { phrase: "go to dashboard", commandId: "dashboard.open" },
      { phrase: "go home", commandId: "dashboard.open" },
      { phrase: "go back", commandId: "navigation.back" },
      { phrase: "open previous page", commandId: "navigation.back" },
      { phrase: "show dashboard", commandId: "dashboard.open" },
      { phrase: "show me dashboard", commandId: "dashboard.open" },
      { phrase: "take me to dashboard", commandId: "dashboard.open" },
      { phrase: "bring up dashboard", commandId: "dashboard.open" },
      { phrase: "open projects", commandId: "dashboard.open" },
      { phrase: "open operations", commandId: "dashboard.open" },
      { phrase: "show estimates", commandId: "dashboard.open" },
      { phrase: "go to customers", commandId: "dashboard.open" },
      { phrase: "open timeline", commandId: "dashboard.open" },
      { phrase: "open reports", commandId: "dashboard.open" },
      { phrase: "open schedule", commandId: "schedule.open" },
    ];

    for (const item of checks) {
      const result = resolveIntentFromEntitySet({
        input: buildInput(item.phrase),
        role: "owner",
        entities,
      });

      assert(result.suggestedCommand?.commandId === item.commandId, `${item.phrase} maps to ${item.commandId}`);
    }
  });

  test("14. wake prefixes are normalized for deterministic navigation", () => {
    const checks = [
      { phrase: "Hey Orion, open dashboard", commandId: "dashboard.open", deepLink: "/dashboard" },
      { phrase: "Orion, open timeline", commandId: "dashboard.open", deepLink: "/timeline" },
      { phrase: "Okay Orion, show projects", commandId: "dashboard.open", deepLink: "/projects" },
      { phrase: "Hey Orion, open customers", commandId: "dashboard.open", deepLink: "/customers" },
      { phrase: "Orion, show estimates", commandId: "dashboard.open", deepLink: "/estimates" },
      { phrase: "Hey Orion, open schedule", commandId: "schedule.open", deepLink: "/schedule" },
      { phrase: "Open dashboard", commandId: "dashboard.open", deepLink: "/dashboard" },
      { phrase: "Open operations", commandId: "dashboard.open", deepLink: "/operations" },
    ];

    for (const item of checks) {
      const result = resolveIntentFromEntitySet({
        input: buildInput(item.phrase),
        role: "owner",
        entities,
      });

      assert(result.suggestedCommand?.commandId === item.commandId, `${item.phrase} resolves to ${item.commandId}`);
      assert(result.suggestedCommand?.params.deepLink === item.deepLink, `${item.phrase} resolves deterministic deep link`);
      assert(result.confidence >= 0.95, `${item.phrase} resolves with deterministic confidence`);
      assert(!result.requiresClarification, `${item.phrase} does not require clarification`);
    }
  });

  test("15. intent normalizer strips configured wake invocations", () => {
    assert(normalizeIntentInput("Hey Orion, open dashboard.") === "open dashboard.", "strips Hey Orion prefix");
    assert(normalizeIntentInput("Okay Orion — show projects") === "show projects", "strips Okay Orion prefix");
    assert(normalizeIntentInput("Orion: open timeline") === "open timeline", "strips Orion prefix with punctuation");
  });

  test("16. intent normalizer preserves ordinary Orion mentions", () => {
    assert(
      normalizeIntentInput("Orion Construction is a customer") === "Orion Construction is a customer",
      "does not strip ordinary Orion company mention",
    );
  });

  test("17. permission filtering remains enforced for deterministic navigation", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("Hey Orion, open dashboard"),
      role: "accountant",
      entities,
    });

    assert(result.suggestedCommand === null, "deterministic navigation still enforces command permissions");
    assert(result.confidence >= 0.95, "confidence remains deterministic even when command is permission blocked");
  });

  test("18. unknown command identifiers still do not execute", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("Hey Orion, open dashboard"),
      role: "accountant",
      entities,
    });

    assert(result.suggestedCommand === null, "resolver does not produce unauthorized command IDs");
    assert(result.message.toLowerCase().includes("permission"), "resolver surfaces permission block message");
  });

  test("19. wake-prefix normalization is applied once", () => {
    const resolverSource = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/resolver.ts"), "utf8");
    const callCount = (resolverSource.match(/normalizeIntentInput\(params\.input\.input\)/g) || []).length;
    assert(callCount === 1, "resolver normalizes input once at pipeline entry");
  });

  test("20. complex wake-prefixed requests stay in normal scoring path", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("Hey Orion, open robert mason"),
      role: "owner",
      entities,
    });

    assert(result.requiresClarification, "complex ambiguous query still uses normal candidate scoring flow");
    assert(result.suggestedCommand === null, "ambiguous complex query is not forced into deterministic navigation");
  });

  test("21. create phrases resolve to semantic create previews without execution", () => {
    const checks = [
      { phrase: "create customer", commandId: "customer.create" },
      { phrase: "new customer", commandId: "customer.create" },
      { phrase: "add client", commandId: "customer.create" },
      { phrase: "create project", commandId: "project.create" },
      { phrase: "start a project", commandId: "project.create" },
      { phrase: "create estimate", commandId: "estimate.create" },
      { phrase: "make an estimate", commandId: "estimate.create" },
      { phrase: "create invoice", commandId: "invoice.create" },
      { phrase: "new invoice", commandId: "invoice.create" },
      { phrase: "create task", commandId: "task.create" },
      { phrase: "add task", commandId: "task.create" },
    ];

    for (const item of checks) {
      const result = resolveIntentFromEntitySet({
        input: buildInput(item.phrase),
        role: "owner",
        entities,
      });

      assert(result.commandPreview?.commandId === item.commandId, `${item.phrase} resolves to ${item.commandId} preview`);
      assert(result.suggestedCommand === null, `${item.phrase} does not execute before clarification`);
      assert(result.requiresClarification, `${item.phrase} requires clarification for missing required fields`);
    }
  });

  test("22. create phrase context is preserved without premature writes", () => {
    const result = resolveIntentFromEntitySet({
      input: buildInput("create an estimate for abc construction"),
      role: "owner",
      entities,
    });

    assert(result.commandPreview?.commandId === "estimate.create", "estimate create phrase resolves semantic estimate.create preview");
    assert(result.resolvedEntity?.entityType === "customer", "customer context is preserved when unambiguous customer phrase is included");
    assert(result.suggestedCommand === null, "no create command is executed before required fields are complete");
    assert(result.message.toLowerCase().includes("customer"), "clarification message asks for required estimate context");
  });

  test("23. navigation phrases remain navigation-only", () => {
    const checks = [
      { phrase: "open customers", forbidden: "customer.create" },
      { phrase: "open projects", forbidden: "project.create" },
      { phrase: "open estimates", forbidden: "estimate.create" },
      { phrase: "open invoices", forbidden: "invoice.create" },
      { phrase: "open tasks", forbidden: "task.create" },
    ];

    for (const item of checks) {
      const result = resolveIntentFromEntitySet({
        input: buildInput(item.phrase),
        role: "owner",
        entities,
      });

      assert(result.suggestedCommand?.commandId !== item.forbidden, `${item.phrase} does not resolve to ${item.forbidden}`);
      if (result.suggestedCommand) {
        assert(result.suggestedCommand.commandId === "dashboard.open" || result.suggestedCommand.commandId === "schedule.open", `${item.phrase} remains navigation behavior`);
      }
    }
  });

  test("24. create targets exist in registry with stable metadata", () => {
    const registry = createOrionCommandRegistry();
    const ids = ["customer.create", "project.create", "estimate.create", "invoice.create", "task.create"];

    for (const id of ids) {
      const command = registry.getById(id);
      assert(Boolean(command), `${id} exists in command registry`);
      assert(command?.coverage.status === "implemented", `${id} remains implemented`);
      assert(command?.confirmationLevel === "NONE", `${id} confirmation metadata remains unchanged`);
      assert(typeof command?.execute === "function", `${id} handler lookup succeeds`);
    }
  });

  test("25. schedule read phrases resolve to schedule.read_range", () => {
    const checks = [
      { phrase: "what is on the schedule today", rangeType: "day", rangeKey: "today" },
      { phrase: "show today's schedule", rangeType: "day", rangeKey: "today" },
      { phrase: "what do i have today", rangeType: "day", rangeKey: "today" },
      { phrase: "what is scheduled tomorrow", rangeType: "day", rangeKey: "tomorrow" },
      { phrase: "show this week's schedule", rangeType: "week", rangeKey: "this_week" },
    ];

    for (const item of checks) {
      const result = resolveIntentFromEntitySet({
        input: buildInput(item.phrase),
        role: "owner",
        entities,
      });

      assert(result.suggestedCommand?.commandId === "schedule.read_range", `${item.phrase} resolves to schedule.read_range`);
      assert(result.suggestedCommand?.params.rangeType === item.rangeType, `${item.phrase} keeps the correct range type`);
      assert(result.suggestedCommand?.params.rangeKey === item.rangeKey, `${item.phrase} keeps the correct range key`);
      assert(result.commandPreview?.commandId === "schedule.read_range", `${item.phrase} keeps the correct preview`);
      assert(!result.requiresClarification, `${item.phrase} does not require clarification`);
    }
  });

  console.log(`\nPhase 7C intent engine results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
