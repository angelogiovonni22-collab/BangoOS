import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("components/projects/workspace/project-tabs.tsx", "utf8");

assert.match(source, /createPortal\([\s\S]*document\.body/, "More menu must escape project stacking contexts");
assert.match(source, /z-\[2147483647\]/, "More menu must render above workspace cards");
assert.match(source, /aria-haspopup="menu"/, "More trigger must expose menu semantics");
assert.match(source, /aria-controls=\{moreMenuId\}/, "More trigger must identify the controlled menu");
assert.match(source, /role="menu"/, "More popup must expose menu role");
assert.match(source, /role="menuitem"/, "More actions must expose menuitem role");
assert.match(source, /event\.key !== "Escape"/, "More menu must close with Escape");

console.log("Project tabs layering contract passed.");
