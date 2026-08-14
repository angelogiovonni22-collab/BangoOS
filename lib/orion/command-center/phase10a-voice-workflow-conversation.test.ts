import fs from "node:fs";
import path from "node:path";

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

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const route = read("app/api/orion/command-center/route.ts");
  const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
  const workflow = read("lib/orion/workflows/voice-workflow-assistant.ts");

  test("1. command-center route gates workflow orchestration to voice turns", () => {
    assert(route.includes('req.headers.get("x-orion-voice-turn") === "1"'), "route checks x-orion-voice-turn header");
    assert(route.includes("resolveVoiceWorkflowTurn"), "route imports workflow assistant resolver");
    assert(route.includes("workflowHandled.handled") && route.includes("workflowHandled.intent"), "route short-circuits with workflow intent when handled");
    assert(route.includes("const result = await resolveOrionIntent"), "route falls through to shared resolveOrionIntent when workflow does not handle the turn");
  });

  test("2. voice path tags intent requests as voice turns", () => {
    assert(overlay.includes('"x-orion-voice-turn": "1"'), "overlay includes voice-turn header for spoken intents");
  });

  test("3. overlay handles workflow status without treating it as no-match", () => {
    assert(overlay.includes("payload.statusCategory") && overlay.includes("workflow_"), "overlay checks workflow status category");
    assert(overlay.includes("Workflow step ready.") || overlay.includes("workflowMessage"), "overlay sets workflow conversational status message");
    assert(overlay.includes("globalVoice.requestSpokenResponse"), "overlay forwards workflow prompts through spoken response path");
  });

  test("4. workflow assistant includes deterministic session + confirmation flow", () => {
    assert(workflow.includes("SESSION_TIMEOUT_MS"), "workflow assistant defines timeout-based temporary memory");
    assert(workflow.includes("Would you like me to save it?"), "workflow assistant requires explicit confirmation before save");
    assert(workflow.includes("workflow_not_enabled"), "workflow assistant reports unsupported workflow requests clearly");
  });

  console.log(`\nPhase 10A voice workflow conversation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
