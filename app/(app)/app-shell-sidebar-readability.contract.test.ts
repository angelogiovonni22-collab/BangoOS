import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(app)/app-shell.tsx", "utf8");
const sidebarItem = source.slice(source.indexOf("function SidebarItem"), source.indexOf("function AccessRedirect"));

assert.match(sidebarItem, /min-h-11/, "sidebar links must provide a larger click target");
assert.match(sidebarItem, /text-\[15px\]/, "sidebar link labels must remain readable in the compact desktop rail");
assert.doesNotMatch(sidebarItem, /icon/, "sidebar links must not render decorative icons beside their labels");
assert.doesNotMatch(sidebarItem, /compact/, "sidebar readability must not be reduced by a compact item variant");
assert.match(source, /text-xs font-bold uppercase/, "sidebar section labels must remain readable");

console.log("App shell sidebar readability contract passed.");
