import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260814180000_compliance_evidence_center.sql", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./compliance-evidence-center-service.ts", import.meta.url), "utf8");

test("Phase 7 unifies existing evidence without copying authoritative records", () => {
  assert.match(migration, /create or replace view public\.compliance_evidence_center/);
  assert.match(migration, /from public\.estimate_home_solicitation_events e/);
  assert.match(migration, /from public\.operational_work_start_authorizations a/);
  assert.doesNotMatch(migration, /create table if not exists public\.compliance_evidence_center/);
});

test("evidence center preserves provenance and operational blocker data", () => {
  assert.match(migration, /e\.event_type as evidence_type/);
  assert.match(migration, /a\.decision/);
  assert.match(migration, /a\.blocker_code/);
  assert.match(migration, /actor_profile_id/);
  assert.match(migration, /metadata/);
});

test("evidence center remains read-only and relies on source RLS", () => {
  assert.match(migration, /with \(security_invoker = true\)/);
  assert.match(migration, /grant select on public\.compliance_evidence_center to authenticated/);
  assert.doesNotMatch(migration, /grant (insert|update|delete) on public\.compliance_evidence_center/i);
});

test("evidence RPC scopes by company and supports project and estimate filters", () => {
  assert.match(migration, /p_company_id uuid/);
  assert.match(migration, /c\.company_id = p_company_id/);
  assert.match(migration, /p_project_id is null or c\.project_id = p_project_id/);
  assert.match(migration, /p_estimate_id is null or c\.estimate_id = p_estimate_id/);
  assert.match(migration, /limit least\(greatest\(coalesce\(p_limit, 100\), 1\), 500\)/);
});

test("shared service gives UI API and Orion one evidence query contract", () => {
  assert.match(service, /get_compliance_evidence_center/);
  assert.match(service, /listComplianceEvidence/);
  assert.match(service, /summarizeComplianceEvidence/);
  assert.match(service, /evidenceDomain/);
  assert.match(service, /blockerCode/);
});
