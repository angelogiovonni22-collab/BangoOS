import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260814200000_counsel_review_workflow.sql", import.meta.url),
  "utf8",
);
const evidenceMigration = readFileSync(
  new URL("../../supabase/migrations/20260814201000_counsel_review_evidence_center.sql", import.meta.url),
  "utf8",
);
const service = readFileSync(new URL("./counsel-review-service.ts", import.meta.url), "utf8");
const evidenceService = readFileSync(new URL("./compliance-evidence-center-service.ts", import.meta.url), "utf8");
const boundary = readFileSync(new URL("../../docs/compliance/LEGAL_REVIEW_BOUNDARY.md", import.meta.url), "utf8");

test("Phase 9 preserves reviewer identity scope timestamp and disposition", () => {
  assert.match(migration, /review_scope text not null/);
  assert.match(migration, /disposition text not null/);
  assert.match(migration, /reviewer_name text not null/);
  assert.match(migration, /reviewer_organization text/);
  assert.match(migration, /reviewer_capacity text not null/);
  assert.match(migration, /reviewed_at timestamptz not null/);
  assert.match(migration, /ruleset_id text not null/);
  assert.match(migration, /ruleset_version text not null/);
});

test("only owner or administrator may record a counsel review", () => {
  assert.match(migration, /cm\.role in \('owner','administrator'\)/);
  assert.match(migration, /COUNSEL_REVIEW_AUTHORIZATION_REQUIRED/);
  assert.match(migration, /auth\.uid\(\)/);
});

test("counsel review evidence is append-only", () => {
  assert.match(migration, /create table if not exists public\.compliance_counsel_reviews/);
  assert.match(migration, /for select\s+to authenticated/i);
  assert.doesNotMatch(migration, /for update\s+to authenticated/i);
  assert.doesNotMatch(migration, /for delete\s+to authenticated/i);
  assert.doesNotMatch(migration, /for insert\s+to authenticated/i);
});

test("review records snapshot jurisdiction-pack identity", () => {
  assert.match(migration, /jurisdiction_pack_id text not null references public\.compliance_jurisdiction_packs/);
  assert.match(migration, /v_pack\.ruleset_id/);
  assert.match(migration, /v_pack\.ruleset_version/);
});

test("review dispositions do not create an override channel", () => {
  assert.match(boundary, /must not silently override deterministic hard blocks/i);
  assert.doesNotMatch(migration, /update\s+public\.estimate_contract_compliance_evaluations/i);
  assert.doesNotMatch(migration, /update\s+public\.operational_work_start_authorizations/i);
  assert.doesNotMatch(migration, /assert_operational.*override/i);
});

test("the recording RPC is authenticated-only and server-authorized", () => {
  assert.match(migration, /security definer/i);
  assert.match(migration, /revoke all on function public\.record_compliance_counsel_review[\s\S]*from public/i);
  assert.match(migration, /revoke all on function public\.record_compliance_counsel_review[\s\S]*from anon/i);
  assert.match(migration, /grant execute on function public\.record_compliance_counsel_review[\s\S]*to authenticated/i);
});

test("UI API and Orion share one counsel-review service contract", () => {
  assert.match(service, /record_compliance_counsel_review/);
  assert.match(service, /recordCounselReview/);
  assert.match(service, /listCounselReviews/);
  assert.match(service, /jurisdictionPackId/);
  assert.match(service, /reviewerCapacity/);
});

test("counsel-review dispositions remain descriptive rather than operational permissions", () => {
  assert.match(migration, /NO_OBJECTION/);
  assert.match(migration, /CHANGES_REQUIRED/);
  assert.match(migration, /ADVISORY_ONLY/);
  assert.doesNotMatch(migration, /ALLOWED_BY_COUNSEL/);
  assert.doesNotMatch(migration, /OVERRIDE/);
});

test("counsel reviews flow into the unified evidence center", () => {
  assert.match(evidenceMigration, /'counsel_review'::text as evidence_domain/);
  assert.match(evidenceMigration, /from public\.compliance_counsel_reviews r/);
  assert.match(evidenceMigration, /r\.jurisdiction_pack_id/);
  assert.match(evidenceMigration, /r\.ruleset_version/);
  assert.match(evidenceService, /"counsel_review"/);
});
