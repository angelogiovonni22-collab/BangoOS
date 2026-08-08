import { readFileSync } from "node:fs";
import { join } from "node:path";

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

async function main() {
  await test("1. app shell mobile nav uses bounded dedicated scroll region", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("<div className=\"mt-7 flex min-h-0 flex-1 flex-col overflow-hidden\">"), "sidebar content column creates bounded flex chain for scrolling");
    assert(source.includes("<nav className=\"h-full min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain touch-pan-y pr-1 [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [&::-webkit-scrollbar]:hidden\">"), "nav is the dedicated touch-safe overflow container with hidden scrollbar and iOS momentum scrolling");
    assert(source.includes("<div className=\"mt-auto shrink-0 rounded-[var(--radius-xl)] border border-[var(--bos-border-subtle)] bg-[linear-gradient(180deg,rgba(17,31,55,0.86),rgba(11,22,39,0.86))] p-4 backdrop-blur\">"), "footer/account card remains outside nav scroll area");
    assert(!source.includes("<nav className=\"mt-7 space-y-3\">"), "legacy non-scroll nav container is removed");
    assert(source.includes("lg:sticky lg:top-0 lg:h-screen lg:[height:100dvh]"), "desktop sidebar keeps a constrained full-height sticky scroll container");
    assert(!source.includes("lg:h-auto"), "desktop sidebar no longer switches to unconstrained auto height");
    assert(source.includes("<LayerManager layer=\"popover\">"), "sidebar is rendered in popover layer for stable stacking with persistent Orion");
    assert(source.includes("<LayerManager layer=\"backdrop\">"), "mobile backdrop is rendered in dedicated backdrop layer");
    assert(source.includes("z-[var(--z-popover)]"), "sidebar sets explicit popover z-index to avoid fixed layering anomalies");
    assert(source.includes("z-[var(--z-backdrop)]"), "backdrop sets explicit backdrop z-index under the sidebar");
    assert(source.includes("flex min-h-screen min-w-0"), "outer shell row remains width-bounded when viewport narrows");
    assert(source.includes("flex min-h-screen min-h-0 min-w-0 flex-1 flex-col"), "content column keeps min-h-0 in flex chain");
    assert(source.includes("fixed inset-y-0 left-0 z-[var(--z-popover)] flex min-h-0 w-72 flex-col overflow-hidden"), "narrow-layout drawer keeps explicit min-h-0 with bounded viewport height");
    assert(source.includes("<main className=\"min-h-0 min-w-0 flex-1 bg-[radial-gradient(circle_at_15%_0%,rgba(59,130,246,0.08),transparent_26%)] p-4 sm:p-6 lg:p-7\">"), "main content keeps min-h-0 and does not break sibling sidebar scroll chain");
  });

  await test("2. shell visual and theme classes remain unchanged", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("<div className=\"min-h-screen bg-[var(--bos-bg-root)] text-[var(--bos-text-primary)] enterprise-shell\">"), "enterprise shell background and text color classes remain unchanged");
    assert(source.includes("border-r border-[var(--bos-border-default)] bg-[var(--bos-bg-sidebar)] px-5 py-6 text-[var(--bos-text-primary)] shadow-[0_24px_50px_-24px_rgba(4,10,22,0.92)]"), "sidebar visual color, spacing, and shadow classes remain unchanged");
  });

  await test("3. persistent Orion mounts once without shell duplication", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("import { PersistentOrion } from \"@/components/orion/persistent\";"), "app shell imports persistent Orion module");

    const mountMatches = source.match(/<PersistentOrion \/>/g) ?? [];
    assert(mountMatches.length === 1, "persistent Orion is mounted exactly once");

    const sidebarMatches = source.match(/id=\"bangoos-sidebar\"/g) ?? [];
    assert(sidebarMatches.length === 1, "sidebar remains singular and is not duplicated");
  });

  await test("4. opening mobile nav locks page scroll", () => {
    const source = readFileSync(join(process.cwd(), "app", "(app)", "app-shell.tsx"), "utf8");

    assert(source.includes("document.body.style.overflow = \"hidden\";"), "mobile nav open locks body scroll");
    assert(source.includes("document.body.style.removeProperty(\"overflow\");"), "mobile nav close restores body scroll");
  });

  console.log(`\nApp shell mobile nav scroll results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
