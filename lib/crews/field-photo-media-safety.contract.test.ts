import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root=process.cwd(),capture=readFileSync(resolve(root,"components/crews/field-photo-capture.tsx"),"utf8"),workspace=readFileSync(resolve(root,"components/crews/mobile-field-operations-workspace.tsx"),"utf8");
assert.match(capture,/MAX_PHOTO_BYTES = 20 \* 1024 \* 1024/);
assert.match(capture,/next\.type\.startsWith\("image\/"\)/);
assert.match(capture,/next\.size > MAX_PHOTO_BYTES/);
assert.match(capture,/finally \{/);
assert.match(capture,/inputRef\.current\.value = ""/);
assert.match(capture,/storage\.from\(BUCKET\)\.remove\(\[path\]\)/);
assert.match(workspace,/photos: \[\.\.\.current\.photos, photo\.fileName\]/);
assert.match(workspace,/photoIndex !== index/);
assert.match(workspace,/aria-label=\{`Remove \$\{photo\}`\}/);

console.log("Field photo media safety contract checks passed.");
