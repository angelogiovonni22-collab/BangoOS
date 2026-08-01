import fs from "node:fs";
import path from "node:path";
import { resolveReducedMotion } from "./motion-preferences";
import {
  buildActivityPulseKey,
  buildProjectPulseKey,
  buildRecommendationPulseKey,
  markDashboardEntranceAnimated,
  shouldAnimateDashboardEntranceOnce,
  shouldShowDashboardPreviewDataBadge,
} from "../../lib/dashboard/motion-helpers";
import { collectNewEntityIds, hasAnimatedEntries } from "../../lib/motion/replay-helpers";

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
  const kpiGrid = read("components/dashboard/KPIGrid.tsx");
  const metricCard = read("components/dashboard/MetricCard.tsx");
  const activityFeed = read("components/dashboard/ActivityFeed.tsx");
  const scheduleWidget = read("components/dashboard/ScheduleWidget.tsx");
  const commandCenter = read("components/dashboard/AICommandCenter.tsx");
  const customizer = read("components/dashboard/DashboardCustomizer.tsx");
  const dashboardPage = read("app/(app)/dashboard/page.tsx");

  await test("1. KPI entrance does not replay on unrelated rerender", () => {
    assert(kpiGrid.includes("shouldAnimateDashboardEntranceOnce"), "KPI grid uses one-time entrance gate");
    assert(kpiGrid.includes("markDashboardEntranceAnimated"), "KPI grid marks entrance as consumed");
    assert(kpiGrid.includes("animate={animateEntrance}"), "KPI stagger animation can be disabled after first mount");

    const replayGateKey = "dashboard-kpi-grid-test";
    assert(shouldAnimateDashboardEntranceOnce(replayGateKey), "new gate key animates once");
    markDashboardEntranceAnimated(replayGateKey);
    assert(!shouldAnimateDashboardEntranceOnce(replayGateKey), "gate key blocks subsequent entrance replays");
  });

  await test("2. KPI number still updates when value changes", () => {
    assert(metricCard.includes("<MetricValue metric={metric}"), "metric cards still render metric value through CountUp path");
    assert(metricCard.includes("metric.value"), "metric value source remains unchanged");
  });

  await test("3. Activity and schedule do not replay all rows", () => {
    assert(activityFeed.includes("bf-no-motion"), "activity feed suppresses non-new row animation");
    assert(scheduleWidget.includes("bf-no-motion"), "schedule widget suppresses non-new row animation");

    const newIds = collectNewEntityIds(new Set(["a", "b"]), ["a", "b", "c"]);
    assert(Boolean(newIds.c), "helper flags genuinely new row IDs");
    assert(!Boolean(newIds.a), "helper does not replay existing row IDs");
    assert(hasAnimatedEntries(newIds), "helper reports animated entries for new IDs");
  });

  await test("4. Pulse keys ignore time-only changes", () => {
    const recA = buildRecommendationPulseKey({
      id: "rec-1",
      icon: "R",
      priority: "high",
      timestampMinutesAgo: 1,
      messageKey: "dashboard.recommendationProjectOak",
      actions: [],
    });
    const recB = buildRecommendationPulseKey({
      id: "rec-1",
      icon: "R",
      priority: "high",
      timestampMinutesAgo: 45,
      messageKey: "dashboard.recommendationProjectOak",
      actions: [],
    });
    assert(recA === recB, "recommendation pulse key ignores elapsed-time changes");

    const activityA = buildActivityPulseKey({
      id: "activity-1",
      icon: "A",
      category: "project",
      timestampMinutesAgo: 2,
      user: "User",
      avatarLabel: "UU",
      actionLabelKey: "dashboard.activityProjectCreated",
    });
    const activityB = buildActivityPulseKey({
      id: "activity-1",
      icon: "A",
      category: "project",
      timestampMinutesAgo: 77,
      user: "User",
      avatarLabel: "UU",
      actionLabelKey: "dashboard.activityProjectCreated",
    });
    assert(activityA === activityB, "activity pulse key ignores elapsed-time changes");
  });

  await test("5. Pulse keys change for meaningful severity/status updates", () => {
    const recHigh = buildRecommendationPulseKey({
      id: "rec-2",
      icon: "R",
      priority: "high",
      timestampMinutesAgo: 5,
      messageKey: "dashboard.recommendationProjectOak",
      actions: [],
    });
    const recCritical = buildRecommendationPulseKey({
      id: "rec-2",
      icon: "R",
      priority: "critical",
      timestampMinutesAgo: 5,
      messageKey: "dashboard.recommendationProjectOak",
      actions: [],
    });
    assert(recHigh !== recCritical, "recommendation pulse key changes on priority changes");

    const projectLow = buildProjectPulseKey({
      id: "p-1",
      projectName: "Project",
      healthScore: 88,
      budgetStatusKey: "dashboard.projectBudgetWatch",
      scheduleStatusKey: "dashboard.projectScheduleOnTrack",
      lastPhotoUpload: "2h",
      lastDailyReport: "Today",
      currentPhase: "Framing",
      riskIndicator: "low",
      href: "/projects",
    });
    const projectHigh = buildProjectPulseKey({
      id: "p-1",
      projectName: "Project",
      healthScore: 88,
      budgetStatusKey: "dashboard.projectBudgetWatch",
      scheduleStatusKey: "dashboard.projectScheduleOnTrack",
      lastPhotoUpload: "2h",
      lastDailyReport: "Today",
      currentPhase: "Framing",
      riskIndicator: "high",
      href: "/projects",
    });
    assert(projectLow !== projectHigh, "project pulse key changes when risk severity changes");
  });

  await test("6. Dashboard customizer restores focus after closing", () => {
    assert(customizer.includes("useFocusTrap"), "customizer uses shared focus trap");
    assert(customizer.includes("onEscape"), "customizer still closes on Escape");
  });

  await test("7. Mock-data indicator appears only under intended conditions", () => {
    assert(dashboardPage.includes("dashboard.previewData"), "dashboard page renders localized preview-data label");
    assert(shouldShowDashboardPreviewDataBadge({ isMockData: true, nodeEnv: "development" }), "badge is shown for mock data in development");
    assert(shouldShowDashboardPreviewDataBadge({ isMockData: true, nodeEnv: "production", forceVisible: true }), "badge can be forced when mock mode is explicitly active");
    assert(!shouldShowDashboardPreviewDataBadge({ isMockData: false, nodeEnv: "development" }), "badge stays hidden when data is not mock");
  });

  await test("8. Non-functional action controls are disabled", () => {
    assert(commandCenter.includes("disabled"), "command-center actions are rendered disabled");
    assert(commandCenter.includes("dashboard.actionUnavailable"), "disabled action tooltip/label is localized");
  });

  await test("9. Reduced-motion behavior remains intact", () => {
    assert(resolveReducedMotion("reduced", false), "reduced preference still forces reduced motion");
    assert(!resolveReducedMotion("full", true), "full preference still forces full motion");
    assert(resolveReducedMotion("system", true), "system preference still mirrors OS reduced motion");
  });

  await test("10. No API calls introduced in dashboard hardening scope", () => {
    const sources = [kpiGrid, metricCard, activityFeed, scheduleWidget, commandCenter, dashboardPage];
    assert(sources.every((source) => !source.includes("fetch(")), "hardening scope introduces no client fetch calls");
    assert(sources.every((source) => !source.includes("/api/")), "hardening scope references no API endpoints");
  });

  console.log(`\nPhase 2.25 dashboard hardening results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
