import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { getPersistentOrionFixture } from "./fixtures";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function testFixtureMapping() {
  const dashboard = getPersistentOrionFixture("/dashboard");
  const projects = getPersistentOrionFixture("/projects/abc");
  const crm = getPersistentOrionFixture("/crm");
  const invoices = getPersistentOrionFixture("/invoices");
  const workforce = getPersistentOrionFixture("/crews");
  const equipment = getPersistentOrionFixture("/equipment");
  const settings = getPersistentOrionFixture("/settings");
  const unknown = getPersistentOrionFixture("/labs/quantum");

  assert.equal(dashboard.state, "READY", "Dashboard maps to READY");
  assert.equal(projects.state, "ANALYZING", "Projects map to ANALYZING");
  assert.equal(crm.state, "NEW_INSIGHT", "CRM maps to NEW_INSIGHT");
  assert.equal(invoices.state, "ATTENTION", "Finance routes map to ATTENTION");
  assert.equal(workforce.state, "STALE_DATA", "Workforce routes map to STALE_DATA");
  assert.equal(equipment.state, "CRITICAL", "Equipment maps to CRITICAL");
  assert.equal(settings.state, "UNAVAILABLE", "Settings maps to UNAVAILABLE");
  assert.equal(unknown.state, "READY", "Unknown routes map to READY fallback");

  assert.equal(dashboard.observation, "Monitoring company operations.", "Dashboard observation is deterministic");
  assert.equal(projects.observation, "Monitoring project health, schedule, and dependencies.", "Projects observation is deterministic");
  assert.equal(crm.observation, "Monitoring follow-ups and customer activity.", "CRM observation is deterministic");
  assert.equal(invoices.observation, "Monitoring invoices, approvals, and cash-flow signals.", "Finance observation is deterministic");
  assert.equal(equipment.observation, "Monitoring inspections, maintenance, and assignments.", "Equipment observation is deterministic");
  assert.equal(settings.observation, "Orion intelligence is limited in this workspace.", "Settings observation is deterministic");
  assert.equal(unknown.observation, "Monitoring this workspace.", "Unknown route fallback observation is deterministic");
}

function testSourceSafetyContracts() {
  const shellSource = read("app/(app)/app-shell.tsx");
  const persistentSource = read("components/orion/persistent/PersistentOrion.tsx");
  const buttonSource = read("components/orion/persistent/PersistentOrionButton.tsx");
  const panelSource = read("components/orion/persistent/PersistentOrionPanel.tsx");
  const sphereSource = read("components/orion/persistent/PersistentOrionMiniSphere.tsx");
  const stylesSource = read("components/orion/persistent/persistent-orion.module.css");
  const globalsSource = read("app/globals.css");

  assert.ok(shellSource.includes("<PersistentOrion />"), "App shell mounts PersistentOrion once");
  const mountMatches = shellSource.match(/<PersistentOrion \/>/g) ?? [];
  assert.equal(mountMatches.length, 1, "PersistentOrion mount count should remain one");
  assert.ok(shellSource.includes("<LayerManager layer=\"backdrop\">"), "Sidebar uses navigation-safe backdrop layer instead of dialog/modal layer");
  assert.ok(shellSource.includes("id=\"bangoos-sidebar\""), "Sidebar structure remains unchanged");
  assert.ok(!shellSource.includes("pointer-events-none"), "Sidebar pointer behavior remains unchanged");

  assert.ok(persistentSource.includes("usePathname"), "Persistent Orion uses pathname for context fixtures");
  assert.ok(persistentSource.includes("useMotionPreferences"), "Persistent Orion consumes motion preference");
  assert.ok(!stylesSource.includes(".persistentOrionRoot :global(.persistentOrionVisual)::before"), "1. dark circular background is removed");
  assert.ok(!stylesSource.includes(".persistentOrionRoot :global(.persistentOrionVisual)::after"), "2. outer visual halo backdrop is removed");
  assert.ok(!buttonSource.includes("persistentOrionText"), "2. pill layout remains removed");
  assert.ok(stylesSource.includes("--po-full-size: 116px"), "3. visible size increased to the larger sphere");
  assert.ok(persistentSource.includes("onPointerDown={(event) => {") || buttonSource.includes("onPointerDown={onPointerDown}"), "4. pointer drag handling exists");
  assert.ok(persistentSource.includes("setPointerCapture") && persistentSource.includes("releasePointerCapture"), "5. pointer capture is used");
  assert.ok(persistentSource.includes("DRAG_THRESHOLD_PX = 6") && persistentSource.includes("suppressClickRef.current = true"), "6. drag threshold distinguishes dragging from clicking");
  assert.ok(persistentSource.includes("clampPosition") && persistentSource.includes("viewport.width - width - FLOAT_MARGIN"), "7. viewport clamping exists");
  assert.ok(persistentSource.includes("visualViewport?.addEventListener(\"resize\", handleResize)") && persistentSource.includes("setPanelStyle({ left, top, position: \"fixed\" })"), "8. resize clamping exists");
  assert.ok(
    persistentSource.includes("bangoos:persistent-orion-position:v2-session")
      && persistentSource.includes("sessionStorage.setItem")
      && !persistentSource.includes("localStorage.setItem"),
    "9. sessionStorage position persistence exists with versioned key",
  );
  assert.ok(persistentSource.includes("if (!isFiniteNumber(parsed.x) || !isFiniteNumber(parsed.y))") || persistentSource.includes("return null;"), "10. invalid stored positions fall back safely");
  assert.ok(persistentSource.includes("if (typeof window === \"undefined\")") && persistentSource.includes("readStoredPosition"), "11. server-render safety exists");
  assert.ok(persistentSource.includes("event.key === \"ArrowLeft\"") && persistentSource.includes("event.key === \"ArrowDown\""), "12. keyboard arrow repositioning exists");
  assert.ok(persistentSource.includes("const step = event.shiftKey ? 24 : 12"), "13. Shift + Arrow larger movement exists");
  assert.ok(buttonSource.includes("aria-describedby={instructionsId}") && persistentSource.includes("Drag Orion to reposition it. Use arrow keys when focused."), "14. accessible drag instructions exist");
  assert.ok(stylesSource.includes(".persistentOrionRoot {") && stylesSource.includes("pointer-events: auto;"), "interactive wrapper has pointer-events enabled");
  assert.ok(
    stylesSource.includes("z-index: calc(var(--z-backdrop) + 10);")
      || stylesSource.includes("z-index: calc(var(--z-backdrop, 1000) + 10);"),
    "Persistent Orion root z-index is above sidebar navigation layer",
  );
  assert.ok(stylesSource.includes(".persistentOrionRoot :global(.persistentOrionPanel)") && stylesSource.includes("z-index: 2;"), "Persistent Orion panel stacks above floating sphere");
  assert.ok(stylesSource.includes(".persistentOrionRoot :global(.persistentOrionButton)") && stylesSource.includes("z-index: 1;"), "Persistent Orion sphere remains below its panel");
  assert.ok(globalsSource.includes("--z-modal: 60;") && globalsSource.includes("--z-backdrop: 40;"), "Repository modal/dialog layer remains above Orion z-index scale");
  assert.ok(stylesSource.includes("touch-action: none;"), "touch-action is none on the visible control");
  assert.ok(stylesSource.includes(".persistentOrionRoot :global(.persistentOrionCanvas)") && stylesSource.includes("pointer-events: none;"), "decorative canvas does not intercept events");
  assert.ok(persistentSource.includes("position: \"fixed\""), "Orion panel uses fixed positioning for viewport-level rendering");
  assert.ok(!shellSource.includes("enterprise-shell overflow-hidden"), "No shell-level overflow clipping is introduced for the fixed Orion control");
  assert.ok(persistentSource.includes('right: "auto", bottom: "auto"'), "position styles are not overridden by right/bottom defaults");
  assert.ok(buttonSource.includes("onPointerDown={onPointerDown}") && buttonSource.includes("onPointerMove={onPointerMove}"), "pointer handlers are attached to the visible control");
  assert.ok(buttonSource.includes("aria-expanded={open}"), "Sphere-only control preserves aria-expanded");
  assert.ok(buttonSource.includes("aria-controls={panelId}"), "Sphere-only control preserves aria-controls");
  assert.ok(buttonSource.includes("aria-label={`Open Orion. Current state: ${stateLabel}. Workspace: ${fixture.workspace}.`}"), "Sphere-only control preserves complete accessible name");
  assert.ok(buttonSource.includes("onClick={onClick}"), "15. panel still opens on click");
  assert.ok(persistentSource.includes("if (suppressClickRef.current)") && persistentSource.includes("event.preventDefault();"), "16. panel does not open after drag");
  assert.ok(panelSource.includes("style={panelStyle}") && persistentSource.includes("setPanelStyle({ left, top, position: \"fixed\" })"), "17. panel positioning remains viewport-safe");
  assert.ok(buttonSource.includes("persistentOrionButtonMinimized") && persistentSource.includes("minimized"), "18. minimized Orion remains draggable");
  assert.ok(panelSource.includes("Prototype Intelligence"), "Panel includes Prototype Intelligence label");
  assert.ok(panelSource.includes("Fixture Data"), "Panel includes Fixture Data label");
  assert.ok(panelSource.includes("Open Orion Core Lab"), "Panel links to Orion Core Lab");
  assert.ok(panelSource.includes("Minimize Orion"), "Panel includes minimize action");
  assert.ok(panelSource.includes("Restore Orion"), "Panel includes restore action");

  assert.ok(sphereSource.includes("DESKTOP_PARTICLES = 184") && sphereSource.includes("MOBILE_PARTICLES = 124"), "Mini sphere particle density increased for larger control");
  assert.ok(!sphereSource.includes("const ringRadius =") && !sphereSource.includes("ctx.setLineDash([2, 2])"), "Mini sphere no longer renders outer boundary rings");
  assert.ok(!sphereSource.includes("const shadow = ctx.createRadialGradient(") && !sphereSource.includes("ctx.ellipse("), "Mini sphere no longer renders outer shadow shell");
  assert.ok(
    sphereSource.includes("rgba(248, 252, 255, 1)")
      && sphereSource.includes("ctx.createRadialGradient")
      && sphereSource.includes("rgba(250, 252, 255, 0.98)")
      && sphereSource.includes("corePulse"),
    "Mini sphere keeps a brighter and more defined intelligence core",
  );
  assert.ok(sphereSource.includes("requestAnimationFrame"), "Mini sphere uses requestAnimationFrame");
  assert.ok(sphereSource.includes("cancelAnimationFrame"), "Mini sphere cancels animation on cleanup");
  assert.ok(sphereSource.includes("ResizeObserver"), "Mini sphere includes ResizeObserver handling");
  assert.ok(sphereSource.includes("visibilitychange"), "Mini sphere handles hidden tab pause");
  assert.ok(sphereSource.includes("loopTokenRef"), "Mini sphere guards duplicate strict mode loops");

  const combined = `${persistentSource}\n${panelSource}\n${sphereSource}`;
  assert.ok(!combined.includes("@/lib/supabase"), "No Supabase imports in persistent Orion");
  assert.ok(!combined.includes("fetch("), "No network calls in persistent Orion");
  assert.ok(!combined.includes("openai"), "No OpenAI usage in persistent Orion");
  assert.ok(!combined.includes(".insert("), "No write operations in persistent Orion");
  assert.ok(!combined.includes(".update("), "No write operations in persistent Orion");
  assert.ok(!combined.includes(".delete("), "No write operations in persistent Orion");
  assert.ok(shellSource.includes("bangoos-sidebar"), "21. sidebar behavior remains unchanged");
}

testFixtureMapping();
testSourceSafetyContracts();
console.log("Persistent Orion fixture and shell contracts passed.");
