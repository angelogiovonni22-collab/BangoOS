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
  const commands = read("lib/orion/commands/operational-command-patches.ts");
  const voice = read("lib/orion/voice/operational-voice-intent.ts");

  console.log("\nOrion live project health contract");
  assert(commands.includes('id: "project.health_summary"'), "live project health command is registered");
  assert(commands.includes("getOperationsCommandCenter("), "health command reads the production Operations command center");
  assert(commands.includes("project.healthScore") && commands.includes("project.progressPercent") && commands.includes("project.riskLevel"), "spoken summary includes live health, progress, and risk values");
  assert(commands.includes("overdueTaskCount") && commands.includes("blockedTaskCount") && commands.includes("nextMilestone"), "spoken summary includes operational blockers and next milestone");
  assert(commands.includes('confirmationLevel: "NONE"'), "read-only project health does not require destructive-action confirmation");
  assert(voice.includes("isProjectHealthRequest"), "voice layer recognizes project health questions");
  assert(voice.includes('getById("project.health_summary")'), "voice layer dispatches canonical health command");
  assert(voice.includes("routeProjectId") && voice.includes("extractProjectPhrase"), "health lookup uses current project context or a spoken project name");
  assert(voice.includes('statusCategory: "operational_ready"'), "resolved project health intent proceeds to command execution");

  console.log(`\nOrion project health results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
