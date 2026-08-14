import { resolveIntentFromEntitySet, type OrionIntentEntityRecord } from "./index";

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

const projectEntity: OrionIntentEntityRecord = {
  entityType: "project",
  entityId: "proj-77",
  label: "Riverfront Build",
  subtitle: "Project in_progress",
  terms: ["riverfront", "build", "project"],
};

const framingInspection: OrionIntentEntityRecord = {
  entityType: "inspection",
  entityId: "insp-1",
  label: "framing inspection",
  subtitle: "Inspection scheduled",
  terms: ["framing", "inspection", "scheduled"],
  projectId: "proj-77",
};

const electricalInspection: OrionIntentEntityRecord = {
  entityType: "inspection",
  entityId: "insp-2",
  label: "electrical inspection",
  subtitle: "Inspection in_progress",
  terms: ["electrical", "inspection", "in progress"],
  projectId: "proj-77",
};

const plumbingInspection: OrionIntentEntityRecord = {
  entityType: "inspection",
  entityId: "insp-3",
  label: "plumbing inspection",
  subtitle: "Inspection in_progress",
  terms: ["plumbing", "inspection", "in progress"],
  projectId: "proj-77",
};

function runIntent(input: string, entities: OrionIntentEntityRecord[]) {
  return resolveIntentFromEntitySet({
    input: {
      input,
      route: {
        pathname: "/projects/proj-77",
        projectId: "proj-77",
        customerId: null,
        estimateId: null,
        invoiceId: null,
        employeeId: null,
        crewId: null,
        dashboardWidgetId: null,
        timelineItemId: null,
      },
    },
    role: "project_manager",
    entities,
    recentEntityKeys: ["project:proj-77", "inspection:insp-1"],
  });
}

function main() {
  test("1. schedule framing inspection", () => {
    const result = runIntent("Schedule the framing inspection.", [projectEntity]);
    check(result.suggestedCommand?.commandId === "inspection.create", "schedule framing inspection resolves to inspection.create");
    check(result.suggestedCommand?.params.inspectionType === "framing", "inspection type framing is inferred");
    check(result.suggestedCommand?.params.projectId === "proj-77", "project route context is applied");
  });

  test("2. mark electrical inspection as passed", () => {
    const result = runIntent("Mark the electrical inspection as passed.", [electricalInspection]);
    check(result.suggestedCommand?.commandId === "inspection.pass", "pass phrase resolves to inspection.pass");
    check(result.suggestedCommand?.params.inspectionId === "insp-2", "inspection id is mapped for pass action");
  });

  test("3. plumbing inspection failed", () => {
    const result = runIntent("The plumbing inspection failed.", [plumbingInspection]);
    check(result.suggestedCommand?.commandId === "inspection.fail", "failed phrase resolves to inspection.fail");
    check(result.suggestedCommand?.params.inspectionId === "insp-3", "inspection id is mapped for fail action");
  });

  test("4. schedule reinspection for friday", () => {
    const result = runIntent("Schedule the reinspection for Friday.", [framingInspection]);
    check(result.suggestedCommand?.commandId === "inspection.schedule_reinspection", "reinspection phrase resolves to inspection.schedule_reinspection");
    check(typeof result.suggestedCommand?.params.reinspectionDate === "string", "reinspection date is generated from weekday");
  });

  console.log(`\nPhase 8C project execution intent routing results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
