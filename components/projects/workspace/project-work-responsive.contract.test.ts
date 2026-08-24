import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const workspace = fs.readFileSync(path.resolve(process.cwd(), "components/projects/workspace/project-work-workspace.tsx"), "utf8");
const board = fs.readFileSync(path.resolve(process.cwd(), "components/projects/workspace/project-work-execution-board.tsx"), "utf8");

assert.ok(workspace.includes('xl:grid-cols-[240px_minmax(0,1fr)]'));
assert.ok(workspace.includes('min-[1800px]:grid-cols-[260px_minmax(640px,1fr)_320px]'));
assert.ok(workspace.includes('md:grid-cols-2 xl:col-span-2'));
assert.ok(!workspace.includes('xl:grid-cols-[280px_minmax(0,1fr)_340px]'));
assert.ok(board.includes('data-testid="execution-board-scroll-region"'));
assert.ok(board.includes('overflow-x-auto'));
assert.ok(board.includes('min-w-[1040px] grid-cols-4'));
assert.ok(!board.includes('lg:grid-cols-[minmax(0,1fr)_220px_220px]'));

console.log("+ Tasks workspace preserves readable board widths and responsive support-panel reflow");
