import fs from "node:fs";
import path from "node:path";
import { getBodyScrollLockCount, isTopmostOverlay, registerOverlay, resetOverlayRuntimeForTests, unregisterOverlay } from "./overlay-runtime";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main(): Promise<void> {
  const dialogSource = read("components/ui/dialog.tsx");
  const focusTrapSource = read("components/motion/focus-trap.ts");
  const operationsPage = read("app/(app)/operations/page.tsx");
  const schedulingDashboard = read("components/scheduling/scheduling-dashboard.tsx");
  const estimateForm = read("components/estimates/estimate-form.tsx");
  const invoiceForm = read("components/invoices/invoice-form.tsx");
  const changeOrderDetail = read("components/change-orders/change-order-detail.tsx");
  const activePhasesPanel = read("components/projects/workspace/project-work-active-phases-panel.tsx");

  await test("1. topmost overlay runtime still protects nested Escape handling", () => {
    resetOverlayRuntimeForTests();
    registerOverlay("viewer");
    registerOverlay("editor");

    assert(isTopmostOverlay("editor"), "last opened overlay is topmost");
    assert(!isTopmostOverlay("viewer"), "underlying overlay is not topmost while nested dialog is open");

    unregisterOverlay("editor");
    assert(isTopmostOverlay("viewer"), "underlying overlay becomes topmost after nested close");
    assert(getBodyScrollLockCount() === 0, "overlay stack checks do not leak body-scroll locks");
  });

  await test("2. dialog infrastructure still owns focus trap and focus restoration", () => {
    assert(dialogSource.includes("useTopmostOverlay"), "shared dialog uses topmost overlay guard");
    assert(dialogSource.includes("useBodyScrollLock"), "shared dialog uses shared body-scroll lock");
    assert(dialogSource.includes("useFocusTrap"), "shared dialog uses shared focus trap");
    assert(focusTrapSource.includes("previousActiveRef"), "focus trap captures the previously focused element");
    assert(focusTrapSource.includes("previousActiveRef.current.focus()"), "focus trap restores focus on cleanup");
  });

  await test("3. scheduling modal and operations page remain on shared UI infrastructure", () => {
    assert(operationsPage.includes("<PageLoadingState"), "operations page uses shared page loading state");
    assert(operationsPage.includes("<PermissionState"), "operations page uses shared permission state");
    assert(!operationsPage.includes("fixed inset-0 z-40"), "operations page no longer owns a hard-coded overlay shell");

    assert(schedulingDashboard.includes("<Dialog"), "scheduling create modal uses shared Dialog");
    assert(schedulingDashboard.includes("<AssignmentForm"), "scheduling modal still renders assignment form content");
    assert(!schedulingDashboard.includes("fixed inset-0 z-50"), "scheduling dashboard no longer owns a hard-coded overlay shell");
  });

  await test("4. representative confirm flows moved to ConfirmDialog", () => {
    assert(changeOrderDetail.includes("<ConfirmDialog"), "change-order approval uses ConfirmDialog");
    assert(!changeOrderDetail.includes('window.confirm("Approve this change order?")'), "change-order approval no longer uses window.confirm");

    assert(estimateForm.includes("<ConfirmDialog"), "estimate cancel flow uses ConfirmDialog");
    assert(!estimateForm.includes("window.confirm"), "estimate cancel flow no longer uses window.confirm");

    assert(invoiceForm.includes("<ConfirmDialog"), "invoice cancel flow uses ConfirmDialog");
    assert(!invoiceForm.includes("window.confirm"), "invoice cancel flow no longer uses window.confirm");

    assert(activePhasesPanel.includes("<ConfirmDialog"), "active-phase delete flow uses ConfirmDialog");
    assert(!activePhasesPanel.includes("window.confirm"), "active-phase delete flow no longer uses window.confirm");
  });

  console.log(`\nCore UI foundation Phase 2 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();