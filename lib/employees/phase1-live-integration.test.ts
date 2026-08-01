import fs from "node:fs";
import path from "node:path";
import { createEmployeeService } from "./service";
import {
  createWorkforceService,
  normalizeEmployeeDirectory,
  normalizeEmployeeProfile,
  type WorkforceAssignmentRow,
  type WorkforceCrewRow,
  type WorkforceEmployeeRow,
  type WorkforceEquipmentRow,
  type WorkforceMembershipRow,
  type WorkforcePhaseRow,
  type WorkforceProfileRow,
  type WorkforceProjectRow,
  type WorkforceTaskRow,
} from "@/lib/workforce";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  + ${message}`);
    passed += 1;
  } else {
    console.error(`  x FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

function makeFixture() {
  const employees: WorkforceEmployeeRow[] = [
    {
      id: "emp-a1",
      company_id: "company-a",
      profile_id: "prof-a1",
      employee_number: "E-001",
      employment_status: "active",
      position_title: "Foreman",
      trade: "Concrete",
      supervisor_profile_id: "sup-a1",
      primary_crew_id: "crew-a1",
      hire_date: "2024-01-01",
      termination_date: null,
      availability_status: "assigned",
      notes: "Primary lead",
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "emp-a2",
      company_id: "company-a",
      profile_id: "prof-a2",
      employee_number: "E-002",
      employment_status: "leave",
      position_title: "Electrician",
      trade: "Electrical",
      supervisor_profile_id: "sup-a2",
      primary_crew_id: "crew-a2",
      hire_date: "2023-01-01",
      termination_date: null,
      availability_status: "available",
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-04T00:00:00.000Z",
    },
  ];

  const crews: WorkforceCrewRow[] = [
    {
      id: "crew-a1",
      company_id: "company-a",
      crew_code: "CR-01",
      name: "Concrete Alpha",
      description: "Concrete specialists",
      status: "active",
      lead_profile_id: "lead-a1",
      supervisor_profile_id: "sup-a1",
      home_location: "Yard A",
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-05T00:00:00.000Z",
    },
    {
      id: "crew-a2",
      company_id: "company-a",
      crew_code: "CR-02",
      name: "Electric North",
      description: "Electrical response",
      status: "active",
      lead_profile_id: "lead-a2",
      supervisor_profile_id: "sup-a2",
      home_location: "Yard B",
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-04T00:00:00.000Z",
    },
  ];

  const memberships: WorkforceMembershipRow[] = [
    {
      id: "mem-current",
      company_id: "company-a",
      crew_id: "crew-a1",
      employee_id: "emp-a1",
      role: "Lead",
      is_primary: true,
      starts_on: "2020-01-01",
      ends_on: null,
      status: "active",
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "mem-planned",
      company_id: "company-a",
      crew_id: "crew-a2",
      employee_id: "emp-a1",
      role: "Support",
      is_primary: false,
      starts_on: "2101-01-01",
      ends_on: null,
      status: "planned",
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "mem-ended",
      company_id: "company-a",
      crew_id: "crew-a2",
      employee_id: "emp-a1",
      role: "Journeyman",
      is_primary: false,
      starts_on: "2019-01-01",
      ends_on: "2020-01-01",
      status: "ended",
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "mem-second",
      company_id: "company-a",
      crew_id: "crew-a2",
      employee_id: "emp-a2",
      role: "Wire Lead",
      is_primary: true,
      starts_on: "2020-01-01",
      ends_on: null,
      status: "active",
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const assignments: WorkforceAssignmentRow[] = [
    {
      id: "as-current",
      company_id: "company-a",
      assignment_type: "employee",
      crew_id: null,
      employee_id: "emp-a1",
      project_id: "proj-a1",
      phase_id: "phase-a1",
      task_id: "task-a1",
      title: "Current slab prep",
      description: null,
      starts_at: "2020-01-01T08:00:00.000Z",
      ends_at: "2100-01-01T12:00:00.000Z",
      planned_hours: 4,
      status: "in_progress",
      source_type: "task",
      source_id: "task-a1",
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "as-upcoming",
      company_id: "company-a",
      assignment_type: "employee",
      crew_id: null,
      employee_id: "emp-a1",
      project_id: "proj-a1",
      phase_id: null,
      task_id: null,
      title: "Upcoming inspection",
      description: null,
      starts_at: "2101-01-01T08:00:00.000Z",
      ends_at: "2101-01-01T12:00:00.000Z",
      planned_hours: 4,
      status: "planned",
      source_type: "manual",
      source_id: null,
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "as-completed",
      company_id: "company-a",
      assignment_type: "employee",
      crew_id: null,
      employee_id: "emp-a1",
      project_id: "proj-a2",
      phase_id: null,
      task_id: null,
      title: "Completed wrap",
      description: null,
      starts_at: "2018-01-01T08:00:00.000Z",
      ends_at: "2018-01-01T12:00:00.000Z",
      planned_hours: 4,
      status: "completed",
      source_type: "manual",
      source_id: null,
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "as-crew-current",
      company_id: "company-a",
      assignment_type: "crew",
      crew_id: "crew-a1",
      employee_id: null,
      project_id: "proj-a1",
      phase_id: null,
      task_id: null,
      title: "Crew concrete shift",
      description: null,
      starts_at: "2020-01-01T08:00:00.000Z",
      ends_at: "2100-01-01T12:00:00.000Z",
      planned_hours: 6,
      status: "confirmed",
      source_type: "schedule",
      source_id: "sched-a1",
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const profiles: WorkforceProfileRow[] = [
    { id: "prof-a1", first_name: "Alicia", last_name: "Stone" },
    { id: "prof-a2", first_name: "Bruno", last_name: "Vale" },
    { id: "sup-a1", first_name: "Sarah", last_name: "Lead" },
    { id: "sup-a2", first_name: "Chris", last_name: "Wire" },
    { id: "lead-a1", first_name: "Tara", last_name: "Crew" },
    { id: "lead-a2", first_name: "Leo", last_name: "Crew" },
  ];

  const projects: WorkforceProjectRow[] = [
    { id: "proj-a1", name: "North Tower" },
    { id: "proj-a2", name: "South Annex" },
  ];

  const phases: WorkforcePhaseRow[] = [
    { id: "phase-a1", project_id: "proj-a1", name: "Foundation" },
  ];

  const tasks: WorkforceTaskRow[] = [
    { id: "task-a1", project_id: "proj-a1", phase_id: "phase-a1", title: "Pour slab" },
  ];

  const equipment: WorkforceEquipmentRow[] = [
    {
      id: "eq-a1",
      equipment_number: "EQ-001",
      name: "Mixer",
      status: "active",
      maintenance_status: "current",
      assigned_job_id: "proj-a1",
      assigned_crew_id: "crew-a1",
      assigned_employee_id: "emp-a1",
      expected_return_date: null,
    },
  ];

  return { employees, crews, memberships, assignments, profiles, projects, phases, tasks, equipment };
}

function makeSupabaseStub(rowsByTable: Record<string, Array<Record<string, unknown>>>) {
  const calls: Array<{ table: string; filters: Array<[string, unknown]> }> = [];

  const client = {
    from(table: string) {
      const filters: Array<[string, unknown]> = [];
      const orders: Array<{ column: string; ascending: boolean }> = [];
      calls.push({ table, filters });

      const run = () => {
        const base = rowsByTable[table] ?? [];
        const filtered = base.filter((row) => filters.every(([column, value]) => row[column] === value));
        const ordered = [...filtered].sort((left, right) => {
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

        return ordered;
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
        maybeSingle() {
          return Promise.resolve({ data: run()[0] ?? null, error: null });
        },
        then(onFulfilled: (value: { data: unknown; error: null }) => unknown, onRejected?: (reason: unknown) => unknown) {
          return Promise.resolve({ data: run(), error: null }).then(onFulfilled, onRejected);
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

async function main() {
  const fixture = makeFixture();

  await test("1. employee directory filtering and deterministic sorting are behavioral", () => {
    const bySearch = normalizeEmployeeDirectory({
      ...fixture,
      partialNotices: ["Profiles unavailable"],
      filters: {
        query: "Alicia",
        employmentStatus: "all",
        availabilityStatus: "all",
        crewId: "all",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(bySearch.items.length === 1 && bySearch.items[0].fullName === "Alicia Stone", "search filter matches normalized full name");

    const byEmployment = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "leave",
        availabilityStatus: "all",
        crewId: "all",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byEmployment.items.length === 1 && byEmployment.items[0].id === "emp-a2", "employment status filter is enforced");

    const byAvailability = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "all",
        availabilityStatus: "assigned",
        crewId: "all",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byAvailability.items.length === 1 && byAvailability.items[0].id === "emp-a1", "availability filter is enforced");

    const byCrew = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "all",
        availabilityStatus: "all",
        crewId: "crew-a1",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byCrew.items.length === 1 && byCrew.items[0].id === "emp-a1", "crew filter uses normalized primary crew");

    const bySupervisor = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "all",
        availabilityStatus: "all",
        crewId: "all",
        supervisorId: "sup-a2",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(bySupervisor.items.length === 1 && bySupervisor.items[0].id === "emp-a2", "supervisor filter is enforced");

    const sorted = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "all",
        availabilityStatus: "all",
        crewId: "all",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_desc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(sorted.items[0].fullName === "Bruno Vale", "name sort is deterministic");
    assert(sorted.partialNotices.length === 0, "partial notices are deliberate, not fabricated by default");
  });

  await test("2. employee profile grouping and identity normalization are behavioral", () => {
    const directory = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "all",
        availabilityStatus: "all",
        crewId: "all",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });

    const profile = normalizeEmployeeProfile({
      employeeId: "emp-a1",
      directory,
      memberships: directory.membershipViews,
      assignments: directory.assignmentViews,
      equipment: directory.equipment,
    });

    assert(Boolean(profile), "employee profile resolves from normalized directory");
    assert(profile?.overview.fullName === "Alicia Stone", "identity normalization resolves profile full name");
    assert(profile?.memberships.current.length === 1, "current membership grouping is canonical");
    assert(profile?.memberships.planned.length === 1, "planned membership grouping is canonical");
    assert(profile?.memberships.ended.length === 1, "ended membership grouping is canonical");
    assert((profile?.assignments.current.length ?? 0) >= 1, "current assignment grouping is canonical");
    assert((profile?.assignments.upcoming.length ?? 0) >= 1, "upcoming assignment grouping is canonical");
    assert((profile?.assignments.completed.length ?? 0) >= 1, "completed assignment grouping is canonical");
    assert((profile?.equipment.direct.length ?? 0) === 1, "equipment context is normalized, not fabricated");
    assert(
      profile?.partialNotices.some((notice) => notice.includes("not available from Workforce Foundation Phase 1")) ?? false,
      "unsupported sections are represented as deliberate partial-data notices",
    );
  });

  await test("3. employee service default-directory helpers dedupe in-flight fetches", async () => {
    let loadCalls = 0;
    const directory = normalizeEmployeeDirectory({
      ...fixture,
      filters: {
        query: "",
        employmentStatus: "all",
        availabilityStatus: "all",
        crewId: "all",
        supervisorId: "all",
        projectId: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });

    const service = createEmployeeService({
      loadDirectory: async () => {
        loadCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return directory;
      },
      loadEmployeeProfile: async () => normalizeEmployeeProfile({
        employeeId: "emp-a1",
        directory,
        memberships: directory.membershipViews,
        assignments: directory.assignmentViews,
        equipment: directory.equipment,
      }),
    });

    await Promise.all([
      service.getSummary(),
      service.getCrewOptions(),
      service.getSupervisorOptions(),
      service.getProjectOptions(),
    ]);

    assert(loadCalls === 1, "default directory request is deduplicated across concurrent helper calls");
  });

  await test("4. workforce employee directory remains company scoped and mock free", async () => {
    const supabaseRows = {
      employees: [
        ...fixture.employees,
        {
          ...fixture.employees[0],
          id: "emp-b1",
          company_id: "company-b",
          employee_number: "E-900",
          profile_id: "prof-b1",
        },
      ],
      crews: [
        ...fixture.crews,
        {
          ...fixture.crews[0],
          id: "crew-b1",
          company_id: "company-b",
          name: "Other Crew",
        },
      ],
      crew_memberships: [
        ...fixture.memberships,
        {
          ...fixture.memberships[0],
          id: "mem-b1",
          company_id: "company-b",
          crew_id: "crew-b1",
          employee_id: "emp-b1",
        },
      ],
      workforce_assignments: [
        ...fixture.assignments,
        {
          ...fixture.assignments[0],
          id: "as-b1",
          company_id: "company-b",
          employee_id: "emp-b1",
          crew_id: null,
          project_id: "proj-b1",
        },
      ],
      profiles: [...fixture.profiles, { id: "prof-b1", first_name: "B", last_name: "User" }],
      projects: [...fixture.projects, { id: "proj-b1", name: "Other Project" }],
      project_phases: fixture.phases,
      tasks: fixture.tasks,
      equipment: fixture.equipment,
    };

    const { client, calls } = makeSupabaseStub(supabaseRows);
    const workforce = createWorkforceService(client as never);
    const scoped = await workforce.getEmployeeDirectory("company-a", {
      query: "",
      employmentStatus: "all",
      availabilityStatus: "all",
      crewId: "all",
      supervisorId: "all",
      projectId: "all",
      sortBy: "name_asc",
      page: 1,
      pageSize: 20,
    });

    assert(scoped.items.every((item) => item.id !== "emp-b1"), "cross-company employee rows are excluded from scoped directory");
    assert(calls.every((call) => call.filters.some(([column, value]) => column === "company_id" && value === "company-a")), "all workforce queries include company scoping");

    const employeeServiceSource = read("lib/employees/service.ts");
    const workforceServiceSource = read("lib/workforce/workforce-service.ts");
    assert(!employeeServiceSource.includes("mock-data"), "employee service has no mock fallback");
    assert(!workforceServiceSource.includes("mock-data"), "workforce service has no mock fallback");
  });

  console.log(`\nEmployees Phase 1 live integration results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
