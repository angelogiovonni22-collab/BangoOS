import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("subcontractor foundation stores master agreements, project authorizations, audit evidence, and mobilization requirements", () => {
  const sql = read("supabase/migrations/20260815002000_subcontractor_contract_mobilization.sql");
  assert.match(sql, /subcontractor_master_agreements/);
  assert.match(sql, /project_subcontract_work_authorizations/);
  assert.match(sql, /subcontractor_signature_events/);
  assert.match(sql, /subcontractor_mobilization_requirements/);
  assert.match(sql, /refresh_subcontractor_mobilization_status/);
  assert.match(sql, /mobilization_status/);
  assert.match(sql, /auth\.role\(\)[\s\S]*service_role/);
  assert.match(sql, /auth\.uid\(\)[\s\S]*company_id = p_company_id/);
  assert.match(sql, /revoke insert, update, delete .* authenticated/i);
});

test("project assignment can generate and email a secure subcontract package", () => {
  const route = read("app/api/projects/[id]/subcontractors/[assignmentId]/agreement/route.ts");
  assert.match(route, /buildMasterSnapshot/);
  assert.match(route, /buildWorkAuthorizationSnapshot/);
  assert.match(route, /randomBytes\(32\)/);
  assert.match(route, /sendContractEmail/);
  assert.match(route, /pending_signature/);
  assert.match(route, /refresh_subcontractor_mobilization_status/);
});

test("resending preserves verified compliance and never overwrites an executed authorization", () => {
  const route = read("app/api/projects/[id]/subcontractors/[assignmentId]/agreement/route.ts");
  const component = read("components/projects/workspace/subcontractor-contract-actions.tsx");
  const guard = read("supabase/migrations/20260819019500_subcontract_authorization_content_guard.sql");
  assert.match(route, /existingAuthorization\?\.status === "signed"/);
  assert.match(route, /alreadySigned: true/);
  assert.match(route, /ignoreDuplicates: true/);
  assert.match(guard, /new\.status is distinct from old\.status/);
  assert.match(guard, /SIGNED_WORK_AUTHORIZATION_IS_IMMUTABLE/);
  assert.match(component, /signed \|\| busy === "send" \|\| !email/);
  assert.match(component, /Agreement Signed/);
});

test("sent authorization terms invalidate the old bearer link and executed terms are immutable", () => {
  const guard = read("supabase/migrations/20260819019500_subcontract_authorization_content_guard.sql");
  assert.match(guard, /assignment_contract_terms_changed/);
  assert.match(guard, /public_token_hash = null/);
  assert.match(guard, /token_expires_at = null/);
  assert.match(guard, /status = 'void'/);
  assert.match(guard, /SIGNED_WORK_AUTHORIZATION_TERMS_ARE_IMMUTABLE/);
  assert.match(guard, /old\.signer_name/);
  assert.match(guard, /old\.signed_at/);
  assert.match(guard, /SIGNED_MASTER_SUBCONTRACT_IS_IMMUTABLE/);
});

test("public subcontract signing is atomic, service-only, replay-resistant, and consumes the bearer token", () => {
  const route = read("app/api/subcontracts/[token]/route.ts");
  const sql = read("supabase/migrations/20260819016000_atomic_subcontract_signature.sql");
  assert.match(route, /sign_public_subcontract_authorization/);
  assert.doesNotMatch(route, /\.from\("subcontractor_signature_events"/);
  assert.match(sql, /for update/i);
  assert.match(sql, /public_token_hash = null/);
  assert.match(sql, /token_expires_at = null/);
  assert.match(sql, /subcontractor_signature_events/);
  assert.match(sql, /contract_status = 'signed'/);
  assert.match(sql, /refresh_subcontractor_mobilization_status/);
  assert.match(sql, /revoke execute .*public, anon, authenticated/is);
  assert.match(sql, /grant execute .*service_role/is);
});

test("public subcontract portal requires explicit signer identity and consent", () => {
  const page = read("app/subcontracts/[token]/page.tsx");
  const route = read("app/api/subcontracts/[token]/route.ts");
  assert.match(page, /Accept & Sign Subcontract/);
  assert.match(page, /Full legal name/);
  assert.match(page, /Title \/ capacity/);
  assert.match(page, /consent to electronic records and signatures/);
  assert.match(route, /typedName/);
  assert.match(route, /consentAccepted/);
  assert.match(route, /typedName\.length > 200/);
  assert.match(route, /title\.length > 200/);
});

test("mobilization remains independently gated after signing", () => {
  const sql = read("supabase/migrations/20260819016000_atomic_subcontract_signature.sql");
  const mobilization = read("app/api/projects/[id]/subcontractors/[assignmentId]/mobilization/route.ts");
  assert.match(sql, /contract_status = 'signed'/);
  assert.match(sql, /refresh_subcontractor_mobilization_status/);
  assert.match(mobilization, /w9/);
  assert.match(mobilization, /coi/);
  assert.match(mobilization, /workers_comp/);
  assert.match(mobilization, /licenses/);
  assert.match(mobilization, /safety_acknowledgement/);
});

test("subcontract legal evidence is server-write-only and assignment writes require project-management authority", () => {
  const evidence = read("supabase/migrations/20260819019700_subcontract_legal_evidence_write_isolation.sql");
  const assignment = read("supabase/migrations/20260819019600_trade_partner_assignment_least_privilege.sql");
  assert.match(evidence, /subcontractor_master_agreements/);
  assert.match(evidence, /project_subcontract_work_authorizations/);
  assert.match(evidence, /subcontractor_signature_events/);
  assert.match(evidence, /for update to authenticated using \(false\)/i);
  assert.match(evidence, /for insert to authenticated with check \(false\)/i);
  assert.match(assignment, /projects\.manage/);
  assert.match(assignment, /as restrictive/);
});

test("compliance documents are privately stored, scoped, and attached to mobilization evidence", () => {
  const sql = read("supabase/migrations/20260815003000_subcontractor_compliance_documents.sql");
  const route = read("app/api/projects/[id]/subcontractors/[assignmentId]/compliance-documents/route.ts");
  const component = read("components/projects/workspace/subcontractor-contract-actions.tsx");
  assert.match(sql, /subcontractor_compliance_documents/);
  assert.match(sql, /subcontractor-compliance/);
  assert.match(sql, /public,\s*file_size_limit/);
  assert.match(sql, /exists\(select 1 from public\.profiles where id = auth\.uid\(\)/);
  assert.match(route, /20 \* 1024 \* 1024/);
  assert.match(route, /application\/pdf/);
  assert.match(route, /createSignedUrl/);
  assert.match(route, /status: "pending"/);
  assert.match(route, /compliance_document_id/);
  assert.match(component, /Upload/);
  assert.match(component, /Replace/);
  assert.match(component, /\.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx/);
});

test("project subcontractor cards expose agreement and mobilization controls", () => {
  const component = read("components/projects/workspace/subcontractor-contract-actions.tsx");
  const workspace = read("components/projects/workspace/project-trade-partners-workspace.tsx");
  assert.match(component, /Send Agreement/);
  assert.match(component, /Resend Agreement/);
  assert.match(component, /CLEARED TO MOBILIZE/);
  assert.match(component, /Mobilization Requirements/);
  assert.match(component, /Verify/);
  assert.match(component, /Waive/);
  assert.match(workspace, /SubcontractorContractActions/);
  assert.match(workspace, /assignmentId=\{assignment\.id\}/);
});
