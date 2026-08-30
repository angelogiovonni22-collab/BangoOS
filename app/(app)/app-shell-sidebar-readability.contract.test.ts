import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync("app/(app)/app-shell.tsx", "utf8");
const sidebarItem = source.slice(source.indexOf("function SidebarItem"), source.indexOf("function AccessRedirect"));

assert.match(sidebarItem, /min-h-11/, "sidebar links must provide a larger click target");
assert.match(sidebarItem, /text-\[15px\]/, "sidebar link labels must remain readable in the compact desktop rail");
assert.doesNotMatch(sidebarItem, /icon/, "sidebar links must not render decorative icons beside their labels");
assert.doesNotMatch(sidebarItem, /compact/, "sidebar readability must not be reduced by a compact item variant");
assert.match(source, /text-xs font-extrabold uppercase/, "sidebar section labels must remain readable");
assert.match(source, /data-sidebar-section-finish="chrome"/, "sidebar group headers must expose the approved chrome finish");
assert.match(source, /linear-gradient\(180deg,#f8fafc_0%,#aeb7c3_24%,#eef2f7_49%,#8d97a5_73%,#dce3eb_100%\)/, "chrome headers must use a multi-stop metallic highlight and shadow gradient");

console.log("App shell sidebar readability contract passed.");
