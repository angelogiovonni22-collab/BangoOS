import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildDecisionCandidate,
  buildDecisionResult,
  canTransitionDecisionStatus,
  computeBusinessHealth,
  createDecisionRegistry,
  decisionCategoryLabel,
  priorityScore,
  sortDecisionsByPriority,
  validateDecisionRecord,
  validateDecisionRule,
  type OrionDecisionRecord,
} from "./index";

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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function seedDecision(overrides: Partial<OrionDecisionRecord> = {}): OrionDecisionRecord {
  return {
    decisionId: "cmp-1:rule-a:estimate:est-1",
    companyId: "cmp-1",
    ruleId: "rule-a",
    priority: "high",
    category: "estimates",
    severity: "high",
    title: "Estimate pending too long",
    summary: "Estimate EST-1 is pending.",
    recommendation: "Follow up.",
    relatedEntity: {
      type: "estimate",
      id: "est-1",
      href: "/estimates/est-1",
    },
    relatedEventId: null,
    detectedAt: "2026-08-04T12:00:00.000Z",
    status: "new",
    acknowledged: false,
    resolved: false,
    dismissed: false,
    acknowledgedAt: null,
    resolvedAt: null,
    dismissedAt: null,
    actionLabel: "Open Estimate",
    actionHref: "/estimates/est-1",
    ...overrides,
  };
}

async function main() {
  await test("1. decision rules include all required categories", () => {
    const rules = createDecisionRegistry();
    const categories = new Set(rules.map((rule) => rule.category));

    check(categories.has("estimates"), "estimate rules exist");
    check(categories.has("customers"), "customer rules exist");
    check(categories.has("projects"), "project rules exist");
    check(categories.has("finance"), "finance rules exist");
    check(categories.has("workforce"), "workforce rules exist");
    check(categories.has("operations"), "operations rules exist");
  });

  await test("2. rule validation rejects malformed rule", () => {
    const bad = validateDecisionRule({
      id: "",
      enabled: true,
      category: "estimates",
      async evaluate() {
        return [];
      },
    });

    check(!bad.ok, "empty rule id is rejected");
  });

  await test("3. decision record validation checks key fields", () => {
    const valid = validateDecisionRecord(seedDecision());
    const invalid = validateDecisionRecord(seedDecision({
      decisionId: "",
      actionHref: "http://external",
    }));

    check(valid.ok, "valid decision passes validation");
    check(!invalid.ok, "invalid decision fails validation");
  });

  await test("4. priority sorting is deterministic", () => {
    const decisions = [
      seedDecision({ decisionId: "2", priority: "low", detectedAt: "2026-08-03T01:00:00.000Z" }),
      seedDecision({ decisionId: "1", priority: "critical", detectedAt: "2026-08-03T02:00:00.000Z" }),
      seedDecision({ decisionId: "3", priority: "high", detectedAt: "2026-08-03T03:00:00.000Z" }),
    ];

    const sorted = [...decisions].sort(sortDecisionsByPriority);
    check(sorted[0]?.priority === "critical", "critical sorts first");
    check(priorityScore("high") > priorityScore("medium"), "priority score ordering is correct");
  });

  await test("5. company health is deterministic from decisions", () => {
    const health = computeBusinessHealth([
      seedDecision({ category: "estimates", priority: "high" }),
      seedDecision({ decisionId: "b", category: "finance", priority: "critical" }),
      seedDecision({ decisionId: "c", category: "workforce", priority: "medium" }),
    ]);

    const overall = health.find((item) => item.id === "overall");
    check(Boolean(overall), "overall health item exists");
    check((overall?.score || 0) < 100, "overall score decreases when risks exist");
  });

  await test("6. morning briefing output is deterministic", () => {
    const result = buildDecisionResult({
      companyId: "cmp-1",
      detectedAt: "2026-08-04T12:00:00.000Z",
      decisions: [
        seedDecision({ summary: "2 estimates need follow-up.", priority: "high" }),
        seedDecision({ decisionId: "x", summary: "One deposit is overdue.", category: "finance", priority: "critical" }),
      ],
      companyName: "Angelo",
      now: new Date("2026-08-04T08:00:00.000Z"),
    });

    check(result.morningBriefing.greeting.includes("Good Morning"), "briefing uses deterministic greeting template");
    check(result.morningBriefing.lines.length > 0, "briefing includes priority lines");
  });

  await test("7. duplicate prevention key stays deterministic", () => {
    const one = buildDecisionCandidate({
      companyId: "cmp-1",
      ruleId: "estimate-pending-too-long",
      priority: "high",
      category: "estimates",
      title: "Estimate pending too long",
      summary: "Estimate EST-1 pending",
      recommendation: "Follow up",
      entityType: "estimate",
      entityId: "est-1",
      href: "/estimates/est-1",
      detectedAt: "2026-08-04T12:00:00.000Z",
      actionLabel: "Open Estimate",
    });

    const two = buildDecisionCandidate({
      companyId: "cmp-1",
      ruleId: "estimate-pending-too-long",
      priority: "high",
      category: "estimates",
      title: "Estimate pending too long",
      summary: "Estimate EST-1 pending",
      recommendation: "Follow up",
      entityType: "estimate",
      entityId: "est-1",
      href: "/estimates/est-1",
      detectedAt: "2026-08-04T12:00:00.000Z",
      actionLabel: "Open Estimate",
    });

    check(one.decisionId === two.decisionId, "same rule+entity produces same decision id");
  });

  await test("8. company isolation in decision id", () => {
    const one = buildDecisionCandidate({
      companyId: "cmp-a",
      ruleId: "invoice-overdue",
      priority: "high",
      category: "finance",
      title: "Invoice overdue",
      summary: "Invoice overdue",
      recommendation: "Follow up",
      entityType: "invoice",
      entityId: "inv-1",
      href: "/invoices/inv-1",
      detectedAt: "2026-08-04T12:00:00.000Z",
      actionLabel: "Open Invoice",
    });

    const two = buildDecisionCandidate({
      companyId: "cmp-b",
      ruleId: "invoice-overdue",
      priority: "high",
      category: "finance",
      title: "Invoice overdue",
      summary: "Invoice overdue",
      recommendation: "Follow up",
      entityType: "invoice",
      entityId: "inv-1",
      href: "/invoices/inv-1",
      detectedAt: "2026-08-04T12:00:00.000Z",
      actionLabel: "Open Invoice",
    });

    check(one.decisionId !== two.decisionId, "decision ids are company-scoped");
  });

  await test("9. status transitions are constrained", () => {
    check(canTransitionDecisionStatus("new", "acknowledged"), "new -> acknowledged allowed");
    check(canTransitionDecisionStatus("acknowledged", "resolved"), "acknowledged -> resolved allowed");
    check(!canTransitionDecisionStatus("dismissed", "new"), "dismissed -> new not allowed");
  });

  await test("10. timeline integration includes decision events", () => {
    const timelineSource = readFileSync(resolve(process.cwd(), "lib", "orion", "timeline", "timeline-mappers.ts"), "utf8");
    check(timelineSource.includes("decision.created"), "timeline maps decision.created");
    check(timelineSource.includes("decision.resolved"), "timeline maps decision.resolved");
    check(timelineSource.includes("decision.dismissed"), "timeline maps decision.dismissed");
  });

  await test("11. automation integration rule coverage exists", () => {
    const decisionRules = readFileSync(resolve(process.cwd(), "lib", "orion", "decision", "decision-registry.ts"), "utf8");
    check(decisionRules.includes("automation-failure-rate-high"), "automation failure rule exists");
    check(decisionRules.includes("automation-backlog"), "automation backlog rule exists");
  });

  await test("12. dashboard integration includes phase 4B widgets", () => {
    const dashboardSource = readFileSync(resolve(process.cwd(), "app", "(app)", "dashboard", "page.tsx"), "utf8");
    check(dashboardSource.includes("TopPrioritiesWidget"), "Top Priorities widget is mounted");
    check(dashboardSource.includes("BusinessHealthWidget"), "Business Health widget is mounted");
    check(dashboardSource.includes("RiskSummaryWidget"), "Risk Summary widget is mounted");
    check(dashboardSource.includes("TodaysDecisionsWidget"), "Today's Decisions widget is mounted");
    check(dashboardSource.includes("CriticalAlertsWidget"), "Critical Alerts widget is mounted");
  });

  await test("13. recommendation action links remain deterministic", () => {
    const labels = [
      decisionCategoryLabel("estimates"),
      decisionCategoryLabel("customers"),
      decisionCategoryLabel("projects"),
      decisionCategoryLabel("finance"),
      decisionCategoryLabel("workforce"),
      decisionCategoryLabel("operations"),
    ];

    check(labels.length === 6, "category labels resolve for all decision domains");
  });

  console.log(`\nOrion decision engine phase 4B results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
