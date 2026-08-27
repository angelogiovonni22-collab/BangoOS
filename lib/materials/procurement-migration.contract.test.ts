import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260827220000_procurement_intelligence_foundation.sql", "utf8");

test("procurement migration creates lifecycle, lines and receipt persistence", () => {
  assert.match(sql, /create table if not exists public\.procurement_orders/i);
  assert.match(sql, /create table if not exists public\.procurement_order_lines/i);
  assert.match(sql, /create table if not exists public\.procurement_receipts/i);
});

test("procurement persistence enables row level security", () => {
  assert.match(sql, /alter table public\.procurement_orders enable row level security/i);
  assert.match(sql, /alter table public\.procurement_order_lines enable row level security/i);
  assert.match(sql, /alter table public\.procurement_receipts enable row level security/i);
});
