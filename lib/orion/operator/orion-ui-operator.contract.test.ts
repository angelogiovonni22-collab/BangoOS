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
  const projectEditor = read("app/(app)/projects/[id]/edit/page.tsx");
  const commandRegistry = read("lib/orion/commands/registry.ts");

  console.log("\nOrion semantic UI operator contract");

  assert(operator.includes('ORION_UI_OPERATOR_TOOL = "orion_ui_operator"'), "operator has one canonical Realtime tool name");
  assert(operator.includes('"observe" | "navigate" | "set" | "batch_set" | "click" | "scroll"'), "operator exposes generic semantic operations including fast batch setting");
  assert(operator.includes("interactiveElements().map(describeElement)"), "operator observes the real visible BOS controls instead of an imagined schema");
  assert(operator.includes("data-orion-control") && operator.includes("data-orion-action"), "operator supports stable semantic control/action identifiers");
  assert(operator.includes("data-orion-line-item-field"), "operator understands dynamic estimate line-item controls semantically");
  assert(operator.includes("DESTRUCTIVE_TEXT") && operator.includes("requiresCanonicalConfirmation"), "direct UI operator blocks destructive actions");
  assert(operator.includes("MAX_BATCH_CHANGES = 40") && operator.includes("batchSetControls"), "operator has a bounded fast batch execution path");
  assert(operator.includes("prepareBatchChange") && operator.includes("seenRefs") && operator.includes("for (const change of prepared)"), "batch execution preflights every target before applying any update");
  assert(operator.includes('dataset.orionConfirmation === "required"') && operator.includes("A batch target requires Orion's confirmed canonical BOS action"), "batch execution cannot bypass confirmation-sensitive controls");
  assert(operator.includes("focus({ preventScroll: true })") && operator.includes("nativeSetValue(change.element, change.value, false)"), "batch execution avoids repeated focus/scroll churn while still leaving a visible final focus state");
  assert(operator.includes("updatedCount") && operator.includes("elapsedMs") && operator.includes("batch: true"), "batch results expose execution telemetry for latency tuning");
  assert(routes.includes('href.startsWith("/")') && routes.includes('href.startsWith("//")'), "operator navigation is restricted to internal BOS routes");
  assert(routes.includes("resolveKnownOrionOperatorHref") && routes.includes("route.toLowerCase() === normalizedPathname.toLowerCase()"), "known menu routes are canonicalized before browser navigation");
  assert(routes.includes("isKnownOrionOperatorHref") && operator.includes("validMainRoutes"), "operator rejects invented internal paths before they can render a 404");
  assert(handlers.includes("resolveCanonicalOrionNavigationHref") && handlers.includes("That BOS workspace route is not available."), "canonical navigation tools cannot bypass the verified route catalog");
  assert(bridge.includes("executeOrionUiOperator") && bridge.includes("ORION_UI_OPERATOR_TOOL"), "Realtime tool bridge executes UI operator calls in the browser");
  assert(unified.includes("resolveKnownOrionOperatorHref(result.href)") && unified.includes("router.push(safeHref)"), "successful operator navigation is canonicalized before it reaches the live BOS router");
  assert(session.includes('UI_OPERATOR_TOOL_NAME = "orion_ui_operator"'), "Realtime advertises the semantic UI operator");
  assert(!session.includes('name: TASK_AGENT_TOOL_NAME'), "legacy task-agent is no longer advertised as Orion's primary model tool");
  assert(session.includes("Orion Operator architecture"), "Realtime policy explicitly establishes operator-first architecture");
  assert(session.includes('enum: ["observe", "navigate", "set", "batch_set", "click", "scroll"]') && session.includes("maxItems: 40"), "Realtime tool schema advertises bounded batch form execution");
  assert(session.includes("Fast form policy") && session.includes("Do not issue separate set calls") && session.includes("action=batch_set"), "Realtime policy tells Orion to collapse multi-field work into one tool round trip");
  assert(session.includes("Execution-speed policy") && session.includes("act first and narrate briefly after the tool result"), "Realtime prioritizes execution over pre-action narration for reversible work");
  assert(session.includes("Do not scroll merely to fill an offscreen field") && session.includes("batch it instead"), "batch mode avoids unnecessary scroll and re-observe latency for already observed mounted controls");
  assert(session.includes("Do not use pixel coordinates") && session.includes("Only act on controls returned by the operator observation"), "operator policy forbids brittle pixel/selector guessing");
  assert(session.includes("MANDATORY visible-create rule") && session.includes("action=navigate and href=/estimates/new"), "new-estimate intent must navigate before Orion asks follow-up questions");
  assert(session.includes("Do not call a canonical estimate-create/database mutation tool") && session.includes("visible create/edit request begins in the visible form"), "canonical create tools cannot preempt the visible estimate workflow");
  assert(session.includes("After navigation to /estimates/new succeeds") && session.includes("action=observe"), "Orion observes the mounted estimate form immediately after navigation");
  assert(session.includes("one batch_set") && session.includes("watch you fill the estimate in real time"), "new-estimate workflow carries supplied values forward and fills them together");
  assert(session.includes("Corrections override earlier information"), "normal conversational corrections update the visible task");
  assert(estimateInfo.includes('id="estimate-title"') && estimateInfo.includes('id="estimate-description"'), "estimate information fields expose stable semantic ids");
  assert(estimateCustomer.includes('id="estimate-customer"') && estimateCustomer.includes('id="estimate-project"'), "estimate customer/project selectors expose stable ids");
  assert(estimateLines.includes('data-orion-action="add-line-item"'), "estimate line-item builder exposes a semantic add action");
  assert(estimateForm.includes('data-orion-action="save-estimate-and-continue"') && estimateForm.includes('data-orion-verify="navigation-or-status"'), "estimate submission exposes a stable verified Operator action");
  assert(operator.includes("waitForVerifiedUiOutcome") && operator.includes("BOS did not confirm that action"), "Operator waits for visible save success or failure before claiming completion");
  assert(estimateRow.includes("data-orion-line-item-row") && estimateRow.includes("data-orion-line-item-field"), "estimate dynamic rows expose semantic row and field identities");
  assert(operator.includes("scrollableAncestor") && operator.includes("scrollIntoView") && operator.includes("document.scrollingElement"), "Operator scrolls semantic controls, nested regions, and the active page without coordinate guessing");
  assert(operator.includes("observationRequiredAfterScroll") && operator.includes("reobserveRequired: true"), "every scroll invalidates prior screen state until Orion observes again");
  assert(operator.includes('behavior: "auto"') && !operator.includes('behavior: "smooth"'), "scroll operations are atomic so barge-in can stop the next Operator step");
  assert(operator.includes("!inViewport(element)") && operator.includes("scrollRequired: true"), "single-control interactions still require visible viewport placement");
  assert(session.includes("After every scroll, you MUST observe again") && session.includes("/projects/{id}/edit"), "Realtime policy requires re-observation and visible project editing");
  assert(projectEditor.includes('data-orion-control="project.addressLine1"') && projectEditor.includes('data-orion-action="project.save"'), "project editor exposes visible semantic address and verified save controls");
  assert(projectEditor.includes('data-orion-confirmation="required"') && commandRegistry.includes('id: "project.update_status"') && commandRegistry.includes('confirmationLevel: "REQUIRED"'), "project status changes remain behind canonical confirmation");

  console.log(`\nOrion UI operator results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
