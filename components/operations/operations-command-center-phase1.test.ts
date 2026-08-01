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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  const page = read("app/(app)/operations/page.tsx");
  const service = read("lib/operations/command-center-service.ts");
  const priorityQueue = read("components/operations/priority-action-queue.tsx");
  const projectStatus = read("components/operations/live-project-status.tsx");
  const pendingDecisions = read("components/operations/pending-decisions.tsx");
  const orionBrief = read("components/operations/orion-operations-brief.tsx");

  await test("1. page uses shared loading, error, permission, and partial states", () => {
    assert(page.includes("<PageLoadingState"), "operations page uses shared page loading state");
    assert(page.includes("<SectionLoadingState"), "operations page uses shared section loading state");
    assert(page.includes("<PermissionState"), "operations page uses shared permission state");
    assert(page.includes("<ErrorState"), "operations page uses shared error state");
    assert(page.includes("<PartialDataNotice"), "operations page uses shared partial data notice");
  });

  await test("1b. refresh keeps page content stable", () => {
    assert(page.includes("isRefreshing"), "operations page tracks refresh state separately from initial load");
    assert(page.includes("onRefresh={refresh}"), "operations page keeps explicit refresh control");
  });

  await test("2. responsive section ordering prioritizes queue then schedule then projects", () => {
    const queueIndex = page.indexOf("<PriorityActionQueue");
    const scheduleIndex = page.indexOf("<ScheduleWidget");
    const projectIndex = page.indexOf("<LiveProjectStatus");

    assert(queueIndex >= 0, "priority action queue is present on page");
    assert(scheduleIndex > queueIndex, "today schedule follows priority queue in source order");
    assert(projectIndex > scheduleIndex, "project status follows schedule in source order");
    assert(page.includes("overflow-x-hidden"), "page prevents horizontal overflow on smaller layouts");
  });

  await test("3. command center remains read-only and navigation-first", () => {
    assert(!page.includes("Dialog"), "operations command center adds no editing dialog to the page");
    assert(!page.includes("textarea"), "operations command center adds no inline text editing");
    assert(!page.includes("draggable"), "operations command center adds no drag-and-drop affordances");
    assert(!page.includes("acceptInsight") && !page.includes("dismissInsight"), "operations command center adds no autonomous or approval actions");
    assert(priorityQueue.includes("href={item.href}"), "priority queue rows navigate to existing detail routes");
    assert(projectStatus.includes("href={item.href}"), "project status rows navigate to existing detail routes");
    assert(pendingDecisions.includes("href={item.href}"), "pending decisions rows navigate to existing detail routes");
  });

  await test("4. company scoping and Orion integration use existing architecture", () => {
    assert(service.includes('.eq("company_id", companyId)'), "service scopes queries by company_id");
    assert(
      /\.from\("profiles"\)[\s\S]*?\.select\("id, first_name, last_name"\)[\s\S]*?\.eq\("company_id", companyId\)/.test(service),
      "profile lookup is scoped to company_id",
    );
    assert(service.includes("buildExecutiveBrief"), "service reuses the existing Orion executive brief builder");
    assert(!service.includes("fetch("), "service does not introduce autonomous API calls");
    assert(orionBrief.includes("brief.priorityItems"), "Orion brief component uses supported deterministic executive brief outputs");
  });

  console.log(`\nOperations Command Center page contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();