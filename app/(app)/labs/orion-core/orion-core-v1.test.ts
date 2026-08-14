import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { orionCoreScenarioOrder, orionCoreScenarios, type OrionCoreStateId } from "@/lib/labs/orion-core";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function expectScenario(id: OrionCoreStateId) {
  const scenario = orionCoreScenarios[id];
  assert.ok(scenario, `Scenario ${id} should exist`);
  assert.equal(scenario.id, id, `Scenario id should match key for ${id}`);
  return scenario;
}

function runOrionCorePrototypeContractTests() {
  const sphereSource = read("components/labs/orion-core/OrionParticleSphere.tsx");
  const coreSource = read("components/labs/orion-core/OrionCore.tsx");
  const persistentSource = read("components/orion/persistent/PersistentOrion.tsx");
  const appShellSource = read("app/(app)/app-shell.tsx");

  const expectedOrder: OrionCoreStateId[] = [
    "READY",
    "ANALYZING",
    "NEW_INSIGHT",
    "ATTENTION",
    "CRITICAL",
    "STALE_DATA",
    "UNAVAILABLE",
    "REDUCED_MOTION",
  ];

  assert.equal(orionCoreScenarioOrder.length, 8, "Scenario order should include exactly 8 states");
  assert.deepEqual(orionCoreScenarioOrder, expectedOrder, "Scenario order must remain deterministic");

  const keys = Object.keys(orionCoreScenarios).sort();
  assert.deepEqual(keys, [...expectedOrder].sort(), "Scenario keys should exactly match expected states");

  for (const id of expectedOrder) {
    const scenario = expectScenario(id);
    assert.ok(scenario.title.length > 0, `${id}: title should be present`);
    assert.ok(scenario.stateLabel.length > 0, `${id}: stateLabel should be present`);
    assert.ok(scenario.ariaStateLabel.length > 0, `${id}: ariaStateLabel should be present`);
    assert.ok(scenario.motionHint.length > 0, `${id}: motionHint should be present`);
    assert.ok(scenario.textCue.length > 0, `${id}: textCue should be present`);
    assert.ok(scenario.badgeLabel.length > 0, `${id}: badgeLabel should be present`);
    assert.ok(scenario.executiveSnapshot.limitations.length >= 1, `${id}: limitations should not be empty`);
  }

  assert.ok(sphereSource.includes("type LayerId = \"inner\" | \"middle\" | \"ambient\""), "1. layered renderer exists");
  assert.ok(sphereSource.includes("innerSpeedMul"), "2. intelligence core/inner layer motion config exists");
  assert.ok(sphereSource.includes("layer === \"inner\""), "3. inner field layer exists");
  assert.ok(sphereSource.includes("layer === \"middle\""), "4. middle relationship field exists");
  assert.ok(sphereSource.includes("layer === \"ambient\""), "5. ambient field exists");
  assert.ok(sphereSource.includes("eventPaths") && sphereSource.includes("activeEvent"), "6. intelligence-event layer exists");

  assert.ok(!sphereSource.includes("const rim ="), "7. no explicit outer shell is rendered");
  assert.ok(!sphereSource.includes("radius * 1.08") || !sphereSource.includes("rim"), "8. no outer rim is rendered");

  assert.ok(sphereSource.includes("layerAngles") && sphereSource.includes("innerSpeedMul") && sphereSource.includes("middleSpeedMul") && sphereSource.includes("ambientSpeedMul"), "9. layers use independent motion parameters");

  assert.ok(sphereSource.includes("Array.from({ length: particleCount }, (_, index) => randomPointOnSphere(index, particleCount))"), "10. particle generation remains initialization-only");
  assert.ok(!sphereSource.includes("Math.random()") || sphereSource.indexOf("Math.random()") < sphereSource.indexOf("const drawFrame"), "11. no per-frame random regeneration");

  assert.ok(sphereSource.includes("glowInner: \"86, 182, 224\""), "12. Ready palette remains cyan/blue");
  assert.ok(sphereSource.includes("glowInner: \"118, 95, 184\""), "13. Analyzing remains purple");
  assert.ok(sphereSource.includes("glowInner: \"95, 192, 134\""), "14. New Insight remains green");
  assert.ok(sphereSource.includes("glowInner: \"203, 156, 82\""), "15. Attention remains amber/gold");
  assert.ok(sphereSource.includes("glowInner: \"165, 66, 78\""), "16. Critical remains crimson/red");
  assert.ok(sphereSource.includes("glowInner: \"162, 170, 182\""), "17. Stale Data remains white/silver");
  assert.ok(sphereSource.includes("glowInner: \"64, 69, 77\""), "18. Unavailable remains gray");

  assert.ok(sphereSource.includes("reducedMode"), "19. reduced-motion static mode exists");
  assert.ok(sphereSource.includes("if (!reducedMode && shouldAnimate && eventPaths.length > 0)"), "20. event travel is disabled in reduced motion");

  assert.ok(sphereSource.includes("cancelAnimationFrame"), "21. lifecycle cleanup remains intact");
  assert.ok(sphereSource.includes("ResizeObserver") && sphereSource.includes("disconnect()"), "22. ResizeObserver cleanup remains intact");
  assert.ok(sphereSource.includes("visibilitychange") && sphereSource.includes("document.visibilityState"), "23. hidden-tab pause remains intact");
  assert.ok(sphereSource.includes("loopTokenRef"), "24. Strict Mode loop protection remains intact");

  const combined = `${sphereSource}\n${coreSource}`;
  assert.ok(!combined.includes("@/lib/supabase"), "25. no Supabase imports");
  assert.ok(!combined.includes("fetch("), "26. no network calls");
  assert.ok(!combined.toLowerCase().includes("openai"), "27. no OpenAI calls");
  assert.ok(!combined.includes("@/lib/orion/executive-brief-service"), "28. no production-service imports");

  assert.ok(persistentSource.includes("export function PersistentOrion"), "29. Persistent Orion is untouched");
  assert.ok(appShellSource.includes("<PersistentOrion />"), "30. app-shell mount remains untouched in this phase");

  assert.ok(coreSource.includes("OrionParticleSphere"), "Orion core should render particle sphere in showcase");

  console.log("Orion Core v1 fixture contract passed.");
}

runOrionCorePrototypeContractTests();
