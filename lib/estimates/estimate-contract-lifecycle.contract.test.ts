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
  const atomicSql = read("supabase/migrations/20260819018000_contract_token_revision_and_atomic_finalization.sql");
  const page = read("app/contracts/estimate/[token]/page.tsx");
  assert.doesNotMatch(submit, /estimate_contract_verifications/);
  assert.doesNotMatch(submit, /verificationToken/);
  assert.match(submit, /verification_method: "secure_contract_link"/);
  assert.match(submit, /finalize_verified_estimate_contract_signature/);
  assert.match(atomicSql, /verification_result = 'verified'/);
  assert.match(atomicSql, /convert_verified_estimate_contract/);
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

test("bearer contract tokens are revision-bound and stale links fail closed", () => {
  const sql = read("supabase/migrations/20260819018000_contract_token_revision_and_atomic_finalization.sql");
  assert.match(sql, /metadata ->> 'estimate_version'/);
  assert.match(sql, /token_stale_revision/);
  assert.match(sql, /token_revision_missing/);
  assert.match(sql, /estimate_unavailable/);
  assert.match(sql, /char_length\(p_token\) > 512/);
});

test("replacement contract links revoke prior active bearer links", () => {
  const sql = read("supabase/migrations/20260819015000_contract_signature_token_invariants.sql");
  assert.match(sql, /trg_bos_revoke_prior_estimate_public_tokens/);
  assert.match(sql, /set revoked_at = coalesce\(t\.revoked_at, now\(\)\)/);
  assert.match(sql, /estimate_id = new\.estimate_id/);
});

test("signature finalization and cancellation serialize on the same legal-action lock", () => {
  const finalizer = read("supabase/migrations/20260819018000_contract_token_revision_and_atomic_finalization.sql");
  const cancellation = read("supabase/migrations/20260819015500_atomic_home_solicitation_cancellation.sql");
  const lockPattern = /home-solicitation-cancel:/;
  assert.match(finalizer, lockPattern);
  assert.match(cancellation, lockPattern);
  assert.match(finalizer, /CONTRACT_TOKEN_NO_LONGER_VALID/);
  assert.match(finalizer, /TRANSACTION_CANCELLED/);
  assert.match(finalizer, /for update/i);
  assert.match(finalizer, /grant execute .*service_role/is);
  assert.match(finalizer, /revoke execute .*public, anon, authenticated/is);
});

test("cancellation response preserves late-review semantics instead of claiming cancellation", () => {
  const route = read("app/api/contracts/estimate/[token]/cancel/route.ts");
  assert.match(route, /cancelled: result\.cancelled/);
  assert.match(route, /timely: result\.timely/);
  assert.match(route, /reviewRequired: !result\.timely/);
  assert.match(route, /alreadyRecorded: true/);
});

test("public bearer routes are non-cacheable non-indexable and non-frameable", () => {
  const middleware = read("middleware.ts");
  const contractRoute = read("app/api/contracts/estimate/[token]/route.ts");
  const cancelRoute = read("app/api/contracts/estimate/[token]/cancel/route.ts");
  assert.match(middleware, /X-Robots-Tag/);
  assert.match(middleware, /noindex, nofollow, noarchive/);
  assert.match(middleware, /Referrer-Policy/);
  assert.match(middleware, /no-referrer/);
  assert.match(middleware, /X-Frame-Options/);
  assert.match(middleware, /frame-ancestors 'none'/);
  assert.match(contractRoute, /Cache-Control/);
  assert.match(cancelRoute, /Cache-Control/);
});

test("internal estimate detail exposes an Orion-visible contract action", () => {
  assert.match(read("components/estimates/send-contract-button.tsx"), /data-orion-action="estimate\.send-contract"/);
  assert.match(read("components/estimates/estimate-detail.tsx"), /SendContractButton/);
});
