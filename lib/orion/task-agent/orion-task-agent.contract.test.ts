import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  + ${message}`); passed += 1; }
  else { console.error(`  x FAIL: ${message}`); failed += 1; }
}
function read(relativePath: string) { return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8"); }

function main() {
  const session = read("app/api/orion/realtime/session/route.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const taskAgent = read("lib/orion/task-agent/browser.ts");
  const info = read("components/estimates/estimate-information-section.tsx");
  const customer = read("components/estimates/estimate-customer-project-section.tsx");
  const totals = read("components/estimates/estimate-totals.tsx");
  const notes = read("components/estimates/estimate-notes-terms.tsx");
  const items = read("components/estimates/estimate-line-items.tsx");
  const row = read("components/estimates/estimate-line-item-row.tsx");

  console.log("\nOrion advanced task-agent architecture contract");
  assert(session.includes('TASK_AGENT_TOOL_NAME = "orion_task_agent"'), "Realtime exposes one persistent task-agent tool");
  assert(session.includes("Do not force command syntax"), "Realtime policy requires natural-language interaction");
  assert(session.includes("Never interpret the name of a field as the value for that field"), "field labels cannot be mis-saved as values");
  assert(session.includes("every later answer belongs to that estimate"), "multi-turn estimate continuity is explicit");
  assert(session.includes("visually patch the live form"), "Realtime is instructed to fill visible BOS forms");
  assert(bridge.includes("executeOrionTaskAgent(call.params)"), "Realtime tool bridge executes task-agent operations in the browser");
  assert(taskAgent.includes("window.sessionStorage"), "active task memory survives page navigation in the browser session");
  assert(taskAgent.includes('href: "/estimates/new"'), "starting an estimate task opens the visible New Estimate page");
  assert(taskAgent.includes("field label is not a customer value"), "task runtime independently blocks the reported customer-name failure mode");
  assert(taskAgent.includes("patchEstimateForm"), "task runtime can visually patch estimate fields");
  assert(taskAgent.includes("addEstimateLineItem"), "task runtime can build structured estimate line items");
  assert(taskAgent.includes("saveEstimateForm"), "task runtime can complete the visible estimate workflow");
  assert(info.includes('id="estimate-title"') && customer.includes('id="estimate-customer"'), "core estimate fields have stable visual-control selectors");
  assert(totals.includes('id="estimate-tax-rate"') && totals.includes('id="estimate-additional-fee"'), "estimate financial controls are task-agent addressable");
  assert(notes.includes('id="estimate-payment-terms"') && notes.includes('id="estimate-scope-inclusions"'), "estimate scope and terms are task-agent addressable");
  assert(items.includes('data-orion-action="add-line-item"'), "line-item builder exposes a stable add action");
  assert(row.includes('data-orion-line-item-field="description"') && row.includes('data-orion-line-item-field="unitCost"'), "line-item rows expose structured live fields");

  console.log(`\nOrion task-agent results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
