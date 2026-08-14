import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const packageSource = readFileSync(new URL("./contract-package.ts", import.meta.url), "utf8");
const routeSource = readFileSync(new URL("../../app/api/contracts/estimate/[token]/route.ts", import.meta.url), "utf8");

test("contract package is versioned and independently hashed", () => {
  assert.match(packageSource, /CONTRACT_PACKAGE_VERSION/);
  assert.match(packageSource, /packageHash: sha256\(JSON\.stringify\(payload\)\)/);
  assert.match(packageSource, /ohioHomeConstruction/);
  assert.match(packageSource, /ohioHomeSolicitation/);
});

test("contract package snapshots only taxpayer-id presence, not a raw identifier", () => {
  assert.match(packageSource, /supplierTaxpayerIdRecorded/);
  assert.doesNotMatch(packageSource, /supplierTaxpayerId:/);
});

test("applicable home-solicitation package preserves two notices and signing deadline evidence", () => {
  assert.match(packageSource, /requiredNoticeCopies: 2 as const/);
  assert.match(packageSource, /cancellationDeadlineDate/);
  assert.match(packageSource, /sellerSignedAt/);
  assert.match(packageSource, /oralDisclosureConfirmedAt/);
  assert.match(packageSource, /workStartHoldRequired: true as const/);
});

test("agreement version is enriched before the buyer signature is stored", () => {
  const finalizeIndex = routeSource.indexOf("finalizeAgreementContractPackage");
  const signatureIndex = routeSource.indexOf("workflow.storeSignature");
  assert.ok(finalizeIndex >= 0, "finalization must be present");
  assert.ok(signatureIndex > finalizeIndex, "signature must occur after contract package finalization");
  assert.match(routeSource, /finalizedAgreement\.agreementHash/);
  assert.match(routeSource, /contract_package_hash/);
  assert.match(routeSource, /agreement_snapshot: finalizedAgreement\.snapshot/);
});

test("finalization uses compare-and-update protection on the base agreement hash", () => {
  assert.match(packageSource, /\.eq\("agreement_hash", input\.baseAgreementHash\)/);
  assert.match(packageSource, /Agreement package changed before finalization/);
});
