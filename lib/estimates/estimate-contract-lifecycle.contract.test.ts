import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("customer contract portal requires explicit signature consent", () => {
  const page = read("app/contracts/estimate/[token]/page.tsx");
  assert.match(page, /Full legal name/);
  assert.match(page, /consent to use my typed name/);
  assert.match(page, /disabled=\{submitting \|\| !typedName\.trim\(\) \|\| !consent\}/);
});

test("secure estimate signing finalizes without a second email verification", () => {
  const submit = read("app/api/contracts/estimate/[token]/route.ts");
  const page = read("app/contracts/estimate/[token]/page.tsx");
  assert.doesNotMatch(submit, /estimate_contract_verifications/);
  assert.doesNotMatch(submit, /verificationToken/);
  assert.match(submit, /verification_method: "secure_email_link"/);
  assert.match(submit, /verification_result: "verified"/);
  assert.match(submit, /convert_verified_estimate_contract/);
  assert.match(submit, /finalized: true/);
  assert.match(page, /Estimate signed/);
  assert.doesNotMatch(page, /select the verification link/);
});

test("database conversion is company-scoped, locked, idempotent, and service-only", () => {
  const sql = read("supabase/migrations/20260811150000_estimate_contract_verification.sql");
  assert.match(sql, /pg_advisory_xact_lock/);
  assert.match(sql, /select converted_project_id into v_existing/);
  assert.match(sql, /v_existing is not null/);
  assert.match(sql, /Verified signature required/);
  assert.match(sql, /grant execute .* to service_role/i);
  assert.match(sql, /revoke all .* from public,anon,authenticated/i);
});

test("internal estimate detail exposes an Orion-visible contract action", () => {
  assert.match(read("components/estimates/send-contract-button.tsx"), /data-orion-action="estimate\.send-contract"/);
  assert.match(read("components/estimates/estimate-detail.tsx"), /SendContractButton/);
});
