import fs from "node:fs";
import path from "node:path";
import { resolveCameraClassName } from "../../components/bangoflow/CameraController";
import { resolveLayerClassName } from "../../components/bangoflow/LayerManager";
import { deriveSpatialRouteState } from "../../components/bangoflow/SpatialNavigationProvider";
import { resolveWorkspaceTransitionClassName } from "../../components/bangoflow/WorkspaceTransition";

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

async function main(): Promise<void> {
  const appShell = read("app/(app)/app-shell.tsx");
  const globals = read("app/globals.css");
  const spatialProvider = read("components/bangoflow/SpatialNavigationProvider.tsx");
  const cameraController = read("components/bangoflow/CameraController.tsx");
  const spatialCssBlock = [
    ".bf-spatial-shell",
    ".bf-camera-controller",
    ".bf-camera-mission-control",
    ".bf-camera-module",
    ".bf-camera-workspace",
    ".bf-shared-surface",
    ".bf-workspace-transition",
  ].map((token) => extractCssBlock(globals, token)).join("\n");

  await test("1. Route classification supports mission control and workspaces", () => {
    const dashboard = deriveSpatialRouteState("/dashboard");
    assert(dashboard.surfaceKind === "mission-control", "dashboard maps to mission-control surface");
    assert(dashboard.department === "dashboard", "dashboard maps to dashboard department");

    const project = deriveSpatialRouteState("/projects/abc123");
    assert(project.surfaceKind === "workspace", "project detail maps to workspace surface");
    assert(project.department === "operations", "project detail remains in operations department");
    assert(project.breadcrumbs.some((item) => item.label === "Workspace"), "project detail breadcrumb includes workspace label");
  });

  await test("2. Layer system assigns higher dialog depth", () => {
    assert(resolveLayerClassName("dialog").includes("z-[var(--z-modal)]"), "dialog layer resolves to modal depth");
    assert(resolveLayerClassName("overlay").includes("z-[var(--z-overlay)]"), "overlay layer resolves to overlay depth");
  });

  await test("3. Camera behavior is event-driven and reduced-motion aware", () => {
    assert(resolveCameraClassName("workspace", false).includes("bf-camera-workspace"), "workspace camera class is applied");
    assert(resolveCameraClassName("module", true).includes("bf-no-motion"), "reduced-motion camera class disables motion");
    assert(!cameraController.includes("setInterval("), "camera controller introduces no looping animation");
  });

  await test("4. Continuous transitions are shell-driven", () => {
    assert(appShell.includes("SpatialNavigationProvider"), "app shell installs spatial navigation provider");
    assert(appShell.includes("ProjectEntranceTransition"), "project routes use project entrance transition");
    assert(appShell.includes("ModuleTransition"), "module routes use module transition");
    assert(resolveWorkspaceTransitionClassName("mission-control").includes("mission-control"), "transition class encodes mission-control surface");
  });

  await test("5. Spatial styling avoids continuous animation", () => {
    assert(globals.includes(".bf-camera-controller"), "global styles define camera controller transitions");
    assert(globals.includes("prefers-reduced-motion"), "global styles respect reduced-motion preferences");
    assert(!spatialCssBlock.includes("infinite"), "spatial styles do not use infinite looping animations");
    assert(!spatialProvider.toLowerCase().includes("autonomous"), "spatial provider adds no autonomous behavior");
  });

  console.log(`\nBangoFlow Phase 3 spatial navigation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

function extractCssBlock(source: string, selector: string) {
  const index = source.indexOf(selector);
  if (index < 0) {
    return "";
  }

  return source.slice(index, Math.min(source.length, index + 320));
}

void main();