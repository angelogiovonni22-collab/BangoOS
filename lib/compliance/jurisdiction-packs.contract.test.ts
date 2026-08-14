import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const registry = readFileSync(new URL("./jurisdiction-packs.ts", import.meta.url), "utf8");
const migration = readFileSync(
  new URL("../../supabase/migrations/20260814190000_jurisdiction_packs.sql", import.meta.url),
  "utf8",
);

test("Phase 8 defines a versioned Ohio jurisdiction pack", () => {
  assert.match(registry, /US-OH-RESIDENTIAL-HOME-CONSTRUCTION/);
  assert.match(registry, /OH_RESIDENTIAL_HOME_CONSTRUCTION/);
  assert.match(registry, /2026-08-14\.1/);
  assert.match(registry, /effectiveFrom: "2026-08-14"/);
  assert.match(registry, /statutoryReferences/);
});

test("jurisdiction packs support effective-date resolution", () => {
  assert.match(registry, /getActiveJurisdictionPack/);
  assert.match(registry, /effectiveFrom <= isoDate/);
  assert.match(registry, /effectiveTo/);
  assert.match(migration, /resolve_compliance_jurisdiction_pack/);
  assert.match(migration, /effective_from <= p_on_date/);
  assert.match(migration, /effective_to is null or p\.effective_to >= p_on_date/);
});

test("jurisdiction pack configuration is deployment-controlled", () => {
  assert.match(migration, /enable row level security/);
  assert.match(migration, /for select\s+to authenticated/i);
  assert.doesNotMatch(migration, /for insert\s+to authenticated/i);
  assert.doesNotMatch(migration, /for update\s+to authenticated/i);
  assert.doesNotMatch(migration, /for delete\s+to authenticated/i);
});

test("database and TypeScript registries agree on the Ohio pack identity", () => {
  for (const value of [
    "US-OH-RESIDENTIAL-HOME-CONSTRUCTION",
    "OH_RESIDENTIAL_HOME_CONSTRUCTION",
    "2026-08-14.1",
  ]) {
    assert.match(registry, new RegExp(value.replaceAll(".", "\\.")));
    assert.match(migration, new RegExp(value.replaceAll(".", "\\.")));
  }
});
