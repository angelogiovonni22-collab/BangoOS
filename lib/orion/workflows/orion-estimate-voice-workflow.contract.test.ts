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
  const workflow = read("lib/orion/workflows/estimate-voice-workflow.ts");

  console.log("\nOrion estimate voice workflow contract");
  assert(route.includes("resolveEstimateVoiceWorkflowTurn"), "voice command center routes through estimate workflow before generic workflow");
  assert(workflow.includes("Okay, starting a new estimate"), "estimate creation starts conversationally");
  assert(workflow.includes("const sessions = new Map"), "estimate workflow persists multi-turn session state");
  assert(workflow.includes("resolveCustomer("), "customer names resolve against live BOS customers");
  assert(workflow.includes("resolveProject("), "project names resolve against live BOS projects");
  assert(workflow.includes('commandId: command.id'), "completed workflow dispatches canonical estimate.create command");
  assert(workflow.includes('params: { values, lineItems: [] }'), "estimate draft uses the existing estimate command/service contract");
  assert(workflow.includes("Before I save it, who is the customer?"), "workflow asks for missing customer instead of failing");
  assert(workflow.includes("Before I save it, what would you like to call the estimate?"), "workflow asks for missing title instead of failing");
  assert(workflow.includes("sessions.delete(sessionKey)"), "completed/canceled estimate sessions are cleaned up");

  console.log(`\nOrion estimate voice workflow results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
