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
  const projectWorkspace = read("components/projects/workspace/project-work-workspace.tsx");
  const sitecamWorkspace = read("app/(app)/projects/[id]/components/sitecam-workspace.tsx");
  const nodeInspector = read("components/business-graph/NodeInspector.tsx");

  await test("1. project task details render through shared mobile bottom sheet", () => {
    assert(projectWorkspace.includes("<BottomSheet"), "project workspace imports shared bottom sheet");
    assert(projectWorkspace.includes("ariaLabel={taskDetailsLabels.title}"), "task details sheet exposes accessible title");
    assert(projectWorkspace.includes("backdropLabel={taskDetailsLabels.close}"), "task details sheet exposes close label for backdrop");
  });

  await test("2. project SiteCam delete flow uses shared confirmation dialog", () => {
    assert(sitecamWorkspace.includes("<ConfirmDialog"), "SiteCam delete flow uses shared confirm dialog");
    assert(sitecamWorkspace.includes("<PermissionState"), "SiteCam permission failures use shared permission state");
    assert(!sitecamWorkspace.includes('setDeletingPhotoId(null);\n      setEditingPhotoId(null);\n      setDeletingPhotoId(null);'), "legacy stacked Escape close block was removed");
  });

  await test("3. drawer primitive is exercised in a real consumer", () => {
    assert(nodeInspector.includes("<Drawer"), "node inspector uses shared drawer primitive");
    assert(nodeInspector.includes("showBackdrop={false}"), "node inspector can stay specialized without forced backdrop");
    assert(nodeInspector.includes("lockBodyScroll={false}"), "node inspector opts out of body lock when needed");
  });

  console.log(`\nProject workspace overlay results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();