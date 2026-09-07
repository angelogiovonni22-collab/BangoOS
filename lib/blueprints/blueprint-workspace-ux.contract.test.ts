import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const read = (relativePath: string) => fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");

const workspace = read("components/plans/blueprint-plan-workspace.tsx");
const viewer = read("components/plans/blueprint-2d-viewer.tsx");

assert.match(workspace, /overflow-y-auto/);
assert.match(workspace, /overscroll-contain/);
assert.match(workspace, /min-h-\[36rem\]/);
assert.match(viewer, /TRACKPAD_ZOOM_STEP = 5/);
assert.match(viewer, /TRACKPAD_ZOOM_THROTTLE_MS = 70/);
assert.match(viewer, /lastTrackpadZoomAtRef/);

console.log("Blueprint workspace scroll and trackpad zoom UX contract passed.");
