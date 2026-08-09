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
  const patch = read("lib/orion/commands/operational-command-patches.ts");
  const service = read("lib/daily-reports/service.ts");

  console.log("\nOrion daily report operational contract");

  assert(index.includes('import "./operational-command-patches";'), "command package loads operational patches before requests execute");
  assert(patch.includes('command.id === "daily_report.create"'), "daily_report.create is reconnected");
  assert(patch.includes('command.id === "daily_report.update"'), "daily_report.update is reconnected");
  assert(patch.includes('status: "implemented"') && patch.includes('expectedEvent: "daily_report.created"'), "create coverage advertises live implementation and event");
  assert(patch.includes('createDailyReportsService({ supabaseClient: deps.supabase })'), "Orion uses the authenticated command Supabase client");
  assert(patch.includes('service.createReport(') && patch.includes('"draft"'), "create command persists a real Daily Reports draft");
  assert(patch.includes('service.updateReport('), "update command persists through the Daily Reports service");
  assert(patch.includes('href: `/daily-reports/${report.id}`'), "successful commands return the canonical daily report route");
  assert(service.includes('eventType: "daily_report.created"') && service.includes('eventType: "daily_report.updated"'), "Daily Reports service publishes canonical workflow events");

  console.log(`\nOrion daily report operational results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
