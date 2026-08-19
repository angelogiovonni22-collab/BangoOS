import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const read = (path: string) => readFileSync(join(root, path), "utf8");

const apIndex = read("app/(app)/invoices/accounts-payable/page.tsx");
const apNew = read("app/(app)/invoices/accounts-payable/new/page.tsx");
const apDetail = read("app/(app)/invoices/accounts-payable/[billId]/page.tsx");
const wageIndex = read("app/(app)/invoices/prevailing-wage/page.tsx");
const wageSetup = read("app/(app)/invoices/prevailing-wage/setup/page.tsx");
const wageProject = read("app/(app)/invoices/prevailing-wage/[projectId]/page.tsx");
const rpcMigration = read("supabase/migrations/20260818223000_finance_ap_operations_rpc.sql");

assert.match(apIndex, /\/invoices\/accounts-payable\/new/, "AP command center must expose vendor bill creation");
assert.match(apIndex, /\/invoices\/accounts-payable\/\$\{bill\.id\}/, "AP register must expose bill detail operations");
assert.match(apNew, /create_vendor_bill_with_line/, "vendor bill entry must use the atomic database operation");
assert.match(rpcMigration, /security invoker/i, "AP creation RPC must preserve caller RLS identity");
assert.match(rpcMigration, /has_company_role/, "AP creation RPC must enforce company role authorization");
assert.match(rpcMigration, /owner.*administrator.*operations_manager.*office_manager.*accountant[\s\S]*/, "AP write roles must stay limited to finance\/operations leadership");
assert.match(apDetail, /status: "approved"/, "vendor bill detail must support explicit approval");
assert.match(apDetail, /vendor_bill_payments/, "vendor bill detail must record payments through the protected payment table");
assert.match(apDetail, /amount > bill\.balance_due/, "client payment workflow must reject obvious overpayment before database enforcement");

assert.match(wageIndex, /\/invoices\/prevailing-wage\/setup/, "prevailing wage command center must expose project setup");
assert.match(wageIndex, /\/invoices\/prevailing-wage\/\$\{item\.profile\.project_id\}/, "covered projects must open their compliance operations workspace");
assert.match(wageSetup, /federal_dbra/, "setup must support federal DBRA applicability");
assert.match(wageSetup, /ohio_public_improvement/, "setup must support Ohio public-improvement applicability");
assert.match(wageSetup, /weekly_statement_required: federal/, "federal setup must enable the weekly statement control");
assert.match(wageSetup, /wage_posting_required: federal \|\| ohio/, "federal and Ohio setup must enable wage posting");
assert.match(wageSetup, /completion_affidavit_required: ohio/, "Ohio setup must enable completion-affidavit tracking");
assert.match(wageProject, /prevailing_wage_classifications/, "project compliance workspace must manage wage classifications");
assert.match(wageProject, /base_hourly_rate/, "classification workflow must retain base hourly rate");
assert.match(wageProject, /fringe_hourly_rate/, "classification workflow must retain fringe hourly rate");
assert.match(wageProject, /overtime_multiplier/, "classification workflow must retain overtime multiplier");
assert.match(wageProject, /apprentice_allowed/, "classification workflow must retain apprenticeship control");
assert.match(wageProject, /certified_payroll_periods/, "project compliance workspace must manage certified payroll periods");
assert.match(wageProject, /statement_of_compliance_signed/, "certified payroll workspace must expose statement-of-compliance status");
assert.match(wageProject, /wage_determination_snapshot/, "certified payroll period must snapshot the governing wage determination");

console.log("AP + prevailing wage operations contract passed.");