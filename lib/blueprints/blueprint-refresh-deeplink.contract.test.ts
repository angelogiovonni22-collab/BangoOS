import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";

const source = fs.readFileSync(path.resolve(process.cwd(), "components/plans/plans-preview.tsx"), "utf8");

assert.match(source, /useEffect\(\(\) => \{/);
assert.match(source, /url\.searchParams\.delete\("blueprintVersion"\)/);
assert.match(source, /url\.searchParams\.delete\("blueprintPage"\)/);
assert.match(source, /url\.searchParams\.delete\("blueprintAnnotation"\)/);
assert.match(source, /window\.history\.replaceState\(window\.history\.state/);
assert.match(source, /initialWorkspaceOpen && !deepLinkDismissed/);

console.log("Blueprint refresh deep-link consumption contract passed.");
