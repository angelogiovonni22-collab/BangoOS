import {
  createWorkforceIntelligenceService,
  normalizeAssignmentViews,
  type WorkforceIntelligenceEvaluationInput,
  type WorkforceAssignmentRow,
  type WorkforceCrewRow,
  type WorkforceEmployeeRow,
  type WorkforceMembershipRow,
  type WorkforcePhaseRow,
  type WorkforceProfileRow,
  type WorkforceProjectRow,
  type WorkforceTaskRow,
} from "../index";
import { evaluateWorkforceSignals } from "../intelligence/workforce-signal-evaluator";
import { normalizeWorkforceFindings } from "../intelligence/workforce-finding-normalizer";
import type { WorkforceSignal } from "../intelligence/workforce-intelligence-types";

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

function employee(overrides: Partial<WorkforceEmployeeRow> & Pick<WorkforceEmployeeRow, "id" | "company_id" | "employee_number">): WorkforceEmployeeRow {
  return {
    id: overrides.id,
    company_id: overrides.company_id,
    profile_id: overrides.profile_id ?? null,
    employee_number: overrides.employee_number,
    employment_status: overrides.employment_status ?? "active",
    position_title: overrides.position_title ?? "Field Tech",
    trade: overrides.trade ?? null,
    supervisor_profile_id: overrides.supervisor_profile_id ?? null,
    primary_crew_id: overrides.primary_crew_id ?? null,
    hire_date: overrides.hire_date ?? "2024-01-01",
    termination_date: overrides.termination_date ?? null,
    availability_status: overrides.availability_status ?? "available",
    notes: overrides.notes ?? null,
    created_by: overrides.created_by ?? null,
    updated_by: overrides.updated_by ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-02T00:00:00.000Z",
  };
}

function crew(overrides: Partial<WorkforceCrewRow> & Pick<WorkforceCrewRow, "id" | "company_id" | "crew_code" | "name">): WorkforceCrewRow {
  return {
    id: overrides.id,
    company_id: overrides.company_id,
    crew_code: overrides.crew_code,
    name: overrides.name,
    description: overrides.description ?? null,
    status: overrides.status ?? "active",
    lead_profile_id: overrides.lead_profile_id === undefined ? "lead-a" : overrides.lead_profile_id,
    supervisor_profile_id: overrides.supervisor_profile_id === undefined ? "sup-a" : overrides.supervisor_profile_id,
    home_location: overrides.home_location ?? null,
    notes: overrides.notes ?? null,
    created_by: overrides.created_by ?? null,
    updated_by: overrides.updated_by ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-02T00:00:00.000Z",
  };
}

function membership(overrides: Partial<WorkforceMembershipRow> & Pick<WorkforceMembershipRow, "id" | "company_id" | "crew_id" | "employee_id" | "role">): WorkforceMembershipRow {
  return {
    id: overrides.id,
    company_id: overrides.company_id,
    crew_id: overrides.crew_id,
    employee_id: overrides.employee_id,
    role: overrides.role,
    is_primary: overrides.is_primary ?? false,
    starts_on: overrides.starts_on ?? "2026-01-01",
    ends_on: overrides.ends_on ?? null,
    status: overrides.status ?? "active",
    created_by: overrides.created_by ?? null,
    updated_by: overrides.updated_by ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-02T00:00:00.000Z",
  };
}

function assignment(overrides: Partial<WorkforceAssignmentRow> & Pick<WorkforceAssignmentRow, "id" | "company_id" | "assignment_type" | "project_id" | "title" | "starts_at" | "ends_at">): WorkforceAssignmentRow {
  return {
    id: overrides.id,
    company_id: overrides.company_id,
    assignment_type: overrides.assignment_type,
    crew_id: overrides.crew_id ?? null,
    employee_id: overrides.employee_id ?? null,
    project_id: overrides.project_id,
    phase_id: overrides.phase_id ?? null,
    task_id: overrides.task_id ?? null,
    title: overrides.title,
    description: overrides.description ?? null,
    starts_at: overrides.starts_at,
    ends_at: overrides.ends_at,
    planned_hours: overrides.planned_hours ?? 4,
    status: overrides.status ?? "planned",
    source_type: overrides.source_type ?? "manual",
    source_id: overrides.source_id ?? null,
    notes: overrides.notes ?? null,
    created_by: overrides.created_by ?? null,
    updated_by: overrides.updated_by ?? null,
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
    updated_at: overrides.updated_at ?? "2026-01-02T00:00:00.000Z",
  };
}

type EvalInput = WorkforceIntelligenceEvaluationInput;

function inputFactory(overrides: Partial<EvalInput> = {}): EvalInput {
  const base = baseInput();
  return {
    ...base,
    ...overrides,
    now: overrides.now ?? base.now,
    freshness: {
      ...(base.freshness ?? {}),
      ...(overrides.freshness ?? {}),
    },
    availability: {
      ...base.availability,
      ...(overrides.availability ?? {}),
    },
  };
}

function baseInput(): EvalInput {
  const employees: WorkforceEmployeeRow[] = [
    employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001", profile_id: "prof-a1", primary_crew_id: "crew-a1" }),
    employee({ id: "emp-a2", company_id: "company-a", employee_number: "E-002", profile_id: "prof-a2" }),
    employee({ id: "emp-b1", company_id: "company-b", employee_number: "B-001", profile_id: "prof-b1" }),
  ];

  const crews: WorkforceCrewRow[] = [
    crew({ id: "crew-a1", company_id: "company-a", crew_code: "CA-1", name: "Crew Alpha" }),
    crew({ id: "crew-a2", company_id: "company-a", crew_code: "CA-2", name: "Crew Bravo", lead_profile_id: null, supervisor_profile_id: null }),
    crew({ id: "crew-b1", company_id: "company-b", crew_code: "CB-1", name: "Crew B" }),
  ];

  const memberships: WorkforceMembershipRow[] = [
    membership({ id: "mem-a1", company_id: "company-a", crew_id: "crew-a1", employee_id: "emp-a1", role: "Lead", is_primary: true }),
    membership({ id: "mem-b1", company_id: "company-b", crew_id: "crew-b1", employee_id: "emp-b1", role: "Lead", is_primary: true }),
  ];

  const assignments: WorkforceAssignmentRow[] = [
    assignment({
      id: "as-a1",
      company_id: "company-a",
      assignment_type: "employee",
      employee_id: "emp-a1",
      project_id: "proj-a1",
      title: "Pour prep",
      starts_at: "2026-08-01T08:00:00.000Z",
      ends_at: "2026-08-01T12:00:00.000Z",
      status: "confirmed",
    }),
    assignment({
      id: "as-b1",
      company_id: "company-b",
      assignment_type: "employee",
      employee_id: "emp-b1",
      project_id: "proj-b1",
      title: "B shift",
      starts_at: "2026-08-01T08:00:00.000Z",
      ends_at: "2026-08-01T12:00:00.000Z",
      status: "confirmed",
    }),
  ];

  const projects: WorkforceProjectRow[] = [
    { id: "proj-a1", name: "Project A" },
    { id: "proj-b1", name: "Project B" },
  ];

  const phases: WorkforcePhaseRow[] = [
    { id: "phase-a1", project_id: "proj-a1", name: "Phase A" },
  ];

  const tasks: WorkforceTaskRow[] = [
    { id: "task-a1", project_id: "proj-a1", phase_id: "phase-a1", title: "Task A" },
  ];

  const profiles: WorkforceProfileRow[] = [
    { id: "prof-a1", first_name: "Alex", last_name: "Stone" },
    { id: "prof-a2", first_name: "Riley", last_name: "Fox" },
    { id: "prof-b1", first_name: "Blake", last_name: "North" },
    { id: "lead-a", first_name: "Casey", last_name: "Lead" },
    { id: "sup-a", first_name: "Jordan", last_name: "Supervisor" },
  ];

  return {
    companyId: "company-a",
    employees,
    crews,
    memberships,
    assignments,
    projects,
    phases,
    tasks,
    profiles,
    now: new Date("2026-08-01T09:00:00.000Z"),
    availability: {
      projects: "live",
      phases: "live",
      tasks: "live",
      profiles: "live",
    },
  };
}

function findSignalTypes(input = baseInput()) {
  return evaluateWorkforceSignals(input).signals.map((signal) => signal.type);
}

function signalsByType(type: string, input = baseInput()) {
  return evaluateWorkforceSignals(input).signals.filter((signal) => signal.type === type);
}

function findingsFromInput(input = baseInput()) {
  return normalizeWorkforceFindings({
    companyId: input.companyId,
    signals: evaluateWorkforceSignals(input).signals,
  });
}

function makeSupabaseStub(
  rowsByTable: Record<string, Array<Record<string, unknown>>>,
  failTables: Set<string> = new Set(),
) {
  const client = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const orders: Array<{ column: string; ascending: boolean }> = [];

      const run = () => {
        const rows = rowsByTable[table] ?? [];
        const filtered = rows.filter((row) => filters.every(([column, value]) => row[column] === value));
        return [...filtered].sort((left, right) => {
          for (const order of orders) {
            const a = left[order.column];
            const b = right[order.column];
            if (a === b) {
              continue;
            }

            if (a == null) {
              return order.ascending ? -1 : 1;
            }

            if (b == null) {
              return order.ascending ? 1 : -1;
            }

            if (a < b) {
              return order.ascending ? -1 : 1;
            }

            if (a > b) {
              return order.ascending ? 1 : -1;
            }
          }

          return 0;
        });
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          filters.push([column, value]);
          return builder;
        },
        order(column: string, options?: { ascending?: boolean }) {
          orders.push({ column, ascending: options?.ascending ?? true });
          return builder;
        },
        then(onFulfilled: (value: { data: unknown; error: unknown }) => unknown, onRejected?: (reason: unknown) => unknown) {
          if (failTables.has(table)) {
            return Promise.resolve({ data: null, error: new Error(`${table} unavailable`) }).then(onFulfilled, onRejected);
          }

          return Promise.resolve({ data: run(), error: null }).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return client;
}

async function main() {
  await test("1. active employee without assignment is detected", () => {
    const types = findSignalTypes();
    check(types.includes("ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT"), "active unassigned employee is flagged");
  });

  await test("2. active crew without assignment is detected", () => {
    const types = findSignalTypes();
    check(types.includes("ACTIVE_CREW_WITHOUT_ASSIGNMENT"), "active crew without assignment is flagged");
  });

  await test("3. employee assignment overlap is detected", () => {
    const input = inputFactory({
      assignments: [
        ...baseInput().assignments,
        assignment({
          id: "as-ov-1",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          title: "Overlap one",
          starts_at: "2026-08-01T10:00:00.000Z",
          ends_at: "2026-08-01T13:00:00.000Z",
          status: "confirmed",
        }),
      ],
    });

    const types = findSignalTypes(input);
    check(types.includes("EMPLOYEE_ASSIGNMENT_OVERLAP"), "employee overlap is flagged");

    const touchingInput = inputFactory({
      assignments: [
        assignment({
          id: "as-touch-1",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          title: "Touch left",
          starts_at: "2026-08-01T08:00:00.000Z",
          ends_at: "2026-08-01T10:00:00.000Z",
          status: "confirmed",
        }),
        assignment({
          id: "as-touch-2",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          title: "Touch right",
          starts_at: "2026-08-01T10:00:00.000Z",
          ends_at: "2026-08-01T12:00:00.000Z",
          status: "planned",
        }),
      ],
    });

    check(signalsByType("EMPLOYEE_ASSIGNMENT_OVERLAP", touchingInput).length === 0, "touching boundaries do not count as overlap");

    const excludedInput = inputFactory({
      assignments: [
        assignment({
          id: "as-live",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          title: "Live",
          starts_at: "2026-08-01T08:00:00.000Z",
          ends_at: "2026-08-01T12:00:00.000Z",
          status: "confirmed",
        }),
        assignment({
          id: "as-cancelled",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          title: "Cancelled",
          starts_at: "2026-08-01T09:00:00.000Z",
          ends_at: "2026-08-01T11:00:00.000Z",
          status: "cancelled",
        }),
        assignment({
          id: "as-completed",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          title: "Completed",
          starts_at: "2026-08-01T09:00:00.000Z",
          ends_at: "2026-08-01T11:00:00.000Z",
          status: "completed",
        }),
      ],
    });

    check(signalsByType("EMPLOYEE_ASSIGNMENT_OVERLAP", excludedInput).length === 0, "cancelled and completed assignments are excluded from overlap");
  });

  await test("4. crew assignment overlap is detected", () => {
    const input = inputFactory({
      assignments: [
        ...baseInput().assignments,
        assignment({
          id: "as-c1",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew overlap one",
          starts_at: "2026-08-01T08:00:00.000Z",
          ends_at: "2026-08-01T12:00:00.000Z",
          status: "confirmed",
        }),
        assignment({
          id: "as-c2",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew overlap two",
          starts_at: "2026-08-01T11:00:00.000Z",
          ends_at: "2026-08-01T14:00:00.000Z",
          status: "planned",
        }),
      ],
    });

    const types = findSignalTypes(input);
    check(types.includes("CREW_ASSIGNMENT_OVERLAP"), "crew overlap is flagged");

    const excludedInput = inputFactory({
      assignments: [
        assignment({
          id: "crew-live",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew live",
          starts_at: "2026-08-01T08:00:00.000Z",
          ends_at: "2026-08-01T12:00:00.000Z",
          status: "confirmed",
        }),
        assignment({
          id: "crew-cancelled",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew cancelled",
          starts_at: "2026-08-01T09:00:00.000Z",
          ends_at: "2026-08-01T11:00:00.000Z",
          status: "cancelled",
        }),
      ],
    });

    check(signalsByType("CREW_ASSIGNMENT_OVERLAP", excludedInput).length === 0, "cancelled assignments are excluded from crew overlap");
  });

  await test("5. employee without active crew is detected", () => {
    const types = findSignalTypes();
    check(types.includes("EMPLOYEE_WITHOUT_ACTIVE_CREW"), "employee without active membership is flagged");

    const coveredByIntersectingCrewAssignment = inputFactory({
      assignments: [
        assignment({
          id: "crew-cover-1",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew cover",
          starts_at: "2026-08-01T08:00:00.000Z",
          ends_at: "2026-08-01T12:00:00.000Z",
          status: "confirmed",
        }),
      ],
      employees: [
        employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001", profile_id: "prof-a1" }),
      ],
      memberships: [
        membership({
          id: "mem-a1",
          company_id: "company-a",
          crew_id: "crew-a1",
          employee_id: "emp-a1",
          role: "Field",
          status: "active",
          starts_on: "2026-07-01",
          ends_on: null,
        }),
      ],
    });

    check(
      !findSignalTypes(coveredByIntersectingCrewAssignment).includes("ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT"),
      "intersecting membership and crew assignment suppress unassigned-employee finding",
    );

    const membershipEndsBeforeAssignment = inputFactory({
      assignments: [
        assignment({
          id: "crew-cover-2",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew after membership",
          starts_at: "2026-08-10T08:00:00.000Z",
          ends_at: "2026-08-10T12:00:00.000Z",
          status: "planned",
        }),
      ],
      employees: [employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001" })],
      memberships: [
        membership({
          id: "mem-a2",
          company_id: "company-a",
          crew_id: "crew-a1",
          employee_id: "emp-a1",
          role: "Field",
          status: "active",
          starts_on: "2026-07-01",
          ends_on: "2026-08-09",
        }),
      ],
    });

    check(
      findSignalTypes(membershipEndsBeforeAssignment).includes("ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT"),
      "membership ending before assignment start does not count as coverage",
    );

    const membershipStartsAfterAssignment = inputFactory({
      assignments: [
        assignment({
          id: "crew-cover-3",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Crew before membership",
          starts_at: "2026-08-05T08:00:00.000Z",
          ends_at: "2026-08-05T12:00:00.000Z",
          status: "planned",
        }),
      ],
      employees: [employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001" })],
      memberships: [
        membership({
          id: "mem-a3",
          company_id: "company-a",
          crew_id: "crew-a1",
          employee_id: "emp-a1",
          role: "Field",
          status: "planned",
          starts_on: "2026-08-06",
          ends_on: null,
        }),
      ],
    });

    check(
      findSignalTypes(membershipStartsAfterAssignment).includes("ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT"),
      "membership starting after assignment end does not count as coverage",
    );

    const touchingBoundaryCoverage = inputFactory({
      assignments: [
        assignment({
          id: "crew-cover-4",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Boundary touch",
          starts_at: "2026-08-05T08:00:00.000Z",
          ends_at: "2026-08-05T12:00:00.000Z",
          status: "planned",
        }),
      ],
      employees: [employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001" })],
      memberships: [
        membership({
          id: "mem-a4",
          company_id: "company-a",
          crew_id: "crew-a1",
          employee_id: "emp-a1",
          role: "Field",
          status: "active",
          starts_on: "2026-07-01",
          ends_on: "2026-08-05",
        }),
      ],
    });

    check(
      !findSignalTypes(touchingBoundaryCoverage).includes("ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT"),
      "touching membership and assignment boundaries count as coverage",
    );
  });

  await test("6. crew without active lead is detected", () => {
    const types = findSignalTypes();
    check(types.includes("CREW_WITHOUT_ACTIVE_LEAD"), "active crew with no lead/supervisor is flagged");
  });

  await test("7. assignment missing project context is detected", () => {
    const input = inputFactory({
      projects: [{ id: "proj-a1", name: "Project A" }],
      assignments: [
        ...baseInput().assignments,
        assignment({
          id: "as-mp",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-missing",
          title: "Unknown project ref",
          starts_at: "2026-08-02T08:00:00.000Z",
          ends_at: "2026-08-02T12:00:00.000Z",
        }),
      ],
    });

    const types = findSignalTypes(input);
    check(types.includes("ASSIGNMENT_MISSING_PROJECT_CONTEXT"), "assignment missing project context is flagged");

    const unavailableProjectContextInput = inputFactory({
      availability: {
        projects: "unavailable",
        phases: "live",
        tasks: "live",
        profiles: "live",
      },
      projects: [],
      assignments: [
        assignment({
          id: "as-unavailable-project-context",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-unavailable",
          title: "Project context unavailable",
          starts_at: "2026-08-02T08:00:00.000Z",
          ends_at: "2026-08-02T12:00:00.000Z",
        }),
      ],
    });

    const unavailableResult = evaluateWorkforceSignals(unavailableProjectContextInput);
    check(
      !unavailableResult.signals.some((signal) => signal.type === "ASSIGNMENT_MISSING_PROJECT_CONTEXT"),
      "unavailable project context does not emit false missing-project fact",
    );
    check(
      unavailableResult.limitations.some((limitation) => limitation.code === "PROJECT_CONTEXT_UNAVAILABLE"),
      "unavailable project context is represented as a limitation",
    );
  });

  await test("8. unresolved workforce relationships are detected", () => {
    const input = inputFactory({
      employees: [
        employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001", primary_crew_id: "crew-missing" }),
      ],
      assignments: [
        assignment({
          id: "as-rt",
          company_id: "company-a",
          assignment_type: "employee",
          employee_id: "emp-a1",
          project_id: "proj-a1",
          phase_id: "phase-missing",
          task_id: "task-missing",
          title: "Missing relations",
          starts_at: "2026-08-02T08:00:00.000Z",
          ends_at: "2026-08-02T12:00:00.000Z",
        }),
      ],
    });

    const types = findSignalTypes(input);
    check(types.includes("INCOMPLETE_WORKFORCE_RELATIONSHIP"), "incomplete relationships are flagged");
  });

  await test("9. stale records are detected", () => {
    const input = inputFactory({
      now: new Date("2026-08-01T09:00:00.000Z"),
      freshness: { workforceRecordStaleAfterHours: 24 },
      employees: [
        employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001", updated_at: "2026-07-20T00:00:00.000Z" }),
      ],
      crews: [crew({ id: "crew-a1", company_id: "company-a", crew_code: "CA-1", name: "Crew Alpha", updated_at: "2026-07-20T00:00:00.000Z" })],
      memberships: [membership({ id: "mem-a1", company_id: "company-a", crew_id: "crew-a1", employee_id: "emp-a1", role: "Lead", updated_at: "2026-07-20T00:00:00.000Z" })],
      assignments: [assignment({ id: "as-a1", company_id: "company-a", assignment_type: "employee", employee_id: "emp-a1", project_id: "proj-a1", title: "Stale", starts_at: "2026-08-01T08:00:00.000Z", ends_at: "2026-08-01T12:00:00.000Z", updated_at: "2026-07-20T00:00:00.000Z" })],
    });

    const types = findSignalTypes(input);
    check(types.includes("STALE_WORKFORCE_RECORD"), "stale record finding is emitted");
    check(types.includes("WORKFORCE_CONDITION_UNVERIFIABLE_STALE_DATA"), "workspace staleness limitation signal is emitted");
  });

  await test("10. upcoming assignment without staffing is detected", () => {
    const input = inputFactory({
      memberships: [],
      assignments: [
        assignment({
          id: "as-up-staff",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Upcoming unstaffed",
          starts_at: "2026-08-05T08:00:00.000Z",
          ends_at: "2026-08-05T12:00:00.000Z",
          status: "planned",
        }),
      ],
    });

    const types = findSignalTypes(input);
    check(types.includes("UPCOMING_ASSIGNMENT_WITHOUT_STAFFING"), "upcoming crew assignment without staffing is flagged");
  });

  await test("11. deterministic sorting is stable by severity and type", () => {
    const input = inputFactory({
      assignments: [
        assignment({ id: "a1", company_id: "company-a", assignment_type: "crew", crew_id: "crew-a1", project_id: "proj-a1", title: "Overlap A", starts_at: "2026-08-01T08:00:00.000Z", ends_at: "2026-08-01T12:00:00.000Z", status: "planned" }),
        assignment({ id: "a2", company_id: "company-a", assignment_type: "crew", crew_id: "crew-a1", project_id: "proj-a1", title: "Overlap B", starts_at: "2026-08-01T10:00:00.000Z", ends_at: "2026-08-01T14:00:00.000Z", status: "confirmed" }),
      ],
    });

    const signals = evaluateWorkforceSignals(input).signals;
    const findings = normalizeWorkforceFindings({ companyId: "company-a", signals });
    check(findings.length > 0, "findings are produced");
    if (findings.length > 1) {
      check(["critical", "high", "medium", "low"].indexOf(findings[0].severity) <= ["critical", "high", "medium", "low"].indexOf(findings[1].severity), "severity ordering is deterministic");
    }
  });

  await test("12. deduplication removes duplicate finding keys", () => {
    const input = inputFactory({
      assignments: [
        assignment({ id: "dup-1", company_id: "company-a", assignment_type: "crew", crew_id: "crew-a1", project_id: "proj-a1", title: "Dup A", starts_at: "2026-08-01T08:00:00.000Z", ends_at: "2026-08-01T12:00:00.000Z", status: "planned" }),
        assignment({ id: "dup-2", company_id: "company-a", assignment_type: "crew", crew_id: "crew-a1", project_id: "proj-a1", title: "Dup B", starts_at: "2026-08-01T08:00:00.000Z", ends_at: "2026-08-01T12:00:00.000Z", status: "planned" }),
      ],
    });

    const signals = evaluateWorkforceSignals(input).signals;
    const findings = normalizeWorkforceFindings({ companyId: "company-a", signals });
    const ids = new Set(findings.map((finding) => finding.id));
    check(ids.size === findings.length, "finding ids are unique after dedupe");
  });

  await test("13. company isolation keeps findings scoped", () => {
    const input = baseInput();
    const result = evaluateWorkforceSignals(input);

    const employeeIds = new Set(input.employees.filter((item) => item.company_id === input.companyId).map((item) => item.id));
    const crewIds = new Set(input.crews.filter((item) => item.company_id === input.companyId).map((item) => item.id));
    const membershipIds = new Set(input.memberships.filter((item) => item.company_id === input.companyId).map((item) => item.id));
    const assignmentIds = new Set(input.assignments.filter((item) => item.company_id === input.companyId).map((item) => item.id));

    const foreignEntity = result.signals
      .flatMap((signal) => signal.affectedEntities)
      .find((entity) => {
        if (entity.entityType === "employee") {
          return !employeeIds.has(entity.entityId);
        }

        if (entity.entityType === "crew") {
          return !crewIds.has(entity.entityId);
        }

        if (entity.entityType === "membership") {
          return !membershipIds.has(entity.entityId);
        }

        if (entity.entityType === "assignment") {
          return !assignmentIds.has(entity.entityId);
        }

        return false;
      });

    check(!foreignEntity, "affected entities are constrained to the evaluated company");
  });

  await test("14. partial-data behavior returns findings plus limitations", () => {
    const input = inputFactory({
      availability: {
        projects: "unavailable",
        phases: "unavailable",
        tasks: "unavailable",
        profiles: "live",
      },
      projects: [],
      phases: [],
      tasks: [],
    });

    const result = evaluateWorkforceSignals(input);
    check(result.signals.length > 0, "signals still return under partial data");
    check(result.partialNotices.length >= 1, "partial notices are returned");
    check(result.limitations.length >= 1, "limitations are returned");
  });

  await test("15. no unsupported data fabrication is introduced", () => {
    const input = inputFactory({
      employees: [employee({ id: "emp-a-no-facts", company_id: "company-a", employee_number: "E-100", employment_status: "active" })],
      crews: [crew({ id: "crew-a-no-facts", company_id: "company-a", crew_code: "CA-100", name: "No Facts Crew" })],
      memberships: [],
      assignments: [],
      projects: [{ id: "proj-a1", name: "Project A" }],
      phases: [],
      tasks: [],
      profiles: [],
    });

    const findings = findingsFromInput(input);
    const allowedTypes = new Set([
      "ACTIVE_EMPLOYEE_WITHOUT_ASSIGNMENT",
      "ACTIVE_CREW_WITHOUT_ASSIGNMENT",
      "EMPLOYEE_ASSIGNMENT_OVERLAP",
      "CREW_ASSIGNMENT_OVERLAP",
      "EMPLOYEE_WITHOUT_ACTIVE_CREW",
      "CREW_WITHOUT_ACTIVE_LEAD",
      "ASSIGNMENT_MISSING_PROJECT_CONTEXT",
      "ASSIGNMENT_MISSING_REQUIRED_ENTITY",
      "STALE_WORKFORCE_RECORD",
      "INCOMPLETE_WORKFORCE_RELATIONSHIP",
      "UPCOMING_ASSIGNMENT_WITHOUT_STAFFING",
      "WORKFORCE_CONDITION_UNVERIFIABLE_STALE_DATA",
    ]);

    const hasUnsupportedType = findings.some((finding) => !allowedTypes.has(finding.type));
    check(!hasUnsupportedType, "findings stay within the deterministic supported type list");
  });

  await test("16. stable IDs persist across different evaluation timestamps", () => {
    const early = inputFactory({ now: new Date("2026-08-01T09:00:00.000Z") });
    const late = inputFactory({ now: new Date("2026-08-01T10:00:00.000Z") });

    const earlySignals = evaluateWorkforceSignals(early).signals;
    const lateSignals = evaluateWorkforceSignals(late).signals;

    const earlySignalIds = [...earlySignals.map((signal) => signal.id)].sort();
    const lateSignalIds = [...lateSignals.map((signal) => signal.id)].sort();
    check(JSON.stringify(earlySignalIds) === JSON.stringify(lateSignalIds), "signal IDs remain stable across evaluation timestamps when facts are unchanged");

    const earlyFindingIds = [...normalizeWorkforceFindings({ companyId: early.companyId, signals: earlySignals }).map((finding) => finding.id)].sort();
    const lateFindingIds = [...normalizeWorkforceFindings({ companyId: late.companyId, signals: lateSignals }).map((finding) => finding.id)].sort();
    check(JSON.stringify(earlyFindingIds) === JSON.stringify(lateFindingIds), "finding IDs remain stable across evaluation timestamps when facts are unchanged");
  });

  await test("17. different conditions produce different IDs", () => {
    const base = inputFactory({
      employees: [employee({ id: "emp-a1", company_id: "company-a", employee_number: "E-001" })],
      crews: [crew({ id: "crew-a1", company_id: "company-a", crew_code: "CA-1", name: "Crew Alpha" })],
      memberships: [],
      assignments: [],
    });
    const changed = inputFactory({
      employees: base.employees,
      crews: base.crews,
      memberships: [membership({ id: "mem-a1", company_id: "company-a", crew_id: "crew-a1", employee_id: "emp-a1", role: "Field", status: "active" })],
      assignments: [
        assignment({
          id: "as-cover",
          company_id: "company-a",
          assignment_type: "crew",
          crew_id: "crew-a1",
          project_id: "proj-a1",
          title: "Coverage",
          starts_at: "2026-08-01T08:00:00.000Z",
          ends_at: "2026-08-01T12:00:00.000Z",
          status: "confirmed",
        }),
      ],
    });

    const baseIds = new Set(evaluateWorkforceSignals(base).signals.map((signal) => signal.id));
    const changedIds = new Set(evaluateWorkforceSignals(changed).signals.map((signal) => signal.id));
    const hasDifference = [...baseIds].some((id) => !changedIds.has(id)) || [...changedIds].some((id) => !baseIds.has(id));
    check(hasDifference, "different conditions yield different signal identity sets");
  });

  await test("18. canonical assignment buckets remain unchanged", () => {
    const input = baseInput();
    const views = normalizeAssignmentViews({
      assignments: [
        assignment({ id: "current", company_id: "company-a", assignment_type: "employee", employee_id: "emp-a1", project_id: "proj-a1", title: "Current", starts_at: "2026-08-01T08:00:00.000Z", ends_at: "2026-08-01T12:00:00.000Z", status: "confirmed" }),
        assignment({ id: "upcoming", company_id: "company-a", assignment_type: "employee", employee_id: "emp-a1", project_id: "proj-a1", title: "Upcoming", starts_at: "2026-08-02T08:00:00.000Z", ends_at: "2026-08-02T12:00:00.000Z", status: "planned" }),
        assignment({ id: "completed", company_id: "company-a", assignment_type: "employee", employee_id: "emp-a1", project_id: "proj-a1", title: "Completed", starts_at: "2026-07-31T08:00:00.000Z", ends_at: "2026-07-31T12:00:00.000Z", status: "completed" }),
      ],
      crews: input.crews.filter((item) => item.company_id === "company-a"),
      employees: input.employees.filter((item) => item.company_id === "company-a"),
      projects: input.projects,
      phases: input.phases,
      tasks: input.tasks,
      profiles: input.profiles,
      now: input.now,
    });

    check(views.find((view) => view.id === "current")?.bucket === "current", "current bucket stays canonical");
    check(views.find((view) => view.id === "upcoming")?.bucket === "upcoming", "upcoming bucket stays canonical");
    check(views.find((view) => view.id === "completed")?.bucket === "completed", "completed bucket stays canonical");
  });

  await test("19. service layer preserves partial-data behavior", async () => {
    const fixture = baseInput();
    const rowsByTable: Record<string, Array<Record<string, unknown>>> = {
      employees: fixture.employees,
      crews: fixture.crews,
      crew_memberships: fixture.memberships,
      workforce_assignments: fixture.assignments,
      projects: fixture.projects,
      project_phases: fixture.phases,
      tasks: fixture.tasks,
      profiles: fixture.profiles,
    };

    const supabase = makeSupabaseStub(rowsByTable, new Set(["projects"]));
    const service = createWorkforceIntelligenceService(supabase as unknown as Parameters<typeof createWorkforceIntelligenceService>[0]);
    const result = await service.evaluateCompany("company-a", { now: new Date("2026-08-01T09:00:00.000Z") });

    check(result.signals.length > 0, "service returns signals with optional table failure");
    check(result.partialNotices.some((notice) => notice.toLowerCase().includes("project")), "service emits project partial notice");
    check(result.findings.length > 0, "service still returns findings");
  });

  await test("20. dedupe collision precedence favors severity then evidence then confidence", () => {
    const baseSignal = {
      companyId: "company-a",
      domain: "workforce" as const,
      detectedAt: "2026-08-01T00:00:00.000Z",
      affectedEntities: [{ entityType: "assignment" as const, entityId: "as-1", displayName: "A1" }],
      dataFreshness: {
        staleThresholdHours: 336,
        isStale: false,
        latestUpdatedAt: "2026-08-01T00:00:00.000Z",
        evaluatedAt: "2026-08-01T01:00:00.000Z",
      },
      dataCompleteness: {
        isComplete: true,
        missingFields: [],
        missingRelationships: [],
      },
      ruleId: "workforce.test",
      ruleVersion: "2.0.0",
    };

    const lowHighConfidence: WorkforceSignal = {
      ...baseSignal,
      id: "signal-low",
      type: "ASSIGNMENT_MISSING_PROJECT_CONTEXT",
      category: "data_quality",
      severity: "medium",
      confidence: 0.99,
      evidence: {
        assignmentStartsAt: "2026-08-05T08:00:00.000Z",
        detail: "small",
      },
    };

    const highLowerConfidence: WorkforceSignal = {
      ...baseSignal,
      id: "signal-high",
      type: "ASSIGNMENT_MISSING_PROJECT_CONTEXT",
      category: "data_quality",
      severity: "high",
      confidence: 0.6,
      evidence: {
        assignmentStartsAt: "2026-08-05T08:00:00.000Z",
        detail: "small",
      },
    };

    const findings = normalizeWorkforceFindings({
      companyId: "company-a",
      signals: [lowHighConfidence, highLowerConfidence],
    });

    check(findings.length === 1, "dedupe still emits one finding for colliding key");
    check(findings[0].severity === "high", "higher severity wins over higher confidence");

    const richerEvidence: WorkforceSignal = {
      ...highLowerConfidence,
      id: "signal-high-rich",
      confidence: 0.6,
      evidence: {
        assignmentStartsAt: "2026-08-05T08:00:00.000Z",
        assignmentId: "as-1",
        projectId: "proj-x",
      },
    };

    const lessRichEvidence: WorkforceSignal = {
      ...highLowerConfidence,
      id: "signal-high-thin",
      confidence: 0.95,
      evidence: {
        assignmentStartsAt: "2026-08-05T08:00:00.000Z",
      },
    };

    const richerFindings = normalizeWorkforceFindings({
      companyId: "company-a",
      signals: [lessRichEvidence, richerEvidence],
    });

    check(richerFindings.length === 1, "colliding high-severity findings still dedupe to one");
    check(richerFindings[0].supportingSignalIds[0] === "signal-high-rich", "richer evidence wins before confidence");
  });

  console.log(`\nWorkforce intelligence Phase 2A results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
