import fs from "node:fs";
import path from "node:path";
import { rankActionsWithWorkspaceContext } from "./ranking";
import { buildWorkspaceContext, parseRouteContext } from "./workspace-context";
import type { OrionCommandCenterAction, OrionWorkspaceContext } from "./types";

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

function test(name: string, run: () => void) {
  console.log(`\n${name}`);
  run();
}

function read(relativePath: string) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

function buildAction(params: Partial<OrionCommandCenterAction> & Pick<OrionCommandCenterAction, "id" | "label" | "commandId">): OrionCommandCenterAction {
  return {
    id: params.id,
    label: params.label,
    subtitle: params.subtitle || "",
    group: params.group || "navigation",
    commandId: params.commandId,
    params: params.params || {},
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    hrefPreview: params.hrefPreview || null,
    keywords: params.keywords || [],
    contextTags: params.contextTags || [],
    requiredPermissions: params.requiredPermissions || ["owner"],
    confirmationLevel: params.confirmationLevel || "NONE",
    coverage: params.coverage || { status: "implemented" },
    preview: params.preview || {
      target: params.id,
      permission: ["owner"],
      confirmationLevel: "NONE",
      expectedOutcome: "ok",
      eventsThatWillPublish: [],
    },
  };
}

function buildContext(overrides: Partial<OrionWorkspaceContext>): OrionWorkspaceContext {
  return {
    currentPage: "Projects",
    currentRoute: "/projects/abc",
    currentProject: { id: "abc", label: "Project abc" },
    currentCustomer: null,
    currentEstimate: null,
    currentInvoice: null,
    currentEmployee: null,
    currentCrew: null,
    currentDashboardWidget: null,
    currentTimelineItem: null,
    currentCompany: { id: "co-1", label: "Bango Co" },
    currentAuthenticatedUser: { id: "u-1", label: "User" },
    focusArea: "project",
    ...overrides,
  };
}

function main() {
  test("1. Workspace context parses route and IDs", () => {
    const parsed = parseRouteContext(new URL("https://example.com/projects/123?customerId=456&widgetId=risk-summary&timelineItemId=evt-1"));
    assert(parsed.pathname === "/projects/123", "route pathname parsed");
    assert(parsed.projectId === "123", "project id parsed from route segment");
    assert(parsed.customerId === "456", "customer id parsed from query string");
    assert(parsed.dashboardWidgetId === "risk-summary", "dashboard widget id parsed");
    assert(parsed.timelineItemId === "evt-1", "timeline item id parsed");

    const context = buildWorkspaceContext({
      workspace: {
        userId: "user-1",
        companyId: "company-1",
        role: "owner",
        companyName: "Bango",
        companySlug: null,
        membershipId: null,
        membershipStatus: null,
      },
      route: parsed,
    });

    assert(context.focusArea === "project", "workspace focus area resolves to project");
    assert(context.currentCompany.id === "company-1", "workspace company is preserved");
    assert(context.currentAuthenticatedUser.id === "user-1", "workspace authenticated user is preserved");
  });

  test("2. Ranking prioritizes context-aware actions", () => {
    const actions = [
      buildAction({ id: "route-project-budget", label: "Open Budget", commandId: "dashboard.open", contextTags: ["project"], group: "projects" }),
      buildAction({ id: "route-dashboard", label: "Open Dashboard", commandId: "dashboard.open", contextTags: ["dashboard"], group: "navigation" }),
      buildAction({ id: "route-settings", label: "Open Settings", commandId: "dashboard.open", contextTags: ["general"], group: "settings" }),
    ];

    const ranked = rankActionsWithWorkspaceContext({
      actions,
      query: "",
      context: buildContext({ focusArea: "project" }),
      recentIds: [],
      pinnedIds: [],
    });

    assert(ranked[0]?.id === "route-project-budget", "project context ranks project budget first");
    assert(!ranked.some((item) => item.id === "route-settings"), "irrelevant settings action is filtered when no query");
  });

  test("3. Query search keeps broad discoverability", () => {
    const actions = [
      buildAction({ id: "route-project-budget", label: "Open Budget", commandId: "dashboard.open", contextTags: ["project"], group: "projects", keywords: ["budget"] }),
      buildAction({ id: "route-settings", label: "Open Settings", commandId: "dashboard.open", contextTags: ["settings"], group: "settings", keywords: ["settings"] }),
    ];

    const ranked = rankActionsWithWorkspaceContext({
      actions,
      query: "settings",
      context: buildContext({ focusArea: "project" }),
      recentIds: [],
      pinnedIds: [],
    });

    assert(ranked.some((item) => item.id === "route-settings"), "query can surface actions outside immediate focus context");
  });

  test("4. Overlay/API/service include Phase 7B primitives", () => {
    const overlay = read("components/orion/command-center/OrionCommandCenterOverlay.tsx");
    const apiRoute = read("app/api/orion/command-center/route.ts");
    const service = read("lib/orion/command-center/service.ts");

    assert(overlay.includes("Current Context"), "overlay shows current context sidebar section");
    assert(overlay.includes("Suggested Actions"), "overlay shows suggested actions section");
    assert(overlay.includes("Related Records"), "overlay renders related records section");
    assert(overlay.includes("mode=related"), "overlay lazily requests related records");
    assert(apiRoute.includes("parseRouteContext"), "API resolves workspace route context");
    assert(apiRoute.includes("mode") && apiRoute.includes("related"), "API exposes related-record mode");
    assert(service.includes("getCustomerRelatedRecords"), "service includes related-record loader");
    assert(service.includes("createOrionTimelineService"), "service uses Orion timeline for recent activity");
  });

  console.log(`\nPhase 7B workspace intelligence results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
