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
  await test("1. workflow events migration shape supports reusable deterministic engine", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260803133000_estimate_workflow_phase2a_foundation.sql"), "utf8").toLowerCase();

    check(migration.includes("create table if not exists public.workflow_events"), "workflow_events table exists");
    check(migration.includes("workflow_name text not null"), "workflow_name column exists");
    check(migration.includes("event_type text not null"), "event_type column exists");
    check(migration.includes("current_state text null"), "current_state column exists");
    check(migration.includes("next_state text null"), "next_state column exists");
    check(migration.includes("actor_profile_id uuid null"), "actor column exists");
    check(migration.includes("reference_entity text not null"), "reference entity column exists");
    check(migration.includes("reference_id uuid not null"), "reference id column exists");
    check(migration.includes("metadata jsonb not null default '{}'::jsonb"), "metadata column exists");
    check(migration.includes("create policy workflow_events_insert"), "workflow insert policy exists");
    check(migration.includes("create policy workflow_events_select"), "workflow select policy exists");
    check(!migration.includes("create policy workflow_events_update"), "workflow update policy omitted (append-only)");
    check(!migration.includes("create policy workflow_events_delete"), "workflow delete policy omitted (append-only)");
  });

  await test("2. workflow engine repository writes deterministic transitions", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "workflows", "workflow-engine.ts"), "utf8");

    check(source.includes("from(\"workflow_events\")"), "engine writes to workflow_events table");
    check(source.includes("workflow_name"), "engine persists workflow name");
    check(source.includes("event_type"), "engine persists event type");
    check(source.includes("current_state"), "engine persists current state");
    check(source.includes("next_state"), "engine persists next state");
    check(source.includes("actor_profile_id"), "engine persists actor profile id");
    check(source.includes("reference_entity"), "engine persists reference entity");
    check(source.includes("reference_id"), "engine persists reference id");
    check(source.includes("metadata"), "engine persists metadata");
  });

  await test("3. workflow contracts include required deterministic event set", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "workflows", "types.ts"), "utf8");

    check(source.includes("estimate.created"), "estimate.created event contract exists");
    check(source.includes("estimate.sent"), "estimate.sent event contract exists");
    check(source.includes("estimate.viewed"), "estimate.viewed event contract exists");
    check(source.includes("estimate.followup_due"), "estimate.followup_due event contract exists");
    check(source.includes("estimate.approved"), "estimate.approved event contract exists");
    check(source.includes("estimate.declined"), "estimate.declined event contract exists");
    check(source.includes("estimate.request_changes"), "estimate.request_changes event contract exists");
    check(source.includes("estimate.converted"), "estimate.converted event contract exists");
    check(source.includes("deposit.created"), "deposit.created event contract exists");
    check(source.includes("deposit.received"), "deposit.received event contract exists");
    check(source.includes("project.created"), "project.created event contract exists");
    check(source.includes("project.ready_for_scheduling"), "project.ready_for_scheduling event contract exists");
  });

  console.log(`\nWorkflow foundation phase 2A results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
