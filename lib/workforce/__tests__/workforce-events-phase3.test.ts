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
  await test("1. workforce_events migration defines durable event table with required indexes and rls", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260803110000_workforce_events.sql"), "utf8").toLowerCase();

    check(migration.includes("create table if not exists public.workforce_events"), "workforce_events table is created");
    check(migration.includes("id uuid primary key default gen_random_uuid()"), "id primary key is present");
    check(migration.includes("company_id uuid not null references public.companies(id) on delete cascade"), "company_id fk is present");
    check(migration.includes("payload jsonb not null default '{}'::jsonb"), "payload jsonb default is present");
    check(migration.includes("idx_workforce_events_company_occurred_at"), "company occurred_at index is present");
    check(migration.includes("idx_workforce_events_company_entity"), "company/entity index is present");
    check(migration.includes("idx_workforce_events_company_event_type"), "company/event_type index is present");
    check(migration.includes("alter table public.workforce_events enable row level security"), "rls is enabled");
    check(migration.includes("create policy workforce_events_select"), "select policy exists");
    check(migration.includes("create policy workforce_events_insert"), "insert policy exists");
    check(!migration.includes("create policy workforce_events_update"), "update policy is omitted (append-only)");
    check(!migration.includes("create policy workforce_events_delete"), "delete policy is omitted (append-only)");
  });

  await test("2. workforce repository emits deterministic events for each required mutation", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "workforce", "workforce-repository.ts"), "utf8");

    check(source.includes("workforce.employee.created"), "employee create event type exists");
    check(source.includes("workforce.employee.updated"), "employee update event type exists");
    check(source.includes("workforce.employee.archived"), "employee archive event type exists");
    check(source.includes("workforce.crew.created"), "crew create event type exists");
    check(source.includes("workforce.crew.updated"), "crew update event type exists");
    check(source.includes("workforce.crew_membership.added"), "crew membership add event type exists");
    check(source.includes("workforce.crew_membership.updated"), "crew membership update event type exists");
    check(source.includes("workforce.crew_membership.ended"), "crew membership end event type exists");
    check(source.includes("createWorkforceEventRepository"), "repository uses dedicated workforce event helper");
    check(source.includes("changed_fields"), "update payloads persist changed_fields only");
    check(source.includes("fields:"), "create payloads persist deterministic field snapshots");
  });

  await test("3. workforce event helper uses persisted table and no in-memory bus", () => {
    const source = readFileSync(resolve(process.cwd(), "lib", "workforce", "workforce-event-repository.ts"), "utf8");

    check(source.includes('.from("workforce_events")'), "event helper writes to workforce_events table");
    check(!source.includes("CustomEvent"), "helper does not use in-memory browser events");
    check(!source.includes("dispatchEvent"), "helper does not use in-memory event bus");
  });

  console.log(`\nWorkforce events phase 3 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
