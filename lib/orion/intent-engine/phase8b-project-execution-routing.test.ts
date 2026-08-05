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

const taskEntity: OrionIntentEntityRecord = {
  entityType: "task",
  entityId: "task-101",
  label: "Task 101 Rough-In",
  subtitle: "Task in_progress",
  terms: ["task", "rough in", "101"],
};

const crewEntity: OrionIntentEntityRecord = {
  entityType: "crew",
  entityId: "crew-15",
  label: "CR-15 Concrete Crew",
  subtitle: "Crew active",
  terms: ["crew", "concrete", "cr-15"],
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
    recentEntityKeys: ["task:task-101", "crew:crew-15"],
  });
}

function main() {
  test("1. start task routing", () => {
    const result = runIntent("start task 101", [taskEntity]);
    check(result.suggestedCommand?.commandId === "task.start", "start task resolves to task.start command");
  });

  test("2. pause task routing", () => {
    const result = runIntent("pause task 101", [taskEntity]);
    check(result.suggestedCommand?.commandId === "task.pause", "pause task resolves to task.pause command");
  });

  test("3. complete task routing", () => {
    const result = runIntent("complete task 101", [taskEntity]);
    check(result.suggestedCommand?.commandId === "task.complete", "complete task resolves to task.complete command");
  });

  test("4. assign crew routing", () => {
    const result = runIntent("assign concrete crew to this project", [crewEntity]);
    check(result.suggestedCommand?.commandId === "project.assign_crew", "assign crew resolves to project.assign_crew command");
  });

  console.log(`\nPhase 8B project execution intent routing results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
