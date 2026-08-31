import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const shell = readFileSync(resolve(root, "app/(app)/app-shell.tsx"), "utf8");
const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
const chrome = readFileSync(resolve(root, "app/sidebar-blue-chrome.css"), "utf8");

assert.match(shell, /data-sidebar-section-finish="blue-chrome"/, "every collapsible sidebar header should use the blue-chrome finish");
assert.match(shell, /active && href === "\/dashboard"/, "the active Dashboard link should receive the signature blue-chrome finish");
assert.match(shell, /data-sidebar-active-finish=\{blueChromeDashboard \? "blue-chrome"/, "Dashboard should expose the blue-chrome styling hook only while active");
assert.match(layout, /import "\.\/sidebar-blue-chrome\.css"/, "the blue-chrome layer should load globally");
assert.match(chrome, /linear-gradient\(180deg/, "blue chrome should include a dimensional vertical highlight stack");
assert.match(chrome, /prefers-reduced-motion: reduce/, "the navigation finish should respect reduced-motion preferences");
assert.doesNotMatch(shell, /data-sidebar-section-finish="chrome"/, "the former silver-chrome treatment should not remain in the sidebar shell");

console.log("sidebar blue-chrome contract passed");
