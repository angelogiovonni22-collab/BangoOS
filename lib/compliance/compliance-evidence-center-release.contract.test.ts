import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  scripts?: Record<string, string>;
};

const check = packageJson.scripts?.check || "";

test("repository check permanently includes Phase 7 evidence validation", () => {
  assert.match(check, /compliance-evidence-center\.contract\.test\.ts/);
  assert.match(check, /compliance-evidence-center-security\.contract\.test\.ts/);
  assert.match(check, /npm run build$/);
});
