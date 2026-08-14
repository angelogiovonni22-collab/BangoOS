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

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const index = read("lib/orion/commands/index.ts");
  const commands = read("lib/orion/commands/project-operational-readouts.ts");
  const voice = read("lib/orion/voice/project-ops-voice-intent.ts");
  const operationalVoice = read("lib/orion/voice/operational-voice-intent.ts");

  console.log("\nOrion project operational readouts contract");
  assert(index.includes('import "./project-operational-readouts";'), "project operational command registration loads globally");
  assert(commands.includes('id: "project.workforce_summary"'), "project workforce read command is registered");
  assert(commands.includes('id: "project.change_order_summary"'), "project change-order read command is registered");
  assert(commands.includes("operations.data.workforceBoard.filter"), "workforce answer uses live Operations workforce board");
  assert(commands.includes('row.decisionType === "change_order"'), "change-order answer uses live pending decision data");
  assert(commands.match(/confirmationLevel: "NONE"/g)?.length === 2, "both read-only commands avoid destructive-action confirmation");
  assert(voice.includes("who is scheduled") && voice.includes("who is assigned"), "voice intent recognizes workforce questions");
  assert(voice.includes("outstanding") && voice.includes("change\\s+orders"), "voice intent recognizes outstanding change-order questions");
  assert(voice.includes('"project.workforce_summary"') && voice.includes('"project.change_order_summary"'), "voice intent dispatches canonical project read commands");
  assert(operationalVoice.includes("resolveProjectOpsVoiceIntent(params)"), "global operational voice path delegates project readout questions before generic intent handling");

  console.log(`\nOrion project operational readout results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
