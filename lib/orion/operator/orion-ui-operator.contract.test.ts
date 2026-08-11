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
  const operator = read("lib/orion/operator/browser.ts");
  const bridge = read("lib/orion/realtime/tool-bridge.ts");
  const session = read("app/api/orion/realtime/session/route.ts");
  const unified = read("components/orion/voice/useOrionUnifiedVoice.ts");
  const estimateInfo = read("components/estimates/estimate-information-section.tsx");
  const estimateCustomer = read("components/estimates/estimate-customer-project-section.tsx");
  const estimateLines = read("components/estimates/estimate-line-items.tsx");
  const estimateForm = read("components/estimates/estimate-form.tsx");
  const routes = read("lib/orion/operator/routes.ts");
  const handlers = read("lib/orion/commands/handlers.ts");
  const estimateRow = read("components/estimates/estimate-line-item-row.tsx");

  console.log("\nOrion semantic UI operator contract");

  assert(operator.includes('ORION_UI_OPERATOR_TOOL = "orion_ui_operator"'), "operator has one canonical Realtime tool name");
  assert(operator.includes('"observe" | "navigate" | "set" | "click"'), "operator exposes the minimal generic action surface");
  assert(operator.includes("interactiveElements().map(describeElement)"), "operator observes the real visible BOS controls instead of an imagined schema");
  assert(operator.includes("data-orion-control") && operator.includes("data-orion-action"), "operator supports stable semantic control/action identifiers");
  assert(operator.includes("data-orion-line-item-field"), "operator understands dynamic estimate line-item controls semantically");
  assert(operator.includes("DESTRUCTIVE_TEXT") && operator.includes("requiresCanonicalConfirmation"), "direct UI operator blocks destructive actions");
  assert(routes.includes('href.startsWith("/")') && routes.includes('href.startsWith("//")'), "operator navigation is restricted to internal BOS routes");
  assert(routes.includes("isKnownOrionOperatorHref") && operator.includes("validMainRoutes"), "operator rejects invented internal paths before they can render a 404");
  assert(handlers.includes("resolveCanonicalOrionNavigationHref") && handlers.includes("That BOS workspace route is not available."), "canonical navigation tools cannot bypass the verified route catalog");
  assert(bridge.includes("executeOrionUiOperator") && bridge.includes("ORION_UI_OPERATOR_TOOL"), "Realtime tool bridge executes UI operator calls in the browser");
  assert(unified.includes('result.href.startsWith("/")') && unified.includes("router.push(result.href)"), "successful operator navigation is applied to the live BOS router");
  assert(session.includes('UI_OPERATOR_TOOL_NAME = "orion_ui_operator"'), "Realtime advertises the semantic UI operator");
  assert(!session.includes('name: TASK_AGENT_TOOL_NAME'), "legacy task-agent is no longer advertised as Orion's primary model tool");
  assert(session.includes("Orion Operator architecture"), "Realtime policy explicitly establishes operator-first architecture");
  assert(session.includes("Do not use pixel coordinates") && session.includes("Only act on controls returned by the operator observation"), "operator policy forbids brittle pixel/selector guessing");
  assert(session.includes("MANDATORY visible-create rule") && session.includes("action=navigate and href=/estimates/new"), "new-estimate intent must navigate before Orion asks follow-up questions");
  assert(session.includes("Do not call a canonical estimate-create/database mutation tool") && session.includes("visible create/edit request begins in the visible form"), "canonical create tools cannot preempt the visible estimate workflow");
  assert(session.includes("After navigation to /estimates/new succeeds") && session.includes("action=observe"), "Orion observes the mounted estimate form immediately after navigation");
  assert(session.includes("navigate to /estimates/new") && session.includes("watch you fill the estimate in real time"), "new estimate is the gold-standard visible operator workflow");
  assert(session.includes("Corrections override earlier information"), "normal conversational corrections update the visible task");
  assert(estimateInfo.includes('id="estimate-title"') && estimateInfo.includes('id="estimate-description"'), "estimate information fields expose stable semantic ids");
  assert(estimateCustomer.includes('id="estimate-customer"') && estimateCustomer.includes('id="estimate-project"'), "estimate customer/project selectors expose stable ids");
  assert(estimateLines.includes('data-orion-action="add-line-item"'), "estimate line-item builder exposes a semantic add action");
  assert(estimateForm.includes('data-orion-action="save-estimate-and-continue"') && estimateForm.includes('data-orion-verify="navigation-or-status"'), "estimate submission exposes a stable verified Operator action");
  assert(operator.includes("waitForVerifiedUiOutcome") && operator.includes("BOS did not confirm that action"), "Operator waits for visible save success or failure before claiming completion");
  assert(estimateRow.includes("data-orion-line-item-row") && estimateRow.includes("data-orion-line-item-field"), "estimate dynamic rows expose semantic row and field identities");

  console.log(`\nOrion UI operator results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
