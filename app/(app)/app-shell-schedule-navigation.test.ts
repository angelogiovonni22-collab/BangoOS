import { readFileSync } from "node:fs";
import { join } from "node:path";

function read(relativePath: string) {
  return readFileSync(join(process.cwd(), relativePath), "utf8");
}

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function parseNavigationItems(source: string) {
  const matches = Array.from(source.matchAll(/\{ key: "([^"]+)", href: "([^"]+)", icon: "([^"]+)" \}/g));
  return matches.map((match) => ({ key: match[1], href: match[2], icon: match[3] }));
}

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
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

async function main() {
  const appShellSource = read("app/(app)/app-shell.tsx");
  const navigationCatalogSource = read("lib/orion/navigation/catalog.ts");
  const scheduleSource = read("app/(app)/schedule/page.tsx");
  const schedulingSource = read("app/(app)/scheduling/page.tsx");
  const schedulingDispatchSource = read("app/(app)/scheduling/dispatch/page.tsx");
  const schedulingCalendarSource = read("app/(app)/scheduling/calendar/page.tsx");
  const schedulingForecastSource = read("app/(app)/scheduling/forecast/page.tsx");
  const dispatchSource = read("app/(app)/dispatch/page.tsx");
  const navigationLocale = read("locales/en/navigation.json");
  const items = parseNavigationItems(navigationCatalogSource);
  const scheduleItem = items.find((item) => item.key === "schedule");
  const dispatchItem = items.find((item) => item.key === "dispatch");

  await test("1. Schedule and Dispatch Center use distinct navigation entries", () => {
    check(Boolean(scheduleItem), "Schedule navigation item exists");
    check(Boolean(dispatchItem), "Dispatch Center navigation item exists");
    check(scheduleItem?.href !== dispatchItem?.href, "Schedule and Dispatch Center use different href values");
    check(scheduleItem?.key !== dispatchItem?.key, "Schedule and Dispatch Center use different navigation keys");
    check(new Set(items.map((item) => item.key)).size === items.length, "No duplicate navigation keys exist");
    check(navigationLocale.includes('"schedule": "Schedule"'), "Schedule label remains Schedule");
    check(navigationLocale.includes('"dispatch": "Dispatch Center"'), "Second label is Dispatch Center");
  });

  await test("2. Schedule resolves to its own route", () => {
    check(scheduleItem?.href === "/schedule", "Schedule route remains /schedule");
    check(scheduleSource.includes('initialSection="calendar"'), "Schedule route renders its own schedule-focused page state");
    check(scheduleSource.includes('workspace="schedule"'), "Schedule route renders the Schedule workspace variant");
  });

  await test("3. Dispatch Center resolves to its own route", () => {
    check(dispatchItem?.href === "/dispatch", "Dispatch Center route is /dispatch");
    check(dispatchSource.includes('initialSection="overview"'), "Dispatch Center route keeps its operational overview state");
    check(dispatchSource.includes('workspace="dispatch"'), "Dispatch Center route renders the dispatch workspace variant");
    check(schedulingSource.includes('redirect("/dispatch")'), "Old /scheduling route redirects to /dispatch");
    check(schedulingDispatchSource.includes('redirect("/dispatch")'), "Old /scheduling/dispatch route redirects to /dispatch");
    check(schedulingCalendarSource.includes('redirect("/schedule")'), "Old /scheduling/calendar route redirects to /schedule");
    check(schedulingForecastSource.includes('redirect("/dispatch/forecast")'), "Old /scheduling/forecast route redirects to /dispatch/forecast");
  });

  await test("4. Active matching distinguishes Schedule from Dispatch Center", () => {
    check(isActive("/schedule", "/schedule"), "Schedule path activates Schedule");
    check(!isActive("/schedule", "/dispatch"), "Schedule path does not activate Dispatch Center");
    check(isActive("/dispatch", "/dispatch"), "Dispatch Center path activates its own item");
    check(!isActive("/dispatch", "/schedule"), "Dispatch Center path does not activate Schedule");
    check(isActive("/dispatch/forecast", "/dispatch"), "Dispatch child route stays under Dispatch Center");
    check(!isActive("/dispatch/forecast", "/schedule"), "Dispatch child route does not activate Schedule");
  });

  await test("5. Sidebar scrolling contract remains untouched", () => {
    check(appShellSource.includes("min-h-0 flex-1 space-y-3 overflow-y-auto"), "Dedicated scrollable nav container remains intact");
  });

  console.log(`\nSchedule navigation regression results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
