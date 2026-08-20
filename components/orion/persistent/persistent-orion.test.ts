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
  const portalHostSource = read("components/ui/portal-host.tsx");

  assert.ok(shellSource.includes("<PersistentOrion onOpenCommandCenter="), "App shell mounts PersistentOrion as the visible Orion entry point");
  const mountMatches = shellSource.match(/<PersistentOrion\s/g) ?? [];
  assert.equal(mountMatches.length, 1, "PersistentOrion mount count should remain one");
  assert.ok(!shellSource.includes('aria-label="Open Orion Command Center"'), "Top-bar Orion command-center button is removed");
  assert.ok(shellSource.includes("<div className=\"flex min-h-screen min-w-0\">"), "App shell retains stable root child structure");
  assert.ok(shellSource.includes("<LayerManager layer=\"backdrop\">"), "Sidebar uses navigation-safe backdrop layer instead of dialog/modal layer");
  assert.ok(shellSource.includes("<LayerManager layer=\"popover\">"), "Sidebar navigation uses popover layer instead of modal dialog layer");
  assert.ok(shellSource.includes("id=\"bangoos-sidebar\""), "Sidebar structure remains unchanged");

  assert.ok(persistentSource.includes("usePathname"), "Persistent Orion uses pathname for workspace context");
  assert.ok(persistentSource.includes("useMotionPreferences"), "Persistent Orion consumes motion preference");
  assert.ok(persistentSource.includes("<PortalHost>"), "Persistent Orion renders in a body-level portal host");
  assert.ok(persistentSource.includes("<LayerManager layer=\"orionPersistent\">"), "Persistent Orion uses dedicated layer token");
  assert.ok(persistentSource.includes("onOpenCommandCenter();"), "Persistent Orion routes advanced access into the existing command center");
  assert.ok(portalHostSource.includes("useSyncExternalStore") && portalHostSource.includes("getServerMountedSnapshot") && portalHostSource.includes("if (!mounted) {") && portalHostSource.includes("return null;"), "PortalHost defers portal activation until after hydration so SSR and first client render match");
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
  assert.ok(persistentSource.includes("useState<FloatingPosition>(SSR_SAFE_DEFAULT_POSITION)"), "11b. hydration-safe initial position is deterministic for server and first client render");
  assert.ok(persistentSource.includes("const stored = readStoredPosition();") && persistentSource.includes("setPosition(next);"), "11c. stored browser position is restored after mount");
  assert.ok(persistentSource.includes("event.key === \"ArrowLeft\"") && persistentSource.includes("event.key === \"ArrowDown\""), "12. keyboard arrow repositioning exists");
  assert.ok(persistentSource.includes("const step = event.shiftKey ? 24 : 12"), "13. Shift + Arrow larger movement exists");
  assert.ok(buttonSource.includes("aria-describedby={instructionsId}") && persistentSource.includes("Drag Orion to reposition it. Use arrow keys when focused."), "14. accessible drag instructions exist");
  assert.ok(stylesSource.includes(".persistentOrionRoot {") && stylesSource.includes("pointer-events: auto;"), "interactive wrapper has pointer-events enabled");
  assert.ok(
    stylesSource.includes("z-index: var(--z-orion-persistent, 46);")
      || stylesSource.includes("z-index: var(--z-orion-persistent);"),
    "Persistent Orion root uses dedicated z-orion-persistent layer",
  );
  assert.ok(stylesSource.includes(".persistentOrionRoot :global(.persistentOrionPanel)") && stylesSource.includes("z-index: 2;"), "Persistent Orion panel stacks above floating sphere");
  assert.ok(stylesSource.includes(".persistentOrionRoot :global(.persistentOrionButton)") && stylesSource.includes("z-index: 1;"), "Persistent Orion sphere remains below its panel");
  assert.ok(globalsSource.includes("--z-modal: 60;") && globalsSource.includes("--z-backdrop: 40;") && globalsSource.includes("--z-orion-persistent: 46;"), "Repository layer scale includes dedicated persistent Orion token below modal dialogs");
  assert.ok(stylesSource.includes("touch-action: none;"), "touch-action is none on the visible control");
  assert.ok(stylesSource.includes(".persistentOrionRoot :global(.persistentOrionCanvas)") && stylesSource.includes("pointer-events: none;"), "decorative canvas does not intercept events");
  assert.ok(persistentSource.includes("position: \"fixed\""), "Orion panel uses fixed positioning for viewport-level rendering");
  assert.ok(!shellSource.includes("enterprise-shell overflow-hidden"), "No shell-level overflow clipping is introduced for the fixed Orion control");
  assert.ok(persistentSource.includes('right: "auto", bottom: "auto"'), "position styles are not overridden by right/bottom defaults");
  assert.ok(buttonSource.includes("onPointerDown={onPointerDown}") && buttonSource.includes("onPointerMove={onPointerMove}"), "pointer handlers are attached to the visible control");
  assert.ok(buttonSource.includes("aria-expanded={open}"), "Sphere-only control preserves aria-expanded");
  assert.ok(buttonSource.includes("aria-controls={panelId}"), "Sphere-only control preserves aria-controls");
  assert.ok(buttonSource.includes("aria-label={`Open Orion. Current state: ${stateLabel}. Voice phase: ${voicePhase}. Microphone ${micActive ? \"on\" : \"off\"}. Workspace: ${fixture.workspace}.`}"), "Sphere-only control preserves complete accessible name");
  assert.ok(buttonSource.includes("onClick={onClick}"), "15. panel still opens on click");
  assert.ok(!buttonSource.includes("absolute right-2 top-2"), "16. no decorative top-right dot is rendered on the Orion sphere control");
  assert.ok(persistentSource.includes("if (suppressClickRef.current)") && persistentSource.includes("event.preventDefault();"), "17. panel does not open after drag");
  assert.ok(panelSource.includes("style={panelStyle}") && persistentSource.includes("setPanelStyle({ left, top, position: \"fixed\" })"), "18. panel positioning remains viewport-safe");
  assert.ok(buttonSource.includes("persistentOrionButtonMinimized") && persistentSource.includes("minimized"), "19. minimized Orion remains draggable");
  assert.ok(!panelSource.includes("Prototype Intelligence"), "Prototype Intelligence label is not exposed in production Orion");
  assert.ok(!panelSource.includes("Fixture Data"), "Fixture Data label is not exposed in production Orion");
  assert.ok(!panelSource.includes("Open Orion Core Lab"), "Core Lab is not the primary production Orion action");
  assert.ok(!panelSource.includes("ORION V2"), "Version label is not exposed in the production panel");
  assert.ok(!panelSource.includes("Engine: ORION V2"), "Engine implementation label is not exposed in production Orion");
  assert.ok(panelSource.includes("Open Advanced Orion"), "Panel exposes the preserved command center as Advanced Orion");
  assert.ok(panelSource.includes("Minimize Orion"), "Panel includes minimize action");
  assert.ok(panelSource.includes("Restore Orion"), "Panel includes restore action");

  assert.ok(sphereSource.includes("DESKTOP_PARTICLES = 184") && sphereSource.includes("MOBILE_PARTICLES = 124"), "Mini sphere particle density increased for larger control");
  assert.ok(sphereSource.includes("const ringRadius =") && sphereSource.includes("state === \"listening\" || state === \"speaking\""), "Mini sphere renders state-aware outer pulse rings for listening/speaking without legacy dashed rings");
  assert.ok(!sphereSource.includes("ctx.setLineDash([2, 2])"), "Mini sphere does not use legacy dashed ring rendering");
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
  assert.ok(!combined.includes("openai"), "No OpenAI branding or direct usage in persistent Orion");
  assert.ok(!combined.includes(".insert("), "No write operations in persistent Orion");
  assert.ok(!combined.includes(".update("), "No write operations in persistent Orion");
  assert.ok(!combined.includes(".delete("), "No write operations in persistent Orion");
  assert.ok(shellSource.includes("bangoos-sidebar"), "21. sidebar behavior remains unchanged");
}

testFixtureMapping();
testSourceSafetyContracts();
console.log("Persistent Orion fixture and shell contracts passed.");
