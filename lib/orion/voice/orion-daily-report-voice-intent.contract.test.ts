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
  const route = read("app/api/orion/command-center/route.ts");
  const operational = read("lib/orion/voice/operational-voice-intent.ts");
  const commandPatch = read("lib/orion/commands/operational-command-patches.ts");

  console.log("\nOrion daily report voice intent contract");

  assert(route.includes("resolveOperationalVoiceIntent"), "voice command API invokes operational voice intent before generic workflow resolution");
  assert(route.indexOf("resolveOperationalVoiceIntent") < route.indexOf("resolveVoiceWorkflowTurn({"), "operational daily report intent has priority over generic voice workflow handling");
  assert(operational.includes("isDailyReportCreateRequest"), "daily report create phrases have a dedicated detector");
  assert(operational.includes("today") && operational.includes("tomorrow") && operational.includes("20\\d{2}-\\d{2}-\\d{2}"), "daily report voice intent resolves relative and explicit dates");
  assert(operational.includes("routeProjectId") && operational.includes("extractProjectPhrase"), "project context can come from the current workspace or spoken project name");
  assert(operational.includes('getById("daily_report.create")'), "voice intent resolves through the canonical Orion command registry");
  assert(operational.includes("projectId: project.id") && operational.includes("reportDate"), "suggested command supplies the live daily report command parameters");
  assert(commandPatch.includes('command.id === "daily_report.create"') && commandPatch.includes('status: "implemented"'), "voice suggestion points at the live operational command rather than stale unsupported coverage");

  console.log(`\nOrion daily report voice intent results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
