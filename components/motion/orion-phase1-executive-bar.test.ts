import fs from "node:fs";
import path from "node:path";
import { rankExecutivePriorityItems } from "../../lib/orion/executive-priority-engine";
import { routeExecutiveCommand } from "../../lib/orion/executive-brief-service";
import type { ExecutiveBrief } from "../../lib/orion/executive-brief-types";

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

const t = (key: string, params?: Record<string, string | number>) => {
  if (key === "orion.commandSupported") {
    return `Command ready: ${String(params?.command ?? "")}`;
  }

  if (key === "orion.commandUnavailable") {
    return "That command is not yet available.";
  }

  return key;
};

const brief: ExecutiveBrief = {
  greeting: { eyebrow: "Project Orion", title: "Good morning, BangoOS", description: "Summary" },
  companySummary: { headline: "Headline", items: [] },
  healthSummary: { headline: "Health", state: "attention", items: [] },
  priorityItems: [],
  notifications: [],
  readinessState: "attention",
  limitations: [],
  generatedAt: new Date().toISOString(),
  quickCommands: [
    { id: "overdue-tasks", label: "Overdue tasks", example: "Show overdue tasks", href: "/projects" },
    { id: "overdue-invoices", label: "Overdue invoices", example: "Show overdue invoices", href: "/invoices" },
    { id: "active-projects", label: "Active projects", example: "Show active projects", href: "/projects" },
    { id: "blocked-tasks", label: "Blocked tasks", example: "Show blocked tasks", href: "/projects" },
  ],
};

async function main(): Promise<void> {
  const executiveBar = read("components/orion/ExecutiveIntelligenceBar.tsx");
  const commandBar = read("components/orion/ExecutiveCommandBar.tsx");
  const dashboardPage = read("app/(app)/dashboard/page.tsx");
  const service = read("lib/orion/executive-brief-service.ts");

  await test("1. Orion bar is integrated into dashboard", () => {
    assert(dashboardPage.includes("ExecutiveIntelligenceBar"), "dashboard page renders ExecutiveIntelligenceBar");
    assert(dashboardPage.includes("dashboardData={data}"), "dashboard page passes live dashboard data into Orion");
  });

  await test("2. Priority ranking stays deterministic", () => {
    const ranked = rankExecutivePriorityItems([
      {
        id: "learning",
        title: "Learning",
        description: "Low sample",
        severity: "low",
        category: "operations",
        affectedCount: null,
        href: null,
        source: "learning",
        score: 0,
      },
      {
        id: "invoice",
        title: "Invoices",
        description: "Overdue invoices",
        severity: "critical",
        category: "budget",
        affectedCount: 3,
        href: "/invoices",
        source: "dashboard",
        score: 0,
      },
    ]);

    assert(ranked[0]?.id === "invoice", "critical overdue invoice priority ranks ahead of low learning coverage");
    assert(ranked[0]?.score <= ranked[1]?.score, "priority scores sort ascending deterministically");
  });

  await test("3. Command routing remains deterministic", () => {
    const supported = routeExecutiveCommand("Show overdue tasks", brief, t);
    assert(supported.supported, "supported command resolves without AI");
    assert(supported.href === "/projects", "overdue tasks route maps to projects");

    const unsupported = routeExecutiveCommand("show project forecast", brief, t);
    assert(!unsupported.supported, "unsupported command returns unavailable response");
    assert(unsupported.message === "That command is not yet available.", "unsupported command uses clear not-yet-available copy");
  });

  await test("4. Orion UI keeps motion constrained", () => {
    assert(executiveBar.includes("<FadeIn"), "executive bar uses existing BangoFlow fade-in motion");
    assert(!executiveBar.includes("setInterval("), "executive bar does not introduce looping animations");
  });

  await test("5. Orion command bar introduces no AI or chat behavior", () => {
    const sources = [executiveBar, commandBar, service];
    assert(sources.every((source) => !source.includes("OpenAI")), "Orion introduces no OpenAI calls");
    assert(sources.every((source) => !source.includes("/api/bango-intelligence/narrate")), "Orion introduces no narration API calls");
    assert(sources.every((source) => !source.toLowerCase().includes("chat")), "Orion introduces no chat behavior");
  });

  console.log(`\nOrion Phase 1 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();