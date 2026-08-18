import fs from "node:fs";
import path from "node:path";
import { calculatePrevailingWageCompliance } from "./ap-prevailing-wage";

let passed = 0;
let failed = 0;

function check(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

function test(name: string, fn: () => void) {
  console.log(`\n${name}`);
  fn();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function main() {
  const migration = read("supabase/migrations/20260818023000_finance_ap_prevailing_wage_foundation.sql");
  const service = read("lib/finance/ap-prevailing-wage.ts");

  test("1. AP schema covers bills, lines, and payments", () => {
    check(migration.includes("create table if not exists public.vendor_bills"), "vendor bills table exists");
    check(migration.includes("create table if not exists public.vendor_bill_line_items"), "vendor bill lines table exists");
    check(migration.includes("create table if not exists public.vendor_bill_payments"), "vendor bill payments table exists");
    check(migration.includes("balance_due"), "bill balance due is represented");
  });

  test("2. prevailing wage schema is project/jurisdiction aware", () => {
    check(migration.includes("prevailing_wage_project_profiles"), "project prevailing wage profiles exist");
    check(migration.includes("federal_dbra"), "federal DBRA applicability is supported");
    check(migration.includes("ohio_public_improvement"), "Ohio public-improvement applicability is supported");
    check(migration.includes("certified_payroll_required"), "certified payroll requirement is tracked");
    check(migration.includes("wage_posting_required"), "wage posting requirement is tracked");
    check(migration.includes("completion_affidavit_required"), "completion affidavit requirement is tracked");
  });

  test("3. classifications include base, fringe, overtime, and apprenticeship", () => {
    check(migration.includes("base_hourly_rate"), "base hourly rate is tracked");
    check(migration.includes("fringe_hourly_rate"), "fringe hourly rate is tracked");
    check(migration.includes("overtime_multiplier"), "overtime multiplier is tracked");
    check(migration.includes("apprentice_program_name"), "apprentice program is tracked");
    check(migration.includes("apprentice_registration_number"), "apprentice registration is tracked");
    check(migration.includes("apprentice_percentage"), "apprentice progression percentage is tracked");
  });

  test("4. certified payroll stores weekly compliance evidence", () => {
    check(migration.includes("certified_payroll_periods"), "weekly certified payroll periods exist");
    check(migration.includes("statement_of_compliance_signed"), "statement of compliance signature state exists");
    check(migration.includes("certified_payroll_worker_rows"), "certified payroll worker rows exist");
    check(migration.includes("deficiency_amount"), "worker deficiency amount is tracked");
  });

  test("5. prevailing wage compliance calculator detects underpayment", () => {
    const result = calculatePrevailingWageCompliance({
      requiredBaseHourly: 30,
      requiredFringeHourly: 12,
      actualBaseHourly: 28,
      actualCashFringeHourly: 4,
      actualBonaFideFringeHourly: 5,
      regularHours: 40,
      overtimeHours: 5,
    });
    check(!result.compliant, "underpayment is noncompliant");
    check(result.hourlyDeficiency === 5, "combined hourly deficiency is calculated");
    check(result.estimatedDeficiencyAmount > 0, "estimated deficiency amount is calculated");
  });

  test("6. bona fide fringe credit can satisfy required fringe", () => {
    const result = calculatePrevailingWageCompliance({
      requiredBaseHourly: 30,
      requiredFringeHourly: 12,
      actualBaseHourly: 30,
      actualCashFringeHourly: 2,
      actualBonaFideFringeHourly: 10,
      regularHours: 40,
    });
    check(result.compliant, "base plus cash/bona fide fringe meets required compensation");
    check(result.estimatedDeficiencyAmount === 0, "compliant row has no estimated deficiency");
  });

  test("7. finance service supports AP and project prevailing-wage compliance", () => {
    check(service.includes("loadAccountsPayableSnapshot"), "AP snapshot service exists");
    check(service.includes("loadPrevailingWageProjectCompliance"), "project prevailing-wage compliance service exists");
    check(service.includes('from("vendor_bills")'), "AP service reads vendor bills");
    check(service.includes('from("prevailing_wage_time_entries")'), "prevailing-wage service reads time entries");
    check(service.includes('from("prevailing_wage_classifications")'), "prevailing-wage service reads classifications");
  });

  test("8. all finance/compliance tables enforce company RLS", () => {
    check(migration.includes("enable row level security"), "RLS is enabled");
    check(migration.includes("public.is_company_member(company_id)"), "reads require company membership");
    check(migration.includes("public.has_company_role"), "writes require approved company roles");
  });

  console.log(`\nAP + prevailing wage contract results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
