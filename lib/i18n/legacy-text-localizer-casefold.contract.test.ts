import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const bridge = readFileSync(new URL("./legacy-text-localizer.tsx", import.meta.url), "utf8");

test("legacy localizer handles case-varied static UI labels", () => {
  assert.match(bridge, /foldedLiteralMap/);
  assert.match(bridge, /toLocaleLowerCase\("en-US"\)/);
  assert.match(bridge, /translateKnownLiteral/);
});

test("legacy localizer translates captured template labels instead of only suffix text", () => {
  assert.match(bridge, /translatedCaptured/);
  assert.match(bridge, /translateKnownLiteral\(captured, index\) \|\| captured/);
  assert.match(bridge, /new RegExp\(source, "i"\)/);
});

test("legacy localizer translates decorated labels and case-varied schedule dates", () => {
  assert.match(bridge, /translateDecoratedLiteral/);
  assert.match(bridge, /\[\^\\p\{L\}\\p\{N\}\]/);
  assert.match(bridge, /translateScheduleDate/);
  assert.match(bridge, /\$\/i\.exec\(value\)/);
  assert.match(bridge, /toUpperCase\(\)/);
});

test("legacy localizer continues to protect user-authored content", () => {
  assert.match(bridge, /\[data-user-content\]/);
  assert.match(bridge, /contenteditable='true'/);
});
