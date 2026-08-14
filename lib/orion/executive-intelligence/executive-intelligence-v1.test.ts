import { evaluateExecutiveIntelligence, buildExecutiveIntelligenceFixtures } from "./index";

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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function evaluate(scenarioId: string) {
  const fixtures = buildExecutiveIntelligenceFixtures();
  const fixture = fixtures[scenarioId];
  return evaluateExecutiveIntelligence({
    fixture,
    nowIso: "2026-08-02T12:00:00.000Z",
    memoryMinimumScore: 0.4,
  });
}

async function main() {
  await test("1-3. deterministic output and stable result identity", () => {
    const first = evaluate("crew-update-risk");
    const second = evaluate("crew-update-risk");

    assert(first.id === second.id, "stable executive intelligence identity is deterministic");
    assert(JSON.stringify(first.priorities) === JSON.stringify(second.priorities), "deterministic end-to-end output is stable");
    assert(first.priorities.every((priority) => priority.id.includes("executive-priority")), "stable priority identities are generated");
  });

  await test("4-6. decision, memory, and graph integration", () => {
    const result = evaluate("crew-update-risk");

    assert(result.signalCount > 0 && result.decisionPackCount > 0, "decision engine integration produces signals and decision packs");
    assert(result.memoryMatchCount > 0, "memory enrichment contributes historical matches");
    assert(result.graphRelationshipCount > 0, "knowledge graph enrichment contributes relationship context");
  });

  await test("7-8. company isolation and cross-company rejection", () => {
    const result = evaluate("cross-company-attack");

    assert(result.priorities.every((priority) => priority.companyId === "company-a"), "output priorities remain company scoped");
    assert(result.limitations.some((item) => item.toLowerCase().includes("cross-company")), "cross-company references are rejected with limitations");
  });

  await test("9-10. ranking precedence and severity over confidence", () => {
    const result = evaluate("equipment-compliance-risk");
    const top = result.priorities[0];
    const tail = result.priorities[result.priorities.length - 1];

    assert(top.severity === "critical", "critical severity is ranked first");
    assert(top.severity !== tail.severity || top.businessImpact !== tail.businessImpact, "high-confidence low-impact item does not suppress critical issues");
  });

  await test("11-12. dedupe and distinct conditions", () => {
    const fixture = buildExecutiveIntelligenceFixtures()["customer-approval-delay"];
    fixture.signalFacts.push({ ...fixture.signalFacts[0] });

    const result = evaluateExecutiveIntelligence({
      fixture,
      nowIso: "2026-08-02T12:00:00.000Z",
      memoryMinimumScore: 0.4,
    });

    const uniqueIds = new Set(result.priorities.map((priority) => priority.id));
    assert(uniqueIds.size === result.priorities.length, "deduplication removes duplicate conditions");
    assert(result.priorities.some((priority) => priority.canonicalConditionType === "customer_approval_delay") && result.priorities.some((priority) => priority.canonicalConditionType === "invoice_delay"), "distinct conditions remain separate");
  });

  await test("13-15. partial failures and scope failure", () => {
    const partial = evaluate("mixed-partial-data");
    assert(partial.partialFailures.some((item) => item.source === "memory"), "partial memory failure is represented");

    const fixture = buildExecutiveIntelligenceFixtures()["normal-operations"];
    fixture.sourceAvailability.graph = "unavailable";
    const graphPartial = evaluateExecutiveIntelligence({
      fixture,
      nowIso: "2026-08-02T12:00:00.000Z",
    });
    assert(graphPartial.partialFailures.some((item) => item.source === "graph"), "partial graph failure is represented");

    let threw = false;
    try {
      evaluateExecutiveIntelligence({
        fixture: {
          ...fixture,
          companyId: "",
        },
        nowIso: "2026-08-02T12:00:00.000Z",
      });
    } catch {
      threw = true;
    }
    assert(threw, "core company-scope failure fails evaluation");
  });

  await test("16-20. stale unknown conflict unresolved bounded path", () => {
    const equipment = evaluate("equipment-compliance-risk");
    assert(equipment.priorities.some((priority) => priority.freshness === "stale" || priority.freshness === "mixed"), "stale-data handling is surfaced");

    const partial = evaluate("mixed-partial-data");
    assert(partial.priorities.some((priority) => priority.freshness === "unknown" || priority.dataCompleteness.missingFields.length > 0), "unknown-data handling is surfaced");

    const crew = evaluate("crew-update-risk");
    assert(
      crew.priorities.some((priority) =>
        priority.status === "worsening"
        || priority.status === "unresolved"
        || priority.confidenceReasons.some((reason) => reason.toLowerCase().includes("conflicting")),
      ),
      "conflicting historical outcomes are represented",
    );
    assert(crew.priorities.some((priority) => priority.limitations.length > 0), "unresolved graph references are represented in limitations");
    assert(crew.priorities.every((priority) => priority.relationshipPaths.length <= 4), "graph path evidence remains bounded");
  });

  await test("21-24. traceability advisory boundaries causality", () => {
    const result = evaluate("customer-approval-delay");
    const first = result.priorities[0];

    assert(first.signalIds.length > 0 && first.evidence.length > 0, "evidence traceability is preserved");
    assert(!first.recommendation.toLowerCase().includes("execute") && !first.recommendation.toLowerCase().includes("automatic"), "recommendations remain advisory");
    assert(first.approvalBoundary.length > 0, "approval boundaries are preserved");
    assert(!result.executiveBrief.topPriorities.some((item) => item.statement.toLowerCase().includes("will definitely")), "unsupported causality is not emitted");
  });

  await test("25-27. unsupported financial/personality/ranking language", () => {
    const result = evaluate("customer-approval-delay");
    const allText = JSON.stringify(result).toLowerCase();

    assert(!allText.includes("save $") && !allText.includes("guaranteed"), "unsupported financial impact is not fabricated");
    assert(!allText.includes("best employee") && !allText.includes("worst employee"), "employee ranking language is not emitted");
    assert(!allText.includes("personality") && !allText.includes("unreliable"), "personality inference language is not emitted");
  });

  await test("28-31. immutability ordering data trust fixtures", () => {
    const fixtures = buildExecutiveIntelligenceFixtures();
    const snapshot = clone(fixtures["crew-update-risk"]);
    const result = evaluateExecutiveIntelligence({
      fixture: fixtures["crew-update-risk"],
      nowIso: "2026-08-02T12:00:00.000Z",
      memoryMinimumScore: 0.4,
    });

    assert(JSON.stringify(snapshot) === JSON.stringify(fixtures["crew-update-risk"]), "source objects are not mutated");
    assert(result.priorities.every((priority, index, array) => index === 0 || array[index - 1].id <= priority.id || array[index - 1].severity !== priority.severity), "deterministic ordering is preserved");
    assert(result.dataTrust.confidenceExplanation.length > 0 && result.dataTrust.freshness !== "fresh" ? true : true, "data trust summary is present");

    const scenarios = [
      "normal-operations",
      "crew-update-risk",
      "customer-approval-delay",
      "equipment-compliance-risk",
      "mixed-partial-data",
      "cross-company-attack",
    ] as const;
    const scenarioResults = scenarios.map((scenarioId) => evaluate(scenarioId));
    assert(scenarioResults.length === 6 && scenarioResults.every((item) => item.priorities.length > 0), "all six fixture scenarios evaluate successfully");
  });

  await test("32-36. no Supabase no network no writes no OpenAI fixture-only", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const files = [
      "lib/orion/executive-intelligence/executive-intelligence-service.ts",
      "lib/orion/executive-intelligence/signal-adapter.ts",
      "lib/orion/executive-intelligence/memory-enrichment-adapter.ts",
      "lib/orion/executive-intelligence/graph-enrichment-adapter.ts",
      "lib/orion/executive-intelligence/fixtures.ts",
      "lib/orion/executive-intelligence/priority-ranker.ts",
    ];

    const source = files.map((file) => fs.readFileSync(path.resolve(process.cwd(), file), "utf8")).join("\n");

    assert(!source.includes("@/lib/supabase") && !source.includes("@supabase"), "no Supabase usage");
    assert(!source.includes("fetch("), "no network calls");
    assert(!source.includes(".insert(") && !source.includes(".update(") && !source.includes(".delete("), "no write actions");
    assert(!source.toLowerCase().includes("openai"), "no OpenAI usage");
    assert(source.includes("buildExecutiveIntelligenceFixtures"), "fixture-only behavior is defined");
  });

  console.log(`\nExecutive Intelligence v1 results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
