import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("executed agreement snapshot captures the complete customer-facing estimate", () => {
  const packageSource = read("lib/compliance/contract-package.ts");
  assert.match(packageSource, /executedCustomerFacingEstimate/);
  assert.match(packageSource, /estimate_line_items/);
  assert.match(packageSource, /estimate_number,title,description,total_amount/);
  assert.match(packageSource, /scope_inclusions,scope_exclusions,terms,payment_terms/);
  assert.match(packageSource, /customers\(first_name,last_name,company_name,customer_type,email,phone,address_line_1,address_line_2,city,state,postal_code\)/);
  assert.match(packageSource, /companies/);
  assert.match(packageSource, /agreementHash = sha256\(JSON\.stringify\(snapshot\)\)/);
});

test("verified estimate signatures and executed agreement versions are immutable", () => {
  const sql = read("supabase/migrations/20260819019800_executed_contract_evidence_immutability.sql");
  assert.match(sql, /VERIFIED_ESTIMATE_SIGNATURE_IS_IMMUTABLE/);
  assert.match(sql, /VERIFIED_SIGNATURE_EVIDENCE_INCOMPLETE/);
  assert.match(sql, /VERIFIED_SIGNATURE_AGREEMENT_HASH_MISMATCH/);
  assert.match(sql, /EXECUTED_AGREEMENT_VERSION_IS_IMMUTABLE/);
  assert.match(sql, /EXECUTED_ESTIMATE_EVIDENCE_IS_IMMUTABLE/);
  assert.match(sql, /before insert or update or delete on public\.estimate_signatures/i);
  assert.match(sql, /before update or delete on public\.estimate_agreement_versions/i);
});

test("legal audit evidence is append-only", () => {
  const sql = read("supabase/migrations/20260819019800_executed_contract_evidence_immutability.sql");
  assert.match(sql, /LEGAL_EVIDENCE_IS_APPEND_ONLY/);
  assert.match(sql, /estimate_acceptance_events/);
  assert.match(sql, /estimate_home_solicitation_events/);
  assert.match(sql, /estimate_home_solicitation_cancellations/);
  assert.match(sql, /subcontractor_signature_events/);
  assert.match(sql, /before update or delete/);
});

test("material estimate, line-item, customer and compliance edits revoke outstanding bearer links", () => {
  const sql = read("supabase/migrations/20260819019000_contract_bearer_content_invalidation.sql");
  assert.match(sql, /bos_revoke_active_estimate_contract_tokens/);
  assert.match(sql, /new\.version_number := greatest/);
  assert.match(sql, /trg_bos_estimate_line_item_contract_guard/);
  assert.match(sql, /trg_bos_customer_contract_link_invalidation/);
  assert.match(sql, /trg_bos_contract_compliance_link_invalidation/);
  assert.match(sql, /trg_bos_home_solicitation_link_invalidation/);
  assert.match(sql, /SIGNED_OR_CANCELLED_ESTIMATE_CONTENT_IS_IMMUTABLE/);
  assert.match(sql, /SIGNED_OR_CANCELLED_ESTIMATE_LINE_ITEMS_ARE_IMMUTABLE/);
});

test("post-sign project conversion is operational state, not a contract-content rewrite", () => {
  const sql = read("supabase/migrations/20260819019900_estimate_conversion_contract_guard_alignment.sql");
  assert.match(sql, /Project association is an operational consequence of execution/);
  assert.doesNotMatch(sql, /old\.customer_id, old\.project_id/);
  assert.doesNotMatch(sql, /new\.customer_id, new\.project_id/);
  assert.match(sql, /SIGNED_OR_CANCELLED_ESTIMATE_CONTENT_IS_IMMUTABLE/);
});
