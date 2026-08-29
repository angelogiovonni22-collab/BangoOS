import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

const commandCenter = read("components/projects/workspace/project-command-center-foundation.tsx");
const controlDetails = read("components/projects/workspace/project-control-card-details.tsx");
const crewAssignment = read("components/crews/crew-project-assignment-panel.tsx");
const crewWorkspace = read("components/projects/workspace/project-crew-compensation-workspace.tsx");
const subcontractors = read("components/projects/workspace/project-trade-partners-workspace.tsx");
const migration = read("supabase/migrations/20260828020000_project_commitments_control_cards.sql");
const payroll = read("app/(app)/invoices/payroll/page.tsx");

assert.match(commandCenter, /label="Budget"[\s\S]*label="Crew"[\s\S]*label="Schedule"[\s\S]*label="Progress"/);
assert.match(commandCenter, /activeControl/);
assert.match(commandCenter, /data-project-control-expanded/);
assert.match(commandCenter, /aria-expanded=/);
assert.match(commandCenter, /ProjectBudgetControlDetails/);
assert.match(commandCenter, /ProjectCrewControlDetails/);
assert.match(commandCenter, /Open Full Schedule/);
assert.match(commandCenter, /View Full Progress/);
assert.match(commandCenter, /\?tab=financials/);
assert.match(commandCenter, /\/crew-costs/);
assert.match(commandCenter, /\/schedule\?project=/);
assert.match(controlDetails, /ProjectCommitmentsControl/);
assert.match(controlDetails, /ProjectCrewCompensationWorkspace/);

for (const method of ["payroll_rate", "hourly", "day_rate", "piece_rate", "lump_sum", "prevailing_wage"]) {
  assert.ok(crewAssignment.includes(method), `crew assignment must support ${method}`);
}
assert.match(crewAssignment, /save_project_labor_commitment/);
assert.match(crewAssignment, /Budget after assignment/);
assert.match(crewWorkspace, /Actual approved-time labor/);
assert.match(crewWorkspace, /Compensation & payment terms/);
assert.match(crewWorkspace, /Authorized to start/);

assert.match(subcontractors, /assignmentStatus\s*:\s*"inactive"/);
assert.match(subcontractors, /contractStatus\s*:\s*"draft"/);
assert.match(subcontractors, /Assign & Send Agreement/);
assert.match(subcontractors, /\/agreement/);
assert.match(subcontractors, /Prevailing wage project/);
assert.doesNotMatch(subcontractors, /TRADE_PARTNER_CONTRACT_STATUSES/);

assert.match(migration, /create table if not exists public\.project_labor_commitments/);
assert.match(migration, /save_project_labor_commitment/);
assert.match(migration, /protect_executed_subcontract_terms/);
assert.match(migration, /Executed subcontract terms are locked/);
assert.match(migration, /activate_cleared_subcontractor_assignment/);
assert.match(migration, /contract_status = 'signed' and new\.mobilization_status = 'cleared'/);
assert.doesNotMatch(migration, /alter table public\.payroll_employee_settings/);
assert.doesNotMatch(migration, /save_payroll_employee_compensation/);
assert.match(payroll, /save_payroll_employee_setting/);
assert.doesNotMatch(payroll, /save_payroll_employee_compensation/);

console.log("project commitments control-cards phase: ok");
