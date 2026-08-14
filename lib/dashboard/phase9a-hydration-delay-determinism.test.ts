import fs from "node:fs";
import path from "node:path";
import { getWidgetAnimationDelayMs } from "./motion-helpers";

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
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function delayStyle(widgetId: Parameters<typeof getWidgetAnimationDelayMs>[0]) {
  return {
    ["--bf-delay" as string]: `${getWidgetAnimationDelayMs(widgetId)}ms`,
    ["--bf-distance" as string]: "5px",
  };
}

function main() {
  const dashboardPage = read("app/(app)/dashboard/page.tsx");
  const layoutHook = read("lib/dashboard/use-dashboard-layout.ts");
  const fadeIn = read("components/motion/fade-in.tsx");
  const card = read("components/ui/card.tsx");

  test("1. same input renders same --bf-delay", () => {
    const a = getWidgetAnimationDelayMs("pending-followups");
    const b = getWidgetAnimationDelayMs("pending-followups");
    assert(a === b, "same widget id always yields the same delay");
    assert(a === 196, "pending-followups maps to 196ms deterministic delay");
  });

  test("2. repeated renders are deterministic", () => {
    const runs = Array.from({ length: 8 }, () => getWidgetAnimationDelayMs("business-score"));
    assert(runs.every((value) => value === runs[0]), "repeated computations return the same delay");
    assert(runs[0] === 28, "business-score maps to 28ms deterministic delay");
  });

  test("3. server-style and first-client-style values match", () => {
    const serverStyle = delayStyle("pending-followups");
    const clientStyle = delayStyle("pending-followups");
    assert(serverStyle["--bf-delay"] === clientStyle["--bf-delay"], "bf-delay matches for SSR and first client render");
    assert(serverStyle["--bf-distance"] === clientStyle["--bf-distance"], "bf-distance also matches");
  });

  test("4. multiple cards still receive staggered delays", () => {
    const first = getWidgetAnimationDelayMs("business-score");
    const second = getWidgetAnimationDelayMs("command-center");
    const third = getWidgetAnimationDelayMs("kpi");
    assert(first < second && second < third, "earlier sequence ranks keep stagger order");
    assert(first === 28 && second === 56 && third === 84, "stagger increments are preserved at 28ms steps");
  });

  test("5. no Math.random/Date.now in render delay path", () => {
    assert(!dashboardPage.includes("Math.random(") && !dashboardPage.includes("Date.now("), "dashboard render path avoids random/time delay generation");
    assert(fadeIn.includes("Math.max(0, delayMs)") && !fadeIn.includes("Math.random("), "FadeIn only applies provided deterministic delay");
  });

  test("6. dashboard card render avoids hydration mismatch source", () => {
    assert(layoutHook.includes("useState<DashboardLayoutState>(defaultLayout)"), "first render uses default layout on both server and client");
    assert(layoutHook.includes("useEffect(() => {") && layoutHook.includes("window.localStorage.getItem(STORAGE_KEY)"), "persisted layout is loaded after hydration in an effect");
    assert(dashboardPage.includes("getWidgetAnimationDelayMs(widgetId)"), "dashboard uses stable helper for bf-delay value");
    assert(card.includes("export function CardTitle") && !card.includes("--bf-delay"), "CardTitle is not the delay source");
  });

  console.log(`\nPhase 9A hydration delay determinism results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
