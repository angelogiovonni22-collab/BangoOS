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
  const hardening = read("supabase/migrations/20260818173000_finance_ap_prevailing_wage_hardening.sql");
  const service = read("lib/finance/ap-prevailing-wage.ts");

  test("1. AP schema covers bills, lines, and payments", () => {
    check(migration.includes("create table if not exists public.vendor_bills"), "vendor bills table exists");
    check(migration.includes("create table if not exists public.vendor_bill_line_items"), "vendor bill lines table exists");
    check(migration.includes("create table if not exists public.vendor_bill_payments"), "vendor bill payments table exists");
    check(migration.includes("balance_due"), "bill balance due is represented");
    check(migration.includes("idx_vendor_bills_company_vendor_invoice_unique"), "duplicate vendor invoice protection exists");
  });

  test("2. AP links are strict and payment state is database-maintained", () => {
    check(migration.includes("vendor_bills_purchase_order_company_fkey"), "bills are company-scoped to purchase orders");
    check(migration.includes("vendor_bill_line_items_purchase_order_line_company_fkey"), "bill lines are company-scoped to PO lines");
    check(migration.includes("recalculate_vendor_bill_payment_totals"), "payment totals are recalculated at the database boundary");
    check(migration.includes("trg_vendor_bill_payments_recalculate"), "payment changes trigger AP rollup");
    check(migration.includes("Vendor bill payments exceed bill total"), "overpayment is rejected");
  });

  test("3. prevailing wage schema is project/jurisdiction aware", () => {
    check(migration.includes("prevailing_wage_project_profiles"), "project prevailing wage profiles exist");
    check(migration.includes("federal_dbra"), "federal DBRA applicability is supported");
    check(migration.includes("ohio_public_improvement"), "Ohio public-improvement applicability is supported");
    check(migration.includes("certified_payroll_required"), "certified payroll requirement is tracked");
    check(migration.includes("wage_posting_required"), "wage posting requirement is tracked");
    check(migration.includes("completion_affidavit_required"), "completion affidavit requirement is tracked");
  });

  test("4. classifications and workers include wage and apprenticeship controls", () => {
    check(migration.includes("base_hourly_rate"), "base hourly rate is tracked");
    check(migration.includes("fringe_hourly_rate"), "fringe hourly rate is tracked");
    check(migration.includes("overtime_multiplier"), "overtime multiplier is tracked");
    check(migration.includes("apprentice_program_name"), "apprentice program is tracked");
    check(migration.includes("apprentice_registration_number"), "apprentice registration is tracked");
    check(migration.includes("prevailing_wage_worker_assignments_employee_company_fkey"), "employee assignments are company-scoped");
    check(migration.includes("prevailing_wage_worker_assignments_trade_partner_company_fkey"), "trade partner assignments are company-scoped");
    check(migration.includes("prevailing_wage_worker_assignments_apprentice_evidence_check"), "apprentice evidence is required when apprentice status is used");
  });

  test("5. prevailing wage time remains tied to the project and source time record", () => {
    check(migration.includes("prevailing_wage_worker_assignments_id_project_company_unique"), "worker assignments expose project-scoped composite identity");
    check(migration.includes("prevailing_wage_time_entries_assignment_project_company_fkey"), "time entries cannot point to an assignment from another project");
    check(migration.includes("workforce_time_entries_id_company_unique"), "workforce time source exposes company-scoped identity");
    check(migration.includes("prevailing_wage_time_entries_source_time_company_fkey"), "prevailing wage time can trace to workforce time evidence");
    check(migration.includes("idx_prevailing_wage_time_source_unique"), "a source time entry cannot be imported twice");
  });

  test("6. certified payroll stores weekly compliance evidence", () => {
    check(migration.includes("certified_payroll_periods"), "weekly certified payroll periods exist");
    check(migration.includes("statement_of_compliance_signed"), "statement of compliance signature state exists");
    check(migration.includes("certified_payroll_periods_statement_check"), "signed statements require signer evidence");
    check(migration.includes("certified_payroll_periods_submission_check"), "submitted payroll requires submission evidence");
    check(migration.includes("certified_payroll_worker_rows"), "certified payroll worker rows exist");
    check(migration.includes("deficiency_amount"), "worker deficiency amount is tracked");
  });

  test("7. prevailing wage compliance calculator detects underpayment", () => {
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

  test("8. bona fide fringe credit can satisfy required fringe", () => {
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

  test("9. finance service supports AP and project prevailing-wage compliance", () => {
    check(service.includes("loadAccountsPayableSnapshot"), "AP snapshot service exists");
    check(service.includes("loadPrevailingWageProjectCompliance"), "project prevailing-wage compliance service exists");
    check(service.includes('from("vendor_bills")'), "AP service reads vendor bills");
    check(service.includes('from("prevailing_wage_time_entries")'), "prevailing-wage service reads time entries");
    check(service.includes('from("prevailing_wage_classifications")'), "prevailing-wage service reads classifications");
  });

  test("10. finance permissions are narrower than field compliance permissions", () => {
    check(migration.includes("array[''owner'',''administrator'',''operations_manager'',''office_manager'',''accountant'']"), "AP writes are restricted to finance/operations leadership");
    check(migration.includes("array[''owner'',''administrator'',''operations_manager'',''office_manager'',''accountant'',''project_manager'',''superintendent'']"), "prevailing wage operations allow approved project leadership");
    check(migration.includes("public.is_company_member(company_id)"), "general prevailing-wage reads require company membership");
  });

  test("11. tenant identity survives optional composite-FK deletes", () => {
    check(hardening.includes("on delete set null (project_id)"), "project deletion nulls only the optional project id");
    check(hardening.includes("on delete set null (purchase_order_id)"), "purchase-order deletion preserves company identity");
    check(hardening.includes("on delete set null (created_by)"), "actor deletion preserves company identity");
    check(hardening.includes("on delete set null (source_time_entry_id)"), "source-time deletion preserves company identity");
  });

  test("12. certified payroll evidence covers current federal and Ohio reporting needs", () => {
    check(hardening.includes("final_payroll"), "final certified payroll state is tracked");
    check(hardening.includes("wage_determination_snapshot"), "wage determination is snapshotted with payroll evidence");
    check(hardening.includes("worker_address"), "worker address evidence is available for Ohio payroll reporting");
    check(hardening.includes("worker_ssn_last4"), "last-four identifier evidence is available without storing a full SSN in the certified row");
    check(hardening.includes("daily_hours"), "daily hours are retained for classification and certified-payroll review");
    check(hardening.includes("gross_all_work_amount"), "all-work gross wages are represented");
    check(hardening.includes("deduction_detail"), "itemized deduction evidence is represented");
    check(hardening.includes("fringe_plan_evidence"), "bona fide fringe-plan evidence is represented");
    check(hardening.includes("statement_signature_method"), "electronic signature method is retained");
    check(hardening.includes("records_retain_until"), "records retention deadline can be recorded");
  });

  test("13. sensitive payroll reads are not open to every company member", () => {
    check(hardening.includes("prevailing_wage_worker_assignments"), "worker assignment access is hardened");
    check(hardening.includes("prevailing_wage_time_entries"), "actual wage/time access is hardened");
    check(hardening.includes("certified_payroll_worker_rows"), "certified payroll worker access is hardened");
    check(hardening.includes("public.has_company_role(company_id"), "sensitive reads require an approved company role");
  });

  console.log(`\nAP + prevailing wage contract results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exitCode = 1;
}

main();
