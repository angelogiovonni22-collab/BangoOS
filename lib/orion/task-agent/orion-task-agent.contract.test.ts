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

  console.log("\nOrion legacy task-agent isolation contract");
  assert(session.includes('UI_OPERATOR_TOOL_NAME = "orion_ui_operator"'), "Realtime exposes the semantic UI operator as the interactive workflow layer");
  assert(!session.includes('TASK_AGENT_TOOL_NAME = "orion_task_agent"'), "legacy task-agent is no longer advertised to the model");
  assert(session.includes("Orion Operator architecture"), "Realtime explicitly uses the operator-first architecture");
  assert(session.includes("Do not force command syntax"), "Realtime policy still requires natural-language interaction");
  assert(session.includes("Never interpret the name of a field as the value for that field"), "field labels cannot be mis-saved as values");
  assert(session.includes("Corrections override earlier information"), "multi-turn corrections remain explicit in the operator policy");
  assert(session.includes("watch you fill the estimate in real time"), "Realtime is instructed to operate the visible BOS form");
  assert(bridge.includes("executeOrionTaskAgent(call.params)"), "legacy task-agent remains internally routable for rollback compatibility");
  assert(bridge.includes("executeOrionUiOperator(call.params)"), "semantic UI operator is routed through the live browser bridge");
  assert(taskAgent.includes("window.sessionStorage"), "legacy task memory remains intact if rollback is ever required");
  assert(taskAgent.includes('href: "/estimates/new"'), "legacy estimate workflow remains recoverable without deleting known-good code");
  assert(taskAgent.includes("field label is not a customer value"), "legacy runtime independently preserves the customer-name safety guard");
  assert(taskAgent.includes("patchEstimateForm"), "legacy runtime retains visual field patching as rollback capability");
  assert(taskAgent.includes("addEstimateLineItem"), "legacy runtime retains structured line-item capability");
  assert(taskAgent.includes("saveEstimateForm"), "legacy runtime retains save capability without being model-advertised");
  assert(info.includes('id="estimate-title"') && customer.includes('id="estimate-customer"'), "core estimate fields retain stable visual-control selectors");
  assert(totals.includes('id="estimate-tax-rate"') && totals.includes('id="estimate-additional-fee"'), "estimate financial controls remain operator-addressable");
  assert(notes.includes('id="estimate-payment-terms"') && notes.includes('id="estimate-scope-inclusions"'), "estimate scope and terms remain operator-addressable");
  assert(items.includes('data-orion-action="add-line-item"'), "line-item builder retains a stable semantic action");
  assert(row.includes('data-orion-line-item-field="description"') && row.includes('data-orion-line-item-field="unitCost"'), "line-item rows retain structured semantic field identities");

  console.log(`\nOrion legacy task-agent isolation results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
