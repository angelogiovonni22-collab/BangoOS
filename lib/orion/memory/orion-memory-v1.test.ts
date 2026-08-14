import fs from "node:fs";
import path from "node:path";
import {
  buildCurrentCrewDecisionPack,
  buildCurrentCrewMissingUpdateSignal,
  buildDeterministicMemoryId,
  buildMemorySignature,
  buildOrionMemoryEnrichment,
  buildOrionMemoryFixtures,
  rankSimilarMemories,
  scoreMemorySimilarity,
  ORION_MEMORY_SIMILARITY_THRESHOLDS,
} from "./index";
import type { OrionOrganizationalMemoryRecord, OrionSignalMemoryInput } from "./index";

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

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  const fixtures = buildOrionMemoryFixtures();
  const signal = buildCurrentCrewMissingUpdateSignal();
  const decisionPack = buildCurrentCrewDecisionPack();

  await test("1-4. stable signatures and ids", () => {
    const sigA = buildMemorySignature(signal);
    const sigB = buildMemorySignature(signal);

    assert(sigA.key === sigB.key, "same facts produce same signature");
    assert(sigA.normalizedEvidenceKeys.join("|") === sigB.normalizedEvidenceKeys.join("|"), "signature evidence keys are stable");

    const changed = buildMemorySignature({ ...signal, signalType: "crew_status_warning" });
    assert(sigA.key !== changed.key, "different facts produce different signature");

    const idA = buildDeterministicMemoryId({
      companyId: "company-a",
      sourceSignalId: "sig-1",
      sourceDecisionPackId: "pack-1",
      ruleId: "rule-1",
      ruleVersion: "1.0.0",
      memoryVersion: "orion-memory-v1",
    });
    const idB = buildDeterministicMemoryId({
      companyId: "company-a",
      sourceSignalId: "sig-1",
      sourceDecisionPackId: "pack-1",
      ruleId: "rule-1",
      ruleVersion: "1.0.0",
      memoryVersion: "orion-memory-v1",
    });
    assert(idA === idB, "stable memory ids are deterministic");
  });

  await test("5-11. similarity scoring behavior", () => {
    const exactCandidate = fixtures.find((item) => item.sourceSignalId === "sig-crew-missing-1");
    const strongCandidate = fixtures.find((item) => item.sourceSignalId === "sig-crew-missing-2");
    const unrelatedCandidate = fixtures.find((item) => item.sourceSignalId === "sig-false-positive-1");

    if (!exactCandidate || !strongCandidate || !unrelatedCandidate) {
      assert(false, "required fixtures exist");
      return;
    }

    const moderateCandidate: OrionOrganizationalMemoryRecord = {
      ...exactCandidate,
      id: "moderate-candidate",
      sourceSignalId: "sig-moderate-candidate",
      sourceDecisionPackId: "pack-moderate-candidate",
      entityReferences: [{ entityType: "crew", entityId: "crew-bravo", companyId: "company-a" }],
      normalizedEvidenceKeys: ["missing_update"],
      severity: "medium" as const,
      freshness: "live" as const,
      dataCompleteness: { isComplete: false, missingInformationKeys: ["follow_up_confirmed", "assigned_supervisor"] },
    };

    const exact = scoreMemorySimilarity(signal, exactCandidate);
    const strong = scoreMemorySimilarity(signal, strongCandidate);
    const moderate = scoreMemorySimilarity(signal, moderateCandidate);
    const unrelated = scoreMemorySimilarity(signal, unrelatedCandidate);

    assert(exact.level === "exact_match" || exact.level === "strong_match", "exact similarity resolves at top level");
    assert(strong.score >= ORION_MEMORY_SIMILARITY_THRESHOLDS.strong_match, "strong similarity threshold reached");
    assert(moderate.score >= ORION_MEMORY_SIMILARITY_THRESHOLDS.moderate_match && moderate.score < ORION_MEMORY_SIMILARITY_THRESHOLDS.strong_match, "moderate similarity threshold reached");
    assert(unrelated.level === "unrelated" || unrelated.score < ORION_MEMORY_SIMILARITY_THRESHOLDS.weak_match, "unrelated signals remain below weak threshold");

    const evidenceFactor = exact.matchedFactors.find((factor) => factor.factor === "overlappingEvidence");
    assert(Boolean(evidenceFactor && evidenceFactor.contribution > 0), "evidence overlap contributes to score");

    const ruleFactor = exact.matchedFactors.find((factor) => factor.factor === "sameRule");
    assert(Boolean(ruleFactor), "rule/version matching contributes to score");

    const entityFactor = exact.matchedFactors.find((factor) => factor.factor === "sameEntityType");
    assert(Boolean(entityFactor), "entity-type matching contributes to score");
  });

  await test("12-21. enrichment, isolation, age, outcomes, and patterns", () => {
    const enrichment = buildOrionMemoryEnrichment({
      currentSignal: signal,
      decisionPack,
      memories: fixtures,
      nowIso: "2026-08-01T18:00:00.000Z",
    });

    const unresolvedSignal: OrionSignalMemoryInput = {
      ...signal,
      signalId: "sig-current-equipment",
      category: "Equipment",
      signalType: "equipment_inspection_warning",
      entityReferences: [{ entityType: "equipment", entityId: "equip-44", companyId: "company-a" }],
      normalizedEvidenceKeys: ["inspection_warning", "maintenance_due", "missing_update"],
      businessImpact: "HIGH" as const,
    };

    const unresolvedEnrichment = buildOrionMemoryEnrichment({
      currentSignal: unresolvedSignal,
      decisionPack,
      memories: fixtures,
      nowIso: "2026-08-01T18:00:00.000Z",
      minimumScore: 0,
    });

    const matchedIds = enrichment.historicalContext.matchedMemoryIds;
    const matchedRecords = fixtures.filter((item) => matchedIds.includes(item.id));

    assert(matchedRecords.every((item) => item.companyId === "company-a"), "company isolation blocks cross-company memories");
    assert(!matchedRecords.some((item) => item.companyId === "company-b"), "mixed-company fixtures remain isolated");
    assert(matchedRecords.every((item) => item.entityReferences.every((entity) => !entity.companyId || entity.companyId === "company-a")), "cross-company entity references are ignored");

    const hasStale = matchedRecords.some((item) => item.sourceSignalId === "sig-old-relevant-1");
    assert(hasStale, "old but relevant memory remains available");

    assert(enrichment.memoryConfidence.reasons.length > 0, "memory confidence returns deterministic reasons");
    assert(enrichment.memoryConfidence.score >= 0 && enrichment.memoryConfidence.score <= 1, "memory confidence is bounded");

    const hasUnresolvedOutcome = unresolvedEnrichment.priorOutcomes.includes("unresolved");
    assert(hasUnresolvedOutcome, "unresolved outcome handling is included in context");

    const hasFalsePositive = enrichment.priorOutcomes.includes("false_positive") || !matchedRecords.some((item) => item.sourceSignalId === "sig-false-positive-1");
    assert(hasFalsePositive, "false-positive outcome is handled deterministically");

    const hasConflict = enrichment.memoryLimitations.some((item) => item.toLowerCase().includes("rule") || item.toLowerCase().includes("conflicting"));
    assert(hasConflict || enrichment.memoryConfidence.reasons.some((item) => item.includes("conflicting")), "conflicting outcomes are reflected");

    assert(enrichment.historicalContext.observedPatterns.length > 0, "pattern detection produces deterministic summaries above sample threshold");
    assert(enrichment.historicalContext.observedPatterns.some((item) => item.key.includes("repeated_entity")), "repeated-entity pattern detected");
    assert(enrichment.historicalContext.observedPatterns.some((item) => item.key.includes("repeated_weekday")), "repeated-weekday pattern detected");
    assert(enrichment.historicalContext.observedPatterns.some((item) => item.key.includes("repeated_action")), "repeated-action pattern detected");
  });

  await test("22-27. guardrails, ordering, and immutability", () => {
    const originalPack = JSON.parse(JSON.stringify(decisionPack));
    const enrichmentA = buildOrionMemoryEnrichment({
      currentSignal: signal,
      decisionPack,
      memories: fixtures,
      nowIso: "2026-08-01T18:00:00.000Z",
    });
    const enrichmentB = buildOrionMemoryEnrichment({
      currentSignal: signal,
      decisionPack,
      memories: fixtures,
      nowIso: "2026-08-01T18:00:00.000Z",
    });

    assert(JSON.stringify(decisionPack) === JSON.stringify(originalPack), "original Decision Pack remains unchanged");

    const patternText = enrichmentA.historicalContext.observedPatterns.map((item) => item.statement).join("\n").toLowerCase();
    assert(!patternText.includes("probably") && !patternText.includes("believes"), "no unsupported narrative is emitted");
    assert(!patternText.includes("unreliable") && !patternText.includes("ranking"), "no employee ranking language is emitted");
    assert(!patternText.includes("personality"), "no personality inference language is emitted");

    const rankedA = rankSimilarMemories({ currentSignal: signal, memories: fixtures });
    const rankedB = rankSimilarMemories({ currentSignal: signal, memories: fixtures });
    assert(JSON.stringify(rankedA) === JSON.stringify(rankedB), "deterministic ordering is preserved");
    assert(JSON.stringify(enrichmentA) === JSON.stringify(enrichmentB), "deterministic enrichment output is preserved");
  });

  await test("28-32. offline read-only fixture-only constraints", () => {
    const files = [
      "lib/orion/memory/memory-service.ts",
      "lib/orion/memory/memory-context-builder.ts",
      "lib/orion/memory/similarity-engine.ts",
      "lib/orion/memory/fixtures.ts",
    ];

    const combined = files.map((file) => read(file)).join("\n").toLowerCase();

    assert(!combined.includes("@/lib/supabase") && !combined.includes("from(\""), "no Supabase usage in Orion memory v1");
    assert(!combined.includes("fetch("), "no network calls in Orion memory v1");
    assert(!combined.includes(".insert(") && !combined.includes(".update(") && !combined.includes(".delete("), "no write actions in Orion memory v1");
    assert(!combined.includes("openai") && !combined.includes("chat.completions"), "no OpenAI or AI model usage in Orion memory v1");

    const fixtureSource = read("lib/orion/memory/fixtures.ts");
    assert(fixtureSource.includes("buildOrionMemoryFixtures"), "fixture-only behavior is defined and available");
  });

  console.log(`\nOrion Memory v1 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
