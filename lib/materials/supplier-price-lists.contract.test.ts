import assert from "node:assert/strict";
import { getEffectiveSupplierPrice, parseSupplierPriceCsv } from "./supplier-price-lists";

const parsed = parseSupplierPriceCsv(`SKU,Description,Brand,Model,Pack,UOM,Unit Price,Contractor Price,Availability
ABC-1,"2x4, kiln dried",Acme,SPF24,1,each,$4.98,$4.49,In stock
ABC-2,Concrete Mix,BuildCo,CM80,2,bag,8.25,,Limited`);

assert.equal(parsed.rows.length, 2);
assert.equal(parsed.rows[0].productDescription, "2x4, kiln dried");
assert.equal(parsed.rows[0].unitPrice, 4.98);
assert.equal(getEffectiveSupplierPrice(parsed.rows[0]), 4.49);
assert.equal(parsed.rows[1].packageQuantity, 2);
assert.deepEqual(parsed.rows.flatMap((row) => row.errors), []);

const invalid = parseSupplierPriceCsv(`item number,item description,price
DUP,Valid item,10
DUP,,nope`);
assert.deepEqual(invalid.duplicateSkus, ["dup"]);
assert.ok(invalid.rows[1].errors.includes("Description is required"));
assert.ok(invalid.rows[1].errors.includes("Valid unit price is required"));
assert.ok(invalid.rows.every((row) => row.errors.includes("Duplicate SKU in this file")));

console.log("supplier price-list contract passed");
