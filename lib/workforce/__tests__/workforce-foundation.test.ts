import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createWorkforceService, hasAssignmentConflict, isActiveAssignment, isActiveCrew, isActiveEmployee, isAvailableEmployee, isCurrentMembership, type WorkforceAssignmentRow } from "../index";

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

function makeAssignment(overrides: Partial<WorkforceAssignmentRow>): WorkforceAssignmentRow {
  return {
    id: "assign-1",
    company_id: "company-a",
    assignment_type: "crew",
    crew_id: "crew-a",
    employee_id: null,
    project_id: "project-a",
    phase_id: null,
    task_id: null,
    title: "Morning shift",
    description: null,
    starts_at: "2026-08-01T08:00:00.000Z",
    ends_at: "2026-08-01T12:00:00.000Z",
    planned_hours: 4,
    status: "planned",
    source_type: "manual",
    source_id: null,
    notes: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-08-01T07:00:00.000Z",
    updated_at: "2026-08-01T07:00:00.000Z",
    ...overrides,
  };
}

type StubRow = Record<string, unknown>;

type StubResponse = Record<string, StubRow[] | StubRow | null>;

function makeSupabaseStub(responses: StubResponse) {
  const calls: Array<{
    table: string;
    select?: string;
    filters: Array<[string, unknown]>;
    orders: Array<[string, boolean]>;
    maybeSingle: boolean;
  }> = [];

  const client = {
    from(table: string) {
      const call = {
        table,
        select: undefined as string | undefined,
        filters: [] as Array<[string, unknown]>,
        orders: [] as Array<[string, boolean]>,
        maybeSingle: false,
      };
      calls.push(call);

      const builder = {
        select(value: string) {
          call.select = value;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value]);
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          call.orders.push([column, options?.ascending ?? true]);
          return builder;
        },
        maybeSingle() {
          call.maybeSingle = true;
          const value = responses[table] ?? null;
          return Promise.resolve({ data: Array.isArray(value) ? (value[0] ?? null) : value, error: null });
        },
        then(onFulfilled: (value: { data: unknown; error: null }) => void, onRejected?: (reason: unknown) => void) {
          return Promise.resolve({ data: responses[table] ?? [], error: null }).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

async function main() {
  await test("1. workforce semantics stay strict and deterministic", () => {
    check(isActiveEmployee({ employment_status: "active" }), "active employee is active");
    check(!isActiveEmployee({ employment_status: "leave" }), "leave is not active employee");
    check(isAvailableEmployee({ employment_status: "active", availability_status: "available" }), "available employee requires active status and available state");
    check(!isAvailableEmployee({ employment_status: "active", availability_status: "assigned" }), "assigned employee is not available");
    check(isActiveCrew({ status: "active" }), "active crew is active");
    check(!isActiveCrew({ status: "inactive" }), "inactive crew is not active");
    check(isCurrentMembership({ status: "active", starts_on: "2026-07-01", ends_on: null }, new Date("2026-08-01T00:00:00.000Z")), "active membership with open end is current");
    check(!isCurrentMembership({ status: "planned", starts_on: "2026-07-01", ends_on: null }, new Date("2026-08-01T00:00:00.000Z")), "planned membership is not current");
    check(isActiveAssignment(makeAssignment({ status: "confirmed" })), "confirmed assignment is active");
    check(!isActiveAssignment(makeAssignment({ status: "completed" })), "completed assignment is not active");

    const overlapping = makeAssignment({ id: "assign-2", crew_id: "crew-a", starts_at: "2026-08-01T10:00:00.000Z", ends_at: "2026-08-01T14:00:00.000Z" });
    const nonOverlapping = makeAssignment({ id: "assign-3", crew_id: "crew-a", starts_at: "2026-08-01T14:00:00.000Z", ends_at: "2026-08-01T18:00:00.000Z" });

    check(hasAssignmentConflict(makeAssignment({ status: "confirmed" }), [overlapping]), "overlapping active crew assignments conflict");
    check(!hasAssignmentConflict(makeAssignment({ status: "confirmed" }), [nonOverlapping]), "non-overlapping assignments do not conflict");
    check(!hasAssignmentConflict(makeAssignment({ status: "cancelled" }), [overlapping]), "inactive assignment does not conflict");
  });

  await test("2. workforce service remains company scoped and mock free", async () => {
    const { client, calls } = makeSupabaseStub({
      employees: [{ id: "emp-1", company_id: "company-a", employee_number: "E-001", employment_status: "active", position_title: "Foreman", trade: "Concrete", supervisor_profile_id: null, primary_crew_id: null, profile_id: null, hire_date: "2024-01-01", termination_date: null, availability_status: "available", notes: null, created_by: null, updated_by: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" }],
      crews: [{ id: "crew-1", company_id: "company-a", crew_code: "CCA-01", name: "Concrete Crew Alpha", description: null, status: "active", lead_profile_id: null, supervisor_profile_id: null, home_location: null, notes: null, created_by: null, updated_by: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" }],
      crew_memberships: [{ id: "mem-1", company_id: "company-a", crew_id: "crew-1", employee_id: "emp-1", role: "Crew Lead", is_primary: true, starts_on: "2026-08-01", ends_on: null, status: "active", created_by: null, updated_by: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" }],
      workforce_assignments: [{ id: "as-1", company_id: "company-a", assignment_type: "crew", crew_id: "crew-1", employee_id: null, project_id: "project-a", phase_id: null, task_id: null, title: "Slab pour", description: null, starts_at: "2026-08-01T08:00:00.000Z", ends_at: "2026-08-01T12:00:00.000Z", planned_hours: 4, status: "planned", source_type: "schedule", source_id: "schedule-1", notes: null, created_by: null, updated_by: null, created_at: "2026-08-01T00:00:00.000Z", updated_at: "2026-08-01T00:00:00.000Z" }],
    });

    const service = createWorkforceService(client as unknown as Parameters<typeof createWorkforceService>[0]);

    const employees = await service.listEmployees("company-a");
    const crews = await service.listCrews("company-a");
    const memberships = await service.listCrewMemberships("company-a", { crewId: "crew-1", status: "active" });
    const assignments = await service.listWorkforceAssignments("company-a", { projectId: "project-a", assignmentType: "crew" });
    const employee = await service.getEmployee("company-a", "emp-1");
    const crew = await service.getCrew("company-a", "crew-1");

    check(employees.length === 1, "employee list returns stub data");
    check(crews.length === 1, "crew list returns stub data");
    check(memberships.length === 1, "membership list returns stub data");
    check(assignments.length === 1, "assignment list returns stub data");
    check(employee?.id === "emp-1", "getEmployee returns scoped record");
    check(crew?.id === "crew-1", "getCrew returns scoped record");

    check(calls.length >= 6, "service issues one scoped query per method");
    check(calls.every((call) => call.filters.some(([column, value]) => column === "company_id" && value === "company-a")), "every workforce query is company scoped");
    check(calls.find((call) => call.table === "employees")?.orders[0]?.[0] === "employee_number", "employee list ordering is deterministic");
    check(calls.find((call) => call.table === "crews")?.orders[0]?.[0] === "crew_code", "crew list ordering is deterministic");

    const serviceSource = readFileSync(resolve(__dirname, "..", "workforce-service.ts"), "utf8");
    check(!/mock-data/i.test(serviceSource), "workforce service does not fall back to mock data");
  });

  await test("3. migration captures the required workforce constraints and RLS", () => {
    const migration = readFileSync(resolve(process.cwd(), "supabase", "migrations", "20260801100000_workforce_foundation.sql"), "utf8");

    check(migration.includes("create table if not exists public.employees"), "employees table is defined");
    check(migration.includes("create table if not exists public.crews"), "crews table is defined");
    check(migration.includes("create table if not exists public.crew_memberships"), "crew memberships table is defined");
    check(migration.includes("create table if not exists public.workforce_assignments"), "workforce assignments table is defined");
    check(migration.includes("enable row level security"), "RLS is enabled for workforce tables");
    check(migration.includes("employees_company_id_employee_number_unique"), "employee number uniqueness is enforced");
    check(migration.includes("crews_company_id_crew_code_unique"), "crew code uniqueness is enforced");
    check(migration.includes("crew_memberships_company_employee_primary_active_unique"), "primary membership uniqueness is enforced");
    check(migration.includes("workforce_assignments_phase_project_company_fkey"), "phase/project composite foreign key is present");
    check(migration.includes("workforce_assignments_task_project_company_fkey"), "task/project composite foreign key is present");
    check(migration.includes("create policy employees_select"), "employee select policy exists");
    check(migration.includes("create policy crews_select"), "crew select policy exists");
    check(migration.includes("create policy crew_memberships_select"), "membership select policy exists");
    check(migration.includes("create policy workforce_assignments_select"), "assignment select policy exists");
    check(!migration.includes("create policy workforce_assignments_delete"), "delete policy is omitted by design");
  });

  await test("4. workforce foundation does not assume payroll or time entry tables", () => {
    const serviceSource = readFileSync(resolve(__dirname, "..", "workforce-service.ts"), "utf8");
    const semanticsSource = readFileSync(resolve(__dirname, "..", "workforce-semantics.ts"), "utf8");

    check(!/time_entries/i.test(serviceSource), "service does not depend on time entries");
    check(!/payroll/i.test(serviceSource), "service does not depend on payroll");
    check(!/time_entries/i.test(semanticsSource), "semantics do not depend on time entries");
    check(!/payroll/i.test(semanticsSource), "semantics do not depend on payroll");
  });

  console.log(`\nWorkforce foundation results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();