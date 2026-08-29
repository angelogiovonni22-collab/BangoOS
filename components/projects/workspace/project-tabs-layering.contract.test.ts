import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/projects/workspace/project-tabs.tsx", "utf8");

assert.match(source, /items\.map\(\(item\)/, "every project tab must render in the visible navigation");
assert.match(source, /overflow-x-auto/, "the full tab row must remain usable at narrow widths");
assert.doesNotMatch(source, /workspace-tab-more/, "project navigation must not hide tabs behind More");
assert.doesNotMatch(source, /createPortal/, "project navigation no longer needs a popup layer");

console.log("Project tabs visible-navigation contract passed.");
