import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const portal = readFileSync("components/trade-partners/trade-partner-mobilization-panel.tsx", "utf8");
const portalRoute = readFileSync("app/api/trade-partners/projects/[projectId]/mobilization/route.ts", "utf8");
const internalDocuments = readFileSync("app/api/projects/[id]/subcontractors/[assignmentId]/compliance-documents/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/20260925180500_trade_partner_company_compliance_bridge.sql", "utf8");
const preservationMigration = readFileSync("supabase/migrations/20260925180550_promote_existing_project_compliance.sql", "utf8");

test("Trade Partner portal owns company compliance submission and project acknowledgement", () => {
  assert.match(portal, /Before You Start Work/);
  assert.match(portal, /Company profile/);
  assert.match(portal, /Project specific/);
  assert.match(portal, /safety_acknowledgement/);
  assert.match(portal, /scope_confirmation/);
  assert.match(portalRoute, /role", "subcontractor"/);
  assert.match(portalRoute, /trade_partner_self_attestation/);
});

test("company compliance is reused rather than duplicated per project", () => {
  assert.match(migration, /sync_trade_partner_company_compliance/);
  assert.match(migration, /trade_partner_onboarding_documents/);
  assert.match(migration, /company_profile/);
  assert.match(internalDocuments, /COMPANY_REQUIREMENTS/);
  assert.match(internalDocuments, /trade_partner_onboarding_documents/);
  assert.match(internalDocuments, /source: "company_profile"/);
  assert.match(preservationMigration, /subcontractor_compliance_documents/);
  assert.match(preservationMigration, /trade_partner_onboarding_documents/);
  assert.match(preservationMigration, /Migrated from existing project compliance record/);
});

test("mobilization clearance remains automatic", () => {
  assert.match(migration, /refresh_subcontractor_mobilization_status/);
  assert.match(portal, /Cleared to Mobilize/);
  assert.match(portal, /Do not begin work until this panel shows Cleared to Mobilize/);
});
