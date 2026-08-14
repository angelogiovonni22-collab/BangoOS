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
});

test("estimate signing discloses versioned electronic signature and platform terms", () => {
  const portal = read("app/contracts/estimate/[token]/page.tsx");
  const legal = read("app/legal/electronic-signature-and-platform-terms/page.tsx");

  assert.match(portal, /View Electronic Signature &amp; BOS Platform Terms/);
  assert.match(legal, /Version 1\.0/);
  assert.match(legal, /Consent to electronic records/);
  assert.match(legal, /Intent, attribution, and authority/);
  assert.match(legal, /BOS platform role/);
  assert.match(legal, /non-waivable consumer right/);
});
