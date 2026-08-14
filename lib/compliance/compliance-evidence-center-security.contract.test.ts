import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260814181000_compliance_evidence_center_security.sql", import.meta.url),
  "utf8",
);

test("Phase 7 evidence center is unavailable to anonymous callers", () => {
  assert.match(migration, /revoke all on public\.compliance_evidence_center from anon/i);
  assert.match(migration, /revoke all on public\.compliance_evidence_center from public/i);
  assert.match(migration, /grant select on public\.compliance_evidence_center to authenticated/i);
});

test("Phase 7 evidence RPC is authenticated-only", () => {
  assert.match(migration, /revoke all on function public\.get_compliance_evidence_center\(uuid, uuid, uuid, integer\) from public/i);
  assert.match(migration, /revoke all on function public\.get_compliance_evidence_center\(uuid, uuid, uuid, integer\) from anon/i);
  assert.match(migration, /grant execute on function public\.get_compliance_evidence_center\(uuid, uuid, uuid, integer\) to authenticated/i);
});
