import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation=readFileSync("supabase/migrations/20260828010000_payroll_workforce_pay_operations.sql","utf8");
const workspace=readFileSync("supabase/migrations/20260828011000_payroll_workspace_rpcs.sql","utf8");
const page=readFileSync("app/(app)/invoices/payroll/page.tsx","utf8");
const invoices=readFileSync("app/(app)/invoices/page.tsx","utf8");

test("payroll is tenant scoped and restricted to finance administrators",()=>{
 assert.match(foundation,/enable row level security/);
 assert.match(foundation,/has_company_role/);
 assert.match(foundation,/owner','administrator','office_manager/);
 assert.match(foundation,/unique\(company_id, period_start, period_end\)/);
});

test("weekly payroll only consumes approved completed time and calculates overtime",()=>{
 assert.match(foundation,/t\.status='approved'/);
 assert.match(foundation,/t\.ended_at is not null/);
 assert.match(foundation,/least\(a\.hours,40\)/);
 assert.match(foundation,/greatest\(a\.hours-40,0\)/);
 assert.match(foundation,/overtime_multiplier/);
 assert.match(foundation,/source_time_entry_ids/);
});

test("payroll approval and provider handoff are controlled transitions",()=>{
 assert.match(foundation,/status in \('draft','review','approved','exported','void'\)/);
 assert.match(foundation,/approved_by=auth\.uid\(\)/);
 assert.match(foundation,/exported_by=auth\.uid\(\)/);
 assert.match(workspace,/provider_employee_id/);
});

test("payroll workspace exposes readiness, rates, payroll build, approval, and provider handoff",()=>{
 assert.match(page,/Approved Unprocessed Time/);
 assert.match(page,/Employee Pay Setup/);
 assert.match(page,/Build Weekly Payroll/);
 assert.match(page,/Approve/);
 assert.match(page,/Mark Exported/);
 assert.match(page,/does not file taxes or move money/);
 assert.match(invoices,/\/invoices\/payroll/);
});
