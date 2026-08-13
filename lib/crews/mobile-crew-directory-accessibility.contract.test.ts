import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const source = readFileSync(
  fileURLToPath(new URL("../../components/crews/mobile-field-operations-workspace.tsx", import.meta.url)),
  "utf8",
);

assert.match(source, /employee\.phone\?\.trim\(\) \|\| null/, "phone values should be normalized before contact actions are rendered");
assert.match(source, /aria-label={`Call \$\{employee\.employeeName\}`}/, "call actions need employee-specific accessible names");
assert.match(source, /aria-label={`Text \$\{employee\.employeeName\}`}/, "text actions need employee-specific accessible names");
assert.match(source, /No phone number for/, "missing phone numbers should render a named disabled state");
assert.doesNotMatch(source, /const callHref = .*: "#"/, "unavailable call actions must not navigate to a placeholder anchor");
assert.doesNotMatch(source, /const textHref = .*: "#"/, "unavailable text actions must not navigate to a placeholder anchor");

console.log("mobile crew directory accessibility contract passed");
