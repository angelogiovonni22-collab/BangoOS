import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const form = readFileSync("components/estimates/estimate-form.tsx", "utf8");
const detail = readFileSync("components/estimates/estimate-detail.tsx", "utf8");
const review = readFileSync("components/estimates/home-solicitation-compliance-panel.tsx", "utf8");

assert.match(form, /isOhioResidential/);
assert.match(form, /Create Estimate & Review/);
assert.match(form, /createdForReview=1#home-solicitation-review/);
assert.match(detail, /Estimate created\./);
assert.match(review, /id="home-solicitation-review"/);

console.log("Residential estimate creation review routing contract passed.");
