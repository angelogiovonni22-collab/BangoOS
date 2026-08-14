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
  const indexSource = readFileSync(join(process.cwd(), "lib", "daily-reports", "index.ts"), "utf8");
  const source = readFileSync(join(process.cwd(), "lib", "daily-reports", "service.ts"), "utf8");
  const pageSource = readFileSync(join(process.cwd(), "app", "(app)", "daily-reports", "page.tsx"), "utf8");
  const detailsPageSource = readFileSync(join(process.cwd(), "app", "(app)", "daily-reports", "[id]", "page.tsx"), "utf8");

  test("0. production barrel omits mock-data", () => {
    check(!indexSource.includes("./mock-data"), "daily reports barrel does not export mock-data");
  });

  test("1. Orion event-backed storage", () => {
    check(source.includes(".from(\"workflow_events\")"), "daily reports query workflow_events for persistence");
    check(source.includes("reference_entity\", \"daily_report\""), "queries are scoped to daily_report aggregate");
  });

  test("1b. live draft creation uses production services", () => {
    check(!source.includes("./mock-data"), "daily reports service has no mock-data import");
    check(source.includes("createSchedulingService"), "draft seeding uses the live scheduling service");
    check(source.includes("return buildLiveDraft(date);"), "draft creation returns the live draft builder");
  });

  test("2. Event publishing contracts", () => {
    check(source.includes("event_type: params.eventType"), "service publishes deterministic event types");
    check(source.includes("aggregate_type: \"daily_report\""), "daily report events use daily_report aggregate");
    check(source.includes("eventType: \"daily_report.created\""), "create flow publishes daily_report.created");
    check(source.includes("eventType: \"daily_report.updated\""), "update/regenerate flow publishes daily_report.updated");
  });

  test("3. Timeline and project history linkage", () => {
    check(source.includes("project_id: params.report.header.projectId"), "published payload includes project_id");
    check(source.includes("deep_link: `/daily-reports/${params.report.id}`"), "published payload contains deep link for timeline navigation");
  });

  test("4. Dashboard metrics data", () => {
    check(source.includes("reportsCreatedToday"), "dashboard computes reportsCreatedToday");
    check(source.includes("reportsPendingReview"), "dashboard computes reportsPendingReview");
    check(source.includes("safetyIncidents"), "dashboard computes safety incidents");
    check(source.includes("laborHours"), "dashboard computes labor hours");
  });

  test("5. production consumers stay live-data only", () => {
    check(!pageSource.includes("mock-data"), "daily reports list page does not import mock data");
    check(!detailsPageSource.includes("mock-data"), "daily report details page does not import mock data");
  });

  console.log(`\nPhase 8B daily report service contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
