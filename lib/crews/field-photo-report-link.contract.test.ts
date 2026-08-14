import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const capture = readFileSync(resolve(root, "components/crews/field-photo-capture.tsx"), "utf8");
const workspace = readFileSync(resolve(root, "components/crews/mobile-field-operations-workspace.tsx"), "utf8");

assert.match(capture, /onUploaded\(\{ id: photoId, fileName: file\.name, category \}\)/);
assert.match(capture, /uploaded and attached to the daily report/);
assert.match(workspace, /const attachFieldPhoto = async/);
assert.match(workspace, /photos: \[\.\.\.current\.photos, photo\.fileName\]/);
assert.match(workspace, /onUploaded=\{attachFieldPhoto\}/);
assert.match(workspace, /Attached field photos/);
assert.doesNotMatch(workspace, /comma separated filenames/);

console.log("Field photo daily report linkage contract checks passed.");
