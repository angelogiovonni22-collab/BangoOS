import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(process.cwd(), "components/crews/field-photo-capture.tsx"), "utf8");
assert.match(source, /uploadInFlightRef = useRef\(false\)/);
assert.match(source, /uploadInFlightRef\.current\) return/);
assert.match(source, /uploadInFlightRef\.current = true/);
assert.match(source, /uploadInFlightRef\.current = false/);
assert.match(source, /\}, \[projectId\]\)/);
assert.match(source, /inputRef\.current\.value = ""/);

console.log("Field photo upload reliability contract checks passed.");
