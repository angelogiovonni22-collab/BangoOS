import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path: string) => readFileSync(path, "utf8");

test("estimate delivery uses a tenant-branded single-action email", () => {
  const route = read("app/api/estimates/[id]/contract/route.ts");
  const template = read("lib/estimates/branded-estimate-email.ts");

  assert.match(route, /company\.display_name \|\| company\.legal_name \|\| company\.name/);
  assert.match(route, /companyLogoUrl: company\.logo_url/);
  assert.match(template, /Review &amp; Sign Estimate/);
  assert.equal((template.match(/href="\$\{reviewUrl\}"/g) || []).length, 1);
  assert.doesNotMatch(template, /Open and sign contract/);
  assert.match(template, /Sent securely by/);
  assert.match(template, /incorporated Construction Agreement/);
  assert.match(template, /B\.O\.S\. Electronic Signature &amp; Platform Terms/);
});

test("estimate signing incorporates versioned construction and electronic signature terms", () => {
  const portal = read("app/contracts/estimate/[token]/page.tsx");
  const legal = read("app/legal/electronic-signature-and-platform-terms/page.tsx");
  const agreement = read("lib/estimates/construction-agreement.ts");
  const workflow = read("lib/estimates/workflow-service.ts");

  assert.match(portal, /Read Construction Agreement/);
  assert.match(portal, /B\.O\.S\. Electronic Signature &amp; Platform Terms/);
  assert.match(portal, /I confirm that I have reviewed and accept/);
  assert.match(legal, /Version 1\.0/);
  assert.match(legal, /Consent to electronic records/);
  assert.match(legal, /Intent, attribution, and authority/);
  assert.match(legal, /B\.O\.S\. platform role/);
  assert.match(legal, /non-waivable consumer right/);
  assert.match(agreement, /CONSTRUCTION_AGREEMENT_VERSION/);
  assert.match(agreement, /Ohio Revised Code Chapter 1312/);
  assert.match(agreement, /B\.O\.S\. \(Bango Operating System\)/);
  assert.match(workflow, /constructionAgreementSections/);
  assert.match(workflow, /electronicSignaturePlatformTermsVersion/);
});
