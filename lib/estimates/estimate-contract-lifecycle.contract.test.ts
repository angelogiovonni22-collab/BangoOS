import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("customer contract portal requires explicit signature consent", () => {
  const page = read("app/contracts/estimate/[token]/page.tsx");
  assert.match(page, /Full legal name/);
  assert.match(page, /consent to use my typed name/);
  assert.match(page, /disabled=\{submitting \|\| !typedName\.trim\(\) \|\| !consent\}/);
  assert.match(page, /Accept & Sign/);
});

test("public contract experience is branded and complete", () => {
  const page = read("app/contracts/estimate/[token]/page.tsx");
  assert.match(page, /Built Different\./);
  assert.match(page, /Estimate & Construction Agreement/);
  assert.match(page, /Prepared for/);
  assert.match(page, /Project address/);
  assert.match(page, /scope_inclusions/);
  assert.match(page, /scope_exclusions/);
  assert.match(page, /Contract total/);
  assert.match(page, /Construction Agreement/);
  assert.match(page, /One-step acceptance & electronic signature/);
  assert.match(page, /B\.O\.S\. provides the secure document and electronic-signature workflow and is not a party/);
});

test("secure estimate signing finalizes without a second email verification", () => {
  const submit = read("app/api/contracts/estimate/[token]/route.ts");
  const page = read("app/contracts/estimate/[token]/page.tsx");
  assert.doesNotMatch(submit, /estimate_contract_verifications/);
  assert.doesNotMatch(submit, /verificationToken/);
  assert.match(submit, /verification_method: "secure_contract_link"/);
  assert.match(submit, /verification_result: "verified"/);
  assert.match(submit, /convert_verified_estimate_contract/);
  assert.match(submit, /finalized: true/);
  assert.match(page, /Estimate signed/);
  assert.match(page, /No second verification is required/);
  assert.doesNotMatch(page, /select the verification link/);
});

test("signature response exposes created project and immutable evidence", () => {
  const submit = read("app/api/contracts/estimate/[token]/route.ts");
  assert.match(submit, /projectId/);
  assert.match(submit, /contractPackageVersion/);
  assert.match(submit, /contractPackageHash/);
  assert.match(submit, /agreementHash/);
  assert.match(submit, /idempotencyKey/);
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
