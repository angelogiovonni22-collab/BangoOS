import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveIntentFromEntitySet } from "./resolver";
import type { OrionIntentEntityRecord, OrionIntentInput } from "./types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function baseRoute() {
  return {
    pathname: "/customers",
    projectId: null,
    customerId: null,
    estimateId: null,
    invoiceId: null,
    employeeId: null,
    crewId: null,
    dashboardWidgetId: null,
    timelineItemId: null,
  };
}

function input(text: string): OrionIntentInput {
  return {
    input: text,
    route: baseRoute(),
  };
}

function customer(params: {
  id: string;
  label: string;
  subtitle?: string;
  terms?: string[];
}): OrionIntentEntityRecord {
  return {
    entityType: "customer",
    entityId: params.id,
    label: params.label,
    subtitle: params.subtitle || "Customer active",
    terms: params.terms || [params.label],
  };
}

function dashboardEntity(): OrionIntentEntityRecord {
  return {
    entityType: "dashboard",
    entityId: "dashboard",
    label: "Dashboard",
    subtitle: "Executive dashboard",
    terms: ["dashboard", "home"],
  };
}

function resolveWithEntities(text: string, entities: OrionIntentEntityRecord[]) {
  return resolveIntentFromEntitySet({
    input: input(text),
    role: "owner",
    entities,
  });
}

function main() {
  test("1. exact unique name selects one customer", () => {
    const result = resolveWithEntities("Update customer ORION PHASE 1 TEST CUSTOMER.", [
      customer({ id: "cust-exact", label: "ORION PHASE 1 TEST CUSTOMER", terms: ["ORION PHASE 1 TEST CUSTOMER", "512-555-1212"] }),
      customer({ id: "cust-other", label: "ORION PHASE 1 TEST CUSTOMER NORTH", terms: ["ORION PHASE 1 TEST CUSTOMER NORTH"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-exact", "exact name resolves the intended customer");
    assert(!result.message.toLowerCase().includes("multiple"), "exact unique name does not trigger false multiple-match ambiguity");
  });

  test("2. exact unique name beats broader substring matches", () => {
    const result = resolveWithEntities("open customer Johnson Roofing", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
      customer({ id: "cust-2", label: "Johnson Roofing North Division", terms: ["Johnson Roofing North Division"] }),
      customer({ id: "cust-3", label: "The Johnson Roofing Group", terms: ["The Johnson Roofing Group"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "exact match wins over fuzzy matches");
    assert(!result.requiresClarification, "exact match suppresses false ambiguity");
  });

  test("3. case differences still match exactly", () => {
    const result = resolveWithEntities("open customer johnson roofing", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "case-insensitive exact match resolves");
  });

  test("4. extra spaces still match exactly", () => {
    const result = resolveWithEntities("open customer   Johnson   Roofing   ", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "whitespace normalization resolves exact match");
  });

  test("5. trailing punctuation does not break exact matching", () => {
    const result = resolveWithEntities("open customer Johnson Roofing...", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "trailing punctuation is ignored for exact matching");
  });

  test("6. duplicate rows with same UUID count once", () => {
    const result = resolveWithEntities("open customer Johnson Roofing", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125551212"] }),
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing", "johnson@example.com"] }),
    ]);

    assert(result.candidates.length === 1, "duplicate UUID candidates are deduplicated");
    assert(result.resolvedEntity?.entityId === "cust-1", "deduplicated candidate resolves correctly");
  });

  test("7. two distinct exact duplicates require clarification with discriminators", () => {
    const result = resolveWithEntities("open customer Johnson Roofing", [
      customer({ id: "cust-a", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125551212"] }),
      customer({ id: "cust-b", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125558844"] }),
    ]);

    assert(result.requiresClarification, "distinct exact duplicates require clarification");
    assert(result.message.includes("phone ending in 1212") || result.message.includes("phone ending in 8844"), "clarification includes useful discriminator");
  });

  test("8. unique prefix match selects one customer", () => {
    const result = resolveWithEntities("open customer Johns", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
      customer({ id: "cust-2", label: "Acme Masonry", terms: ["Acme Masonry"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "unique prefix resolves a single customer");
    assert(!result.requiresClarification, "unique prefix does not require clarification");
  });

  test("9. ambiguous prefix requires clarification", () => {
    const result = resolveWithEntities("open customer John", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125551212"] }),
      customer({ id: "cust-2", label: "Johnstone Electric", terms: ["Johnstone Electric", "5125558844"] }),
    ]);

    assert(result.requiresClarification, "ambiguous prefix requires clarification");
    assert(result.candidates.length === 2, "ambiguous prefix returns both candidates");
  });

  test("10. fuzzy matching is used only after exact and prefix checks", () => {
    const exactResult = resolveWithEntities("open customer Apex Roofing", [
      customer({ id: "cust-exact", label: "Apex Roofing", terms: ["Apex Roofing"] }),
      customer({ id: "cust-fuzzy", label: "Downtown Apex Roofing Services", terms: ["Downtown Apex Roofing Services"] }),
    ]);

    const fuzzyResult = resolveWithEntities("open customer pex roof", [
      customer({ id: "cust-exact", label: "Apex Roofing", terms: ["Apex Roofing"] }),
      customer({ id: "cust-fuzzy", label: "Downtown Apex Roofing Services", terms: ["Downtown Apex Roofing Services"] }),
    ]);

    assert(exactResult.resolvedEntity?.entityId === "cust-exact", "exact tier resolves first");
    assert(fuzzyResult.candidates.length >= 1, "fuzzy tier still resolves when exact/prefix are absent");
  });

  test("11. archived records remain eligible per existing policy", () => {
    const result = resolveWithEntities("open customer Legacy Builders", [
      customer({ id: "cust-archived", label: "Legacy Builders", subtitle: "Customer archived", terms: ["Legacy Builders", "legacy@example.com"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-archived", "archived customer can still be selected");
  });

  test("12. company isolation query is preserved in service", () => {
    const serviceSource = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/service.ts"), "utf8");
    assert(serviceSource.includes('.from("customers")'), "customer entities are loaded from the customer table");
    assert(serviceSource.includes('.eq("company_id", workspace.companyId)'), "customer entity query remains company-scoped");
  });

  test("13. customer.open uses the same resolver selection", () => {
    const result = resolveWithEntities("open customer ORION PHASE 1 TEST CUSTOMER", [
      customer({ id: "cust-1", label: "ORION PHASE 1 TEST CUSTOMER", terms: ["ORION PHASE 1 TEST CUSTOMER"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "customer.open selects via the shared resolver");
    assert(result.suggestedCommand?.commandId === "customer.open", "open intent maps to customer.open");
  });

  test("14. customer.update uses the same resolver selection", () => {
    const result = resolveWithEntities("update customer ORION PHASE 1 TEST CUSTOMER", [
      customer({ id: "cust-1", label: "ORION PHASE 1 TEST CUSTOMER", terms: ["ORION PHASE 1 TEST CUSTOMER"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "customer.update phrase selects via the shared resolver");
    assert(result.message.includes("What would you like to update?"), "update flow asks what to change after unique match");
  });

  test("15. customer.archive uses the same resolver selection", () => {
    const result = resolveWithEntities("archive customer ORION PHASE 1 TEST CUSTOMER", [
      customer({ id: "cust-1", label: "ORION PHASE 1 TEST CUSTOMER", terms: ["ORION PHASE 1 TEST CUSTOMER"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "customer.archive phrase selects via the shared resolver");
    assert(result.suggestedCommand?.commandId === "customer.archive", "archive phrase maps to customer.archive");
  });

  test("16. customer.restore uses the same resolver selection", () => {
    const result = resolveWithEntities("restore customer ORION PHASE 1 TEST CUSTOMER", [
      customer({ id: "cust-1", label: "ORION PHASE 1 TEST CUSTOMER", subtitle: "Customer archived", terms: ["ORION PHASE 1 TEST CUSTOMER"] }),
    ]);

    assert(result.resolvedEntity?.entityId === "cust-1", "customer.restore phrase selects via the shared resolver");
    assert(result.suggestedCommand?.commandId === "customer.restore", "restore phrase maps to customer.restore");
  });

  test("17. resolver performs no persistence before selection", () => {
    const resolverSource = readFileSync(resolve(process.cwd(), "lib/orion/intent-engine/resolver.ts"), "utf8");
    assert(!resolverSource.includes('.insert('), "resolver does not insert records");
    assert(!resolverSource.includes('.update('), "resolver does not update records");
    assert(!resolverSource.includes('.delete('), "resolver does not delete records");
  });

  test("18. navigation behavior remains deterministic", () => {
    const result = resolveWithEntities("open dashboard", [
      customer({ id: "cust-1", label: "Dashboard Renovation", terms: ["Dashboard Renovation"] }),
      dashboardEntity(),
    ]);

    assert(result.suggestedCommand?.commandId === "dashboard.open", "dashboard navigation remains unchanged");
    assert(!result.requiresClarification, "dashboard navigation does not regress into clarification");
  });

  test("19. create phrase variants resolve to customer.create preview without customer matching", () => {
    const phrases = [
      "add new customer",
      "create new customer",
      "create a customer",
      "add a customer",
      "new customer",
    ];

    for (const phrase of phrases) {
      const result = resolveWithEntities(phrase, [
        customer({ id: "cust-a", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125551212"] }),
        customer({ id: "cust-b", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125558844"] }),
      ]);

      assert(result.commandPreview?.commandId === "customer.create", `${phrase} resolves to customer.create preview`);
      assert(result.candidates.length === 0, `${phrase} does not run customer candidate matching`);
      assert(!result.message.toLowerCase().includes("multiple"), `${phrase} does not return multiple-match ambiguity`);
    }
  });

  test("20. named create phrase captures proposed name without customer lookup", () => {
    const result = resolveWithEntities("create customer named Johnson Roofing", [
      customer({ id: "cust-a", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125551212"] }),
      customer({ id: "cust-b", label: "Johnson Roofing", terms: ["Johnson Roofing", "5125558844"] }),
    ]);

    assert(result.commandPreview?.commandId === "customer.create", "named create phrase remains customer.create");
    assert(result.message.toLowerCase().includes("captured johnson roofing"), "named create phrase captures the proposed customer name");
    assert(result.candidates.length === 0, "named create phrase does not run customer matching");
  });

  test("21. create/open/update intents do not collide", () => {
    const createResult = resolveWithEntities("create new customer", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
    ]);
    const openResult = resolveWithEntities("open customer Johnson Roofing", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
    ]);
    const updateResult = resolveWithEntities("update customer Johnson Roofing", [
      customer({ id: "cust-1", label: "Johnson Roofing", terms: ["Johnson Roofing"] }),
    ]);

    assert(createResult.commandPreview?.commandId === "customer.create", "create phrase maps to customer.create preview");
    assert(openResult.suggestedCommand?.commandId === "customer.open", "open phrase maps to customer.open");
    assert(updateResult.message.includes("What would you like to update?"), "update phrase keeps update follow-up prompt");
  });

  console.log(`\nPhase 11A customer resolution results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
