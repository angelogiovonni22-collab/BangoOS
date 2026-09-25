import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const sql = readFileSync("supabase/migrations/20260925183000_trade_partner_compliance_expiration_monitor.sql", "utf8");

test("trade partner compliance expiration monitor expires standing credentials and resyncs project mobilization", () => {
  assert.match(sql, /process_trade_partner_compliance_expirations/);
  assert.match(sql, /review_status = 'expired'/);
  assert.match(sql, /sync_trade_partner_company_compliance/);
  assert.match(sql, /requirement_type in \('coi','workers_comp','licenses'\)/);
});

test("expiration monitor creates deduplicated compliance notifications for partner and internal users", () => {
  assert.match(sql, /bos_notifications/);
  assert.match(sql, /30,14,7/);
  assert.match(sql, /trade-partner-compliance:/);
  assert.match(sql, /role\) = 'subcontractor'/);
  assert.match(sql, /owner','administrator','office_manager','project_manager/);
  assert.match(sql, /on conflict \(company_id, recipient_user_id, source_key\)/);
});

test("expiration monitor runs daily through pg_cron", () => {
  assert.match(sql, /pg_cron/);
  assert.match(sql, /trade-partner-compliance-expiration-sweep/);
  assert.match(sql, /15 12 \* \* \*/);
});
