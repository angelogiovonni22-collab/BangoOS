import { ORION_INITIAL_COMMANDS } from "./index";
import { buildUniversalBosToolCatalog } from "../intelligence/universal-command-catalog";

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

function sorted(values: string[]) {
  return [...values].sort((a, b) => a.localeCompare(b));
}

function sameValues(actual: string[], expected: string[]) {
  return JSON.stringify(sorted(actual)) === JSON.stringify(sorted(expected));
}

function main() {
  console.log("\nOrion production command coverage contract");

  const unsupported = ORION_INITIAL_COMMANDS
    .filter((command) => command.coverage.status === "unsupported")
    .map((command) => command.id);

  const intentionallyBlocked = [
    "invoice.issue_refund",
    "document.upload",
    "document.delete",
    "document.sign",
  ];

  assert(
    sameValues(unsupported, intentionallyBlocked),
    `only production actions with known missing safety/storage dependencies remain unsupported (actual: ${sorted(unsupported).join(", ") || "none"})`,
  );

  const dailyReportCreate = ORION_INITIAL_COMMANDS.find((command) => command.id === "daily_report.create");
  const dailyReportUpdate = ORION_INITIAL_COMMANDS.find((command) => command.id === "daily_report.update");
  assert(dailyReportCreate?.coverage.status === "implemented", "Daily Report creation is live in the runtime command registry");
  assert(dailyReportUpdate?.coverage.status === "implemented", "Daily Report updates are live in the runtime command registry");

  const exposedCommandIds = new Set(buildUniversalBosToolCatalog().map((tool) => tool.metadata.commandId));
  for (const commandId of intentionallyBlocked) {
    assert(!exposedCommandIds.has(commandId), `${commandId} is not exposed to AI/Realtime as an executable tool`);
  }

  const implementedCommands = ORION_INITIAL_COMMANDS.filter((command) => command.coverage.status !== "unsupported");
  const exposedImplementedCommands = implementedCommands.filter((command) => exposedCommandIds.has(command.id));
  assert(
    exposedImplementedCommands.length === implementedCommands.length,
    `all ${implementedCommands.length} production-capable canonical commands are exposed through Universal BOS Control`,
  );

  console.log(`\nOrion production command coverage results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
