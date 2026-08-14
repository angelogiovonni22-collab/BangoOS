import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const button = read("components/orion/persistent/PersistentOrionButton.tsx");
  const persistent = read("components/orion/persistent/PersistentOrion.tsx");
  const depthTokens = read("components/bangoflow/DepthTokens.ts");
  const shell = read("app/(app)/app-shell.tsx");
  const globals = read("app/globals.css");

  assert.ok(!button.includes("absolute right-2 top-2 inline-flex h-2.5 w-2.5 rounded-full"), "No top-right decorative/status dot remains on sphere button");
  assert.ok(button.includes("PersistentOrionMiniSphere state={sphereState}"), "Sphere uses canonical mapped state instead of fixture state");
  assert.ok(persistent.includes("<PortalHost>") && persistent.includes("<LayerManager layer=\"orionPersistent\">"), "Persistent Orion renders inside portal and dedicated layer manager");
  assert.ok(depthTokens.includes("orionPersistent") && depthTokens.includes("var(--z-orion-persistent)"), "Depth token includes explicit persistent Orion layer");
  assert.ok(shell.includes("<LayerManager layer=\"popover\">"), "Sidebar uses popover layer for expected stacking below persistent Orion");
  assert.ok(globals.includes("--z-orion-persistent: 46;") && globals.includes("--z-modal: 60;"), "Layer ordering keeps modal dialogs above persistent Orion");

  console.log("Phase 10A Orion layering and dot-removal contracts passed.");
}

main();
