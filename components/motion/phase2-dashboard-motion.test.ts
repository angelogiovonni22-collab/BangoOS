import fs from "node:fs";
import path from "node:path";
import { resolveReducedMotion } from "./motion-preferences";
import { collectNewDashboardIds, getWidgetSequenceRank, hasNewDashboardItems } from "@/lib/dashboard/motion-helpers";

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
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

async function main(): Promise<void> {
  const dashboardPage = read("app/(app)/dashboard/page.tsx");
  const metricCard = read("components/dashboard/MetricCard.tsx");
  const projectHealth = read("components/dashboard/ProjectHealth.tsx");
  const activityFeed = read("components/dashboard/ActivityFeed.tsx");
  const scheduleWidget = read("components/dashboard/ScheduleWidget.tsx");
  const commandCenter = read("components/dashboard/AICommandCenter.tsx");
  const customizer = read("components/dashboard/DashboardCustomizer.tsx");

  await test("1. reduced-motion behavior", () => {
    assert(resolveReducedMotion("reduced", false), "reduced preference forces reduced motion");
    assert(!resolveReducedMotion("full", true), "full preference forces full motion");
    assert(resolveReducedMotion("system", true), "system follows reduced OS preference");
  });

  await test("2. Dashboard content visible immediately", () => {
    assert(dashboardPage.includes("<DashboardHeader"), "header is rendered directly in page component");
    assert(!dashboardPage.includes("if (isLoading) {\n    return null;"), "dashboard does not hide content behind loading null return");
  });

  await test("3. KPI accuracy path preserved", () => {
    assert(metricCard.includes("metric.valueKind"), "value formatting is still metric-kind based");
    assert(metricCard.includes("metric.value"), "CountUp uses the source metric value");
  });

  await test("4. no entrance replay on ordinary updates", () => {
    assert(activityFeed.includes("collectNewDashboardIds"), "activity feed computes new-item IDs");
    assert(scheduleWidget.includes("collectNewDashboardIds"), "schedule widget computes new-item IDs");
    assert(activityFeed.includes("bf-no-motion"), "activity feed suppresses non-new item animation");
    assert(scheduleWidget.includes("bf-no-motion"), "schedule widget suppresses non-new item animation");
  });

  await test("5. critical warning one-time emphasis", () => {
    assert(commandCenter.includes("StatusPulse"), "command center uses status pulse");
    assert(commandCenter.includes("recommendation.priority === \"critical\""), "critical recommendation path is emphasized");
    assert(projectHealth.includes("riskIndicator === \"high\""), "high risk projects are emphasized once");
  });

  await test("6. project navigation remains functional", () => {
    assert(metricCard.includes("<Link"), "KPI cards still use navigation links");
    assert(projectHealth.includes("href={project.href}"), "project health rows retain navigation href");
    assert(scheduleWidget.includes("href={event.href}"), "schedule events retain navigation href");
  });

  await test("7. activity/schedule replay suppression helpers", () => {
    const newIds = collectNewDashboardIds(new Set(["a", "b"]), ["a", "b", "c"]);
    assert(Boolean(newIds.c), "new dashboard item is detected");
    assert(!Boolean(newIds.a), "existing dashboard item is not replayed");
    assert(hasNewDashboardItems(newIds), "helper reports new items exist");
    assert(!hasNewDashboardItems({}), "helper reports no new items for empty set");
  });

  await test("8. no horizontal overflow helper", () => {
    assert(dashboardPage.includes("overflow-x-hidden"), "dashboard root enforces horizontal overflow guard");
  });

  await test("9. keyboard focus remains usable", () => {
    assert(customizer.includes("useFocusTrap"), "customizer panel uses shared focus trap");
    assert(customizer.includes("onEscape"), "customizer panel supports keyboard Escape close");
  });

  await test("10. no API calls introduced", () => {
    const files = [dashboardPage, metricCard, projectHealth, activityFeed, scheduleWidget, commandCenter, customizer];
    assert(files.every((source) => !source.includes("fetch(")), "dashboard motion changes do not introduce client fetch calls");
    assert(files.every((source) => !source.includes("/api/")), "dashboard motion changes do not reference API endpoints");
  });

  await test("11. no business logic changes via writes", () => {
    const files = [dashboardPage, metricCard, projectHealth, activityFeed, scheduleWidget, commandCenter, customizer];
    assert(files.every((source) => !source.includes(".insert(")), "no insert operations in dashboard motion layer");
    assert(files.every((source) => !source.includes(".update(")), "no update operations in dashboard motion layer");
    assert(files.every((source) => !source.includes(".delete(")), "no delete operations in dashboard motion layer");
  });

  await test("12. no automatic AI calls", () => {
    assert(!commandCenter.includes("narrate"), "command center has no narration call path");
    assert(!dashboardPage.includes("requestType"), "dashboard page has no automatic AI request payloads");
  });

  await test("13. open sequence priority order remains deterministic", () => {
    assert(getWidgetSequenceRank("business-score") < getWidgetSequenceRank("kpi"), "summary area precedes KPI sequence");
    assert(getWidgetSequenceRank("command-center") < getWidgetSequenceRank("activity"), "priority area precedes supporting activity");
    assert(getWidgetSequenceRank("weather") > getWidgetSequenceRank("schedule"), "supporting weather panel appears later");
  });

  console.log(`\nPhase 2 dashboard motion results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
