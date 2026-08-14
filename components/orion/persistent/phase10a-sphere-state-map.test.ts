import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const persistent = read("components/orion/persistent/PersistentOrion.tsx");
  const sphere = read("components/orion/persistent/PersistentOrionMiniSphere.tsx");
  const provider = read("components/orion/voice/GlobalOrionVoiceProvider.tsx");

  assert.ok(persistent.includes("mapVoicePhaseToSphereState"), "Persistent Orion includes canonical voice-phase to visual-state mapping");
  assert.ok(persistent.includes("phase === \"awaiting_wake_command\"") && persistent.includes("return \"listening\""), "Awaiting wake command maps to listening state");
  assert.ok(persistent.includes("phase === \"understanding\"") && persistent.includes("return \"thinking\""), "Understanding phase maps to thinking state");
  assert.ok(persistent.includes("phase === \"executing\"") && persistent.includes("return \"executing\""), "Executing phase maps to executing state");
  assert.ok(persistent.includes("phase === \"speaking\"") && persistent.includes("return \"speaking\""), "Speaking phase maps to speaking state");
  assert.ok(persistent.includes("phase === \"clarification_required\"") && persistent.includes("return \"confirmation\""), "Clarification and confirmation phases map to confirmation state");

  assert.ok(sphere.includes("voiceLevel") && sphere.includes("speakingBoost"), "Sphere supports normalized voiceLevel pulse input");
  assert.ok(sphere.includes("if (state === \"speaking\")") && sphere.includes("amp"), "Speaking state has dedicated motion profile");
  assert.ok(sphere.includes("reducedMotion || profile.static"), "Reduced motion remains respected");

  assert.ok(provider.includes("voiceLevel") && provider.includes("subscribeToVoiceLevel"), "Global provider sources voice level from speech adapter");

  console.log("Phase 10A sphere state mapping contracts passed.");
}

main();
