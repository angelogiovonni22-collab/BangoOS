import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

async function main() {
  await test("1. migration defines required estimate workflow foundation tables and functions", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260803133000_estimate_workflow_phase2a_foundation.sql"), "utf8").toLowerCase();

    check(migration.includes("create table if not exists public.estimate_public_tokens"), "estimate_public_tokens table is created");
    check(migration.includes("create table if not exists public.estimate_agreement_versions"), "estimate_agreement_versions table is created");
    check(migration.includes("create table if not exists public.estimate_signatures"), "estimate_signatures table is created");
    check(migration.includes("create table if not exists public.estimate_acceptance_events"), "estimate_acceptance_events table is created");
    check(migration.includes("create table if not exists public.estimate_project_conversions"), "estimate_project_conversions table is created");
    check(migration.includes("create table if not exists public.company_project_sequences"), "company_project_sequences table is created");
    check(migration.includes("create table if not exists public.workflow_events"), "workflow_events table is created");
    check(migration.includes("create or replace function public.allocate_project_number"), "allocate_project_number function is created");
    check(migration.includes("create or replace function public.convert_estimate_to_project"), "convert_estimate_to_project function is created");
    check(migration.includes("create or replace function public.calculate_estimate_deposit"), "calculate_estimate_deposit function is created");
    check(migration.includes("create or replace function public.validate_estimate_public_token"), "validate_estimate_public_token function is created");
  });

  await test("2. migration enforces append-only and company-scoped behavior", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260803133000_estimate_workflow_phase2a_foundation.sql"), "utf8").toLowerCase();

    check(migration.includes("alter table public.estimate_signatures enable row level security"), "estimate_signatures uses rls");
    check(migration.includes("alter table public.estimate_acceptance_events enable row level security"), "estimate_acceptance_events uses rls");
    check(migration.includes("alter table public.workflow_events enable row level security"), "workflow_events uses rls");
    check(migration.includes("create policy estimate_signatures_insert"), "signature insert policy exists");
    check(migration.includes("create policy estimate_signatures_select"), "signature select policy exists");
    check(!migration.includes("create policy estimate_signatures_update"), "signature update policy omitted (append-only)");
    check(!migration.includes("create policy estimate_signatures_delete"), "signature delete policy omitted (append-only)");
    check(!migration.includes("create policy estimate_acceptance_events_update"), "acceptance update policy omitted (append-only)");
    check(!migration.includes("create policy estimate_acceptance_events_delete"), "acceptance delete policy omitted (append-only)");
    check(!migration.includes("create policy workflow_events_update"), "workflow event update policy omitted (append-only)");
    check(!migration.includes("create policy workflow_events_delete"), "workflow event delete policy omitted (append-only)");
  });

  await test("3. estimate workflow service exposes required production contracts", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "estimates", "workflow-service.ts"), "utf8");

    check(source.includes("async function approveEstimate"), "approveEstimate contract exists");
    check(source.includes("async function declineEstimate"), "declineEstimate contract exists");
    check(source.includes("async function requestChanges"), "requestChanges contract exists");
    check(source.includes("async function generatePublicToken"), "generatePublicToken contract exists");
    check(source.includes("async function validatePublicToken"), "validatePublicToken contract exists");
    check(source.includes("async function generateAgreementSnapshot"), "generateAgreementSnapshot contract exists");
    check(source.includes("async function storeSignature"), "storeSignature contract exists");
    check(source.includes("async function storeAcceptance"), "storeAcceptance contract exists");
    check(source.includes("async function convertEstimateToProject"), "convertEstimateToProject contract exists");
    check(source.includes("async function calculateDeposit"), "calculateDeposit contract exists");
    check(source.includes("async function createDepositInvoice"), "createDepositInvoice contract exists");
    check(source.includes("async function getConversionResult"), "return conversion result contract exists");
  });

  await test("4. workflow emits deterministic required events", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "estimates", "workflow-service.ts"), "utf8");

    check(source.includes("estimate.approved"), "estimate.approved event emitted");
    check(source.includes("estimate.declined"), "estimate.declined event emitted");
    check(source.includes("estimate.request_changes"), "estimate.request_changes event emitted");
    check(source.includes("deposit.created"), "deposit.created event emitted");

    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260803133000_estimate_workflow_phase2a_foundation.sql"), "utf8");
    check(migration.includes("estimate.converted"), "estimate.converted event persisted via migration function");
    check(migration.includes("project.created"), "project.created event persisted via migration function");
    check(migration.includes("project.ready_for_scheduling"), "project.ready_for_scheduling event persisted via migration function");
    check(migration.includes("deposit.created"), "deposit.created event persisted via migration function");
  });

  await test("5. idempotency protections exist for signatures and conversions", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260803133000_estimate_workflow_phase2a_foundation.sql"), "utf8").toLowerCase();

    check(migration.includes("estimate_signatures_company_estimate_idempotency_unique"), "signature idempotency unique constraint exists");
    check(migration.includes("estimate_project_conversions_company_idempotency_unique"), "conversion idempotency unique constraint exists");
    check(migration.includes("estimate_project_conversions_company_estimate_unique"), "single conversion per estimate unique constraint exists");
    check(migration.includes("idx_estimate_acceptance_events_company_estimate_idempotency"), "acceptance idempotency unique index exists");

    const source = readFileSync(resolve(process.cwd(), "lib", "estimates", "workflow-service.ts"), "utf8");
    check(source.includes("existingByKey"), "service checks signature idempotency before insert");
    check(source.includes("getConversionResult"), "service can return prior conversion result");
  });

  console.log(`\nEstimate workflow phase 2A results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
