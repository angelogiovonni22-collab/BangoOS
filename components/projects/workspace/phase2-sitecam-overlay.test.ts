import fs from "node:fs";
import path from "node:path";

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
  const workSitecamPanel = read("components/projects/workspace/project-work-sitecam-panel.tsx");
  const sitecamWorkspace = read("app/(app)/projects/[id]/components/sitecam-workspace.tsx");

  await test("1. project workspace SiteCam uses nested shared dialogs", () => {
    assert(workSitecamPanel.includes("<Dialog"), "project workspace SiteCam viewer/edit use shared Dialog");
    assert(workSitecamPanel.includes("ariaLabel={t(\"projects.sitecamViewerTitle\")}"), "project workspace SiteCam viewer exposes accessible label");
    assert(workSitecamPanel.includes("ariaLabel={t(\"projects.workSitecamEditCaption\")}"), "project workspace SiteCam edit dialog exposes accessible label");
    assert(workSitecamPanel.indexOf("ariaLabel={t(\"projects.sitecamViewerTitle\")}") < workSitecamPanel.indexOf("ariaLabel={t(\"projects.workSitecamEditCaption\")}"), "edit dialog is rendered after viewer for nested stacking");
  });

  await test("2. document body overflow and arbitrary overlay z-indexes are removed from migrated SiteCam files", () => {
    assert(!workSitecamPanel.includes("document.body.style.overflow"), "project workspace SiteCam no longer mutates body overflow directly");
    assert(!sitecamWorkspace.includes("document.body.style.overflow"), "SiteCam workspace no longer mutates body overflow directly");
    assert(!workSitecamPanel.includes("z-50"), "project workspace SiteCam no longer uses hard-coded overlay z-index values");
    assert(!sitecamWorkspace.includes("DialogOverlay"), "SiteCam workspace no longer uses the custom DialogOverlay wrapper");
  });

  await test("3. topmost viewer/edit/delete behavior remains layered through shared primitives", () => {
    assert(sitecamWorkspace.includes("<Dialog"), "SiteCam workspace viewer/edit overlays use shared Dialog");
    assert(sitecamWorkspace.includes("<ConfirmDialog"), "SiteCam workspace delete confirmation remains on ConfirmDialog");
    assert(sitecamWorkspace.indexOf("<Dialog") < sitecamWorkspace.lastIndexOf("<ConfirmDialog"), "delete confirmation renders after viewer/edit dialogs for topmost stacking");
    assert(sitecamWorkspace.includes("ArrowLeft") && sitecamWorkspace.includes("ArrowRight"), "image navigation keyboard behavior remains in SiteCam workspace");
  });

  console.log(`\nSiteCam overlay Phase 2 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();