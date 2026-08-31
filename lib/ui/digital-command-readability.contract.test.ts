import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const layout = readFileSync(resolve(root, "app/layout.tsx"), "utf8");
const css = readFileSync(resolve(root, "app/digital-command-hardening.css"), "utf8");

assert.match(layout, /import "\.\/digital-command-hardening\.css"/, "Digital Command hardening must load globally");
assert.match(css, /\[data-theme="digital-command"\] \[data-bf-layer="dialog"\] \[role="dialog"\]/, "body-level dialogs need an owned dark surface");
assert.match(css, /\[data-bos-surface="light"\]/, "legacy light ownership contexts must be normalized");
assert.match(css, /select option/, "native dropdown choices need explicit colors");
assert.match(css, /\[role="menu"\][\s\S]*\[role="listbox"\]/, "custom menus and listboxes need a consistent surface");
assert.match(css, /::placeholder/, "form placeholders need explicit contrast");
assert.match(css, /:disabled/, "disabled controls must remain readable");
assert.match(css, /focus-visible/, "keyboard focus must remain visible");
assert.doesNotMatch(css, /opacity:\s*0\.[0-6]/, "readability hardening must not fade text or controls below a safe opacity");

console.log("digital-command readability contract passed");
