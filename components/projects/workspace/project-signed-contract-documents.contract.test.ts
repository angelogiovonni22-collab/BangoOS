import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

const workspacePath = path.join(process.cwd(), "components/projects/workspace/project-documents-workspace.tsx");
const source = fs.readFileSync(workspacePath, "utf8");

test("project documents surfaces verified customer-signed contracts", () => {
  assert.match(source, /Contracts &amp; Agreements/);
  assert.match(source, /estimate_signatures/);
  assert.match(source, /verification_result/);
  assert.match(source, /View Signed Contract/);
  assert.match(source, /Operational scope edits never overwrite these signed records/);
});
