import fs from "node:fs";
import path from "node:path";
import {
  buildBusinessSignalFixtures,
  buildDecisionPack,
  computePulseContributions,
  normalizeBusinessSignals,
} from "./index";

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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  const signalsA = buildBusinessSignalFixtures();
  const signalsB = buildBusinessSignalFixtures();

  await test("1. deterministic and repeatable fixtures", () => {
    assert(signalsA.length === 8, "eight fixture signals are generated");
    assert(JSON.stringify(signalsA) === JSON.stringify(signalsB), "fixture generation is repeatable");
  });

  await test("2. business signal schema completeness", () => {
    for (const signal of signalsA) {
      assert(Boolean(signal.id), "signal id exists");
      assert(Boolean(signal.category), "signal category exists");
      assert(Boolean(signal.severity), "signal severity exists");
      assert(Boolean(signal.observation), "signal observation exists");
      assert(Boolean(signal.businessImpact), "signal businessImpact exists");
      assert(Array.isArray(signal.evidence), "signal evidence array exists");
      assert(Array.isArray(signal.missingInformation), "signal missingInformation array exists");
      assert(Boolean(signal.recommendation.title), "signal recommendation title exists");
      assert(Boolean(signal.approvalRequired), "signal approvalRequired exists");
      assert(Boolean(signal.freshness), "signal freshness exists");
      assert(Boolean(signal.createdAt), "signal createdAt exists");
    }
  });

  await test("3. confidence model behavior", () => {
    for (const signal of signalsA) {
      assert(signal.confidence.percent >= 0 && signal.confidence.percent <= 100, "confidence percent is bounded 0-100");
      assert(signal.confidence.reasons.length > 0, "confidence reasons are included");
    }

    const crewMissingUpdate = signalsA.find((signal) => signal.observation.includes("Crew Alpha"));
    assert(Boolean(crewMissingUpdate), "crew missing update fixture exists");
    assert(Boolean(crewMissingUpdate?.confidence.reasons.some((reason) => reason.toLowerCase().includes("missing"))), "confidence reasons include missing-information explanation");
  });

  await test("4. business impact calculation", () => {
    const safetyExpired = signalsA.find((signal) => signal.category === "Safety");
    assert(Boolean(safetyExpired), "safety fixture exists");
    assert(safetyExpired?.businessImpact === "CRITICAL", "safety expired fixture resolves to CRITICAL impact");
  });

  await test("5. recommendation generation stays advisory", () => {
    for (const signal of signalsA) {
      assert(Boolean(signal.recommendation.reason), "recommendation includes reason");
      assert(Boolean(signal.recommendation.expectedOutcome), "recommendation includes expected outcome");
      assert(Boolean(signal.recommendation.approvalRequired), "recommendation includes approval boundary");
      const text = `${signal.recommendation.title} ${signal.recommendation.expectedOutcome}`.toLowerCase();
      assert(!text.includes("execute"), "recommendation avoids execute language");
      assert(!text.includes("automatic"), "recommendation avoids automatic language");
    }
  });

  await test("6. decision pack generation", () => {
    const sorted = normalizeBusinessSignals(signalsA);
    const first = sorted[0];
    const pack = buildDecisionPack(first, sorted.slice(1, 4));

    assert(pack.signalId === first.id, "decision pack references the selected signal");
    assert(pack.relatedSignals.length === 3, "decision pack includes related signal references");
    assert(pack.evidence.length === first.evidence.length, "decision pack carries evidence");
    assert(pack.approvalBoundary === first.approvalRequired, "decision pack carries approval boundary");
  });

  await test("7. company pulse contribution generation", () => {
    for (const signal of signalsA) {
      const contribution = computePulseContributions(signal);
      assert(contribution.signalId === signal.id, "contribution ties back to source signal");
      assert(contribution.contributions.Operations >= 0 && contribution.contributions.Operations <= 100, "operations contribution is 0-100");
      assert(contribution.contributions.Financial >= 0 && contribution.contributions.Financial <= 100, "financial contribution is 0-100");
      assert(contribution.contributions.Workforce >= 0 && contribution.contributions.Workforce <= 100, "workforce contribution is 0-100");
      assert(contribution.contributions.Safety >= 0 && contribution.contributions.Safety <= 100, "safety contribution is 0-100");
      assert(contribution.contributions.Equipment >= 0 && contribution.contributions.Equipment <= 100, "equipment contribution is 0-100");
      assert(contribution.contributions.Customer >= 0 && contribution.contributions.Customer <= 100, "customer contribution is 0-100");
    }
  });

  await test("8. fixture-only and no production writes", () => {
    const source = read("lib/orion/decision-engine/fixtures.ts");
    const combined = [
      read("lib/orion/decision-engine/pipeline.ts"),
      read("lib/orion/decision-engine/contributions.ts"),
      read("lib/orion/decision-engine/recommendations.ts"),
      source,
    ].join("\n");

    assert(source.includes("const FIXTURE_TIME"), "fixtures are deterministic and local");
    assert(!combined.includes("@/lib/supabase"), "decision engine does not import Supabase");
    assert(!combined.includes("fetch("), "decision engine does not call network APIs");
    assert(!combined.includes(".insert("), "decision engine does not write inserts");
    assert(!combined.includes(".update("), "decision engine does not write updates");
    assert(!combined.includes(".delete("), "decision engine does not write deletes");
    assert(!combined.includes("openai"), "decision engine does not call OpenAI");
  });

  console.log(`\nOrion Decision Engine v1 test results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
