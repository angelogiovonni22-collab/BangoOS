import { ORION_NAVIGATION_ROUTES, resolveDeterministicNavigationRoute } from "./catalog";

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

function main() {
  test("1. canonical static routes include every core B.O.S. workspace", () => {
    const requiredRouteIds = [
      "route-dashboard",
      "route-operations",
      "route-timeline",
      "route-dispatch",
      "route-schedule",
      "route-projects",
      "route-customers",
      "route-estimates",
      "route-invoices",
      "route-change-orders",
      "route-labor-rates",
      "route-materials",
      "route-units-of-measure",
      "route-equipment",
      "route-vendors",
      "route-employees",
      "route-crews",
      "route-team",
      "route-settings",
      "route-settings-memory-review",
      "route-cost-codes",
      "route-daily-reports",
      "route-labs-mission-control",
      "route-labs-orion-core",
      "route-labs-quantum",
    ];

    for (const routeId of requiredRouteIds) {
      assert(ORION_NAVIGATION_ROUTES.some((route) => route.id === routeId), `${routeId} exists in canonical route catalog`);
    }
  });

  test("2. deterministic aliases resolve expected command IDs and deep links", () => {
    const checks = [
      { phrase: "open dashboard", commandId: "dashboard.open", deepLink: "/dashboard" },
      { phrase: "open operations", commandId: "dashboard.open", deepLink: "/operations" },
      { phrase: "open dispatch center", commandId: "dashboard.open", deepLink: "/dispatch" },
      { phrase: "show today's schedule", commandId: "schedule.open", deepLink: "/schedule?range=today" },
      { phrase: "open vendors", commandId: "dashboard.open", deepLink: "/vendors" },
      { phrase: "open memory review", commandId: "dashboard.open", deepLink: "/settings/memory-review" },
      { phrase: "open mission control", commandId: "dashboard.open", deepLink: "/labs/mission-control" },
    ] as const;

    for (const check of checks) {
      const resolved = resolveDeterministicNavigationRoute(check.phrase);
      assert(Boolean(resolved), `${check.phrase} resolves`);
      assert(resolved?.commandId === check.commandId, `${check.phrase} maps to ${check.commandId}`);
      assert(resolved?.deepLink === check.deepLink, `${check.phrase} maps to ${check.deepLink}`);
    }
  });

  console.log(`\nPhase 8A navigation catalog results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
