import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { evaluateOhioExcessCostCompliance } from "./ohio-excess-cost-compliance";

const refinementSql = readFileSync(
  new URL("../../supabase/migrations/20260814161000_refine_ohio_excess_cost_scope.sql", import.meta.url),
  "utf8",
);

test("firm-price/no-excess does not block an ordinary owner-requested change outside the statutory excess-cost classification", () => {
  const result = evaluateOhioExcessCostCompliance({
    applicable: true,
    pricingType: "fixed",
    contractEstimateMethod: "firm_price_no_excess",
    qualifiesAsReasonablyUnforeseenNecessary: false,
    currentExcessCostCents: 250_000,
    priorQualifyingExcessCostCents: 0,
  });

  assert.equal(result.status, "COMPLIANT");
  assert.equal(result.chargeMayProceed, true);
  assert.equal(result.cumulativeQualifyingExcessCostCents, 0);
});

test("database refinement performs statutory classification before firm-price/no-excess handling", () => {
  const classificationIndex = refinementSql.indexOf("qualifies_as_unforeseen_necessary is false");
  const firmPriceIndex = refinementSql.indexOf("excess_cost_method = 'firm_price_no_excess'");

  assert.ok(classificationIndex >= 0);
  assert.ok(firmPriceIndex >= 0);
  assert.ok(classificationIndex < firmPriceIndex);
});
