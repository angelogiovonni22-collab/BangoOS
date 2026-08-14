import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function main() {
  const customerSource = readFileSync(join(process.cwd(), "app", "(app)", "customers", "[id]", "page.tsx"), "utf8");
  const phaseSource = readFileSync(join(process.cwd(), "app", "(app)", "projects", "[id]", "components", "phase-details-panel.tsx"), "utf8");
  const plansPreviewSource = readFileSync(join(process.cwd(), "components", "plans", "plans-preview.tsx"), "utf8");
  const plansWorkspaceSource = readFileSync(join(process.cwd(), "components", "plans", "plans-workspace.tsx"), "utf8");

  const bannedPhrases = [
    "coming soon",
    "will appear here",
    "placeholder",
    "future release",
    "future sprint",
    "sample data",
  ];

  test("1. customer workspace renders production data paths", () => {
    check(customerSource.includes("listCustomerTimeline"), "customer workspace loads Orion customer timeline");
    check(customerSource.includes("formatProjectCurrency(lifetimeRevenue"), "customer workspace calculates lifetime revenue from persisted invoices");
    check(customerSource.includes(".from(\"project_photos\")"), "customer workspace loads real customer-related photo records");
    check(customerSource.includes(".eq(\"company_id\", workspace.context.companyId)"), "customer workspace queries remain company scoped");
    check(customerSource.includes("No communications recorded yet"), "customer workspace has honest communications empty state");
    check(!customerSource.includes("buildActivityFeed("), "customer workspace no longer uses hard-coded activity feed");
    check(!customerSource.includes("value=\"Coming Soon\""), "customer workspace no longer displays Coming Soon revenue");
  });

  test("2. project phase details render real phase/task states", () => {
    check(phaseSource.includes("No phase description has been added."), "phase details use honest fallback for missing description");
    check(phaseSource.includes("tasks.map((task) =>"), "phase details render real task list entries");
    check(phaseSource.includes("Status:"), "phase details render task status");
    check(phaseSource.includes("Priority:"), "phase details render task priority");
    check(phaseSource.includes("Assignee:"), "phase details render task assignee");
    check(phaseSource.includes("Due:"), "phase details render task due date");
    check(phaseSource.includes("No tasks in this phase yet."), "phase details provide honest empty task state");
    check(!phaseSource.toLowerCase().includes("coming soon"), "phase details no longer reference coming soon");
  });

  test("3. plans preview uses honest unavailable and supported-type messaging", () => {
    check(plansPreviewSource.includes("Plan preview is unavailable because no project plan file is connected."), "plans preview provides explicit unavailable state");
    check(plansPreviewSource.includes("function resolvePreviewType"), "plans preview classifies supported and unsupported file types");
    check(plansPreviewSource.includes("Unsupported file type"), "plans preview has unsupported format message");
    check(!plansPreviewSource.includes("Preview Placeholder"), "plans preview no longer shows placeholder preview card");
    check(!plansPreviewSource.toLowerCase().includes("future sprint"), "plans preview no longer references future sprint behavior");
  });

  test("4. plans workspace has no hard-coded sample production records", () => {
    check(plansWorkspaceSource.includes("const documentsSeed: PlanDocument[] = [];"), "plans workspace no longer seeds hard-coded plan documents");
    check(!plansWorkspaceSource.includes("A101-Floor-Plan-Level-01.pdf"), "plans workspace no longer contains sample drawing names");
  });

  test("5. blocker 2 static placeholder guard on target files", () => {
    const targets = [
      { name: "customers", source: customerSource },
      { name: "phase-details", source: phaseSource },
      { name: "plans-preview", source: plansPreviewSource },
    ];

    for (const target of targets) {
      const lowered = target.source.toLowerCase();
      for (const phrase of bannedPhrases) {
        check(!lowered.includes(phrase), `${target.name} does not contain banned placeholder phrase: ${phrase}`);
      }
    }
  });

  console.log(`\nBlocker 2 placeholder contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
