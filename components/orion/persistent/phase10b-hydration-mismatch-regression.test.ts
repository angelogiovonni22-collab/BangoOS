import fs from "node:fs";
import path from "node:path";

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

function main() {
  const appShell = read("app/(app)/app-shell.tsx");
  const persistent = read("components/orion/persistent/PersistentOrion.tsx");
  const button = read("components/orion/persistent/PersistentOrionButton.tsx");
  const portalHost = read("components/ui/portal-host.tsx");
  const layerManager = read("components/bangoflow/LayerManager.tsx");
  const depthTokens = read("components/bangoflow/DepthTokens.ts");

  test("1. app shell child order is stable", () => {
    assert(appShell.includes("<PersistentOrion />"), "persistent Orion mount remains in app shell");
    assert(appShell.includes("<div className=\"flex min-h-screen min-w-0\">"), "shell main frame remains deterministic sibling after PersistentOrion");
  });

  test("2. portal activation is deferred until mount", () => {
    assert(portalHost.includes("useSyncExternalStore"), "PortalHost tracks mounted hydration snapshot");
    assert(portalHost.includes("getClientMountedSnapshot") && portalHost.includes("getServerMountedSnapshot"), "PortalHost defines client/server mounted snapshots");
    assert(portalHost.includes("if (!mounted) {") && portalHost.includes("return null;"), "PortalHost returns null during SSR and first client render");
  });

  test("3. persistent Orion layer wrapper remains deterministic", () => {
    assert(persistent.includes("<PortalHost>"), "PersistentOrion still uses shared PortalHost");
    assert(persistent.includes("<LayerManager layer=\"orionPersistent\">"), "PersistentOrion keeps dedicated Orion layer manager");
    assert(layerManager.includes("data-bf-layer={layer}"), "LayerManager still writes deterministic layer attribute");
    assert(depthTokens.includes("return `relative z-[${DEPTH_TOKENS[layer]}]`;"), "depth class resolution remains deterministic");
  });

  test("4. persistent Orion button root remains deterministic", () => {
    assert(button.includes("className={[") && button.includes("persistentOrionButton") && button.includes("persistentOrionButtonDragging") && button.includes("persistentOrionButtonMinimized"), "button root keeps deterministic class composition");
    assert(button.includes("aria-expanded={open}") && button.includes("aria-controls={panelId}"), "button root accessibility attributes remain stable");
    assert(!button.includes("Date.now(") && !button.includes("Math.random("), "button render path has no random values");
  });

  test("5. render-time portal path avoids window-dependent branching", () => {
    const portalOnlyBranching = portalHost.includes("if (!mounted)") && portalHost.includes("resolvePortalContainer(container)");
    assert(portalOnlyBranching, "PortalHost uses mount gate before touching portal container");
  });

  console.log(`\nPhase 10B hydration mismatch regression results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

main();
