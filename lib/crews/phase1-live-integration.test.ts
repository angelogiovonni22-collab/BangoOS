import fs from "node:fs";
import path from "node:path";
import { createCrewService } from "./service";
import { getOperationsPayload } from "@/lib/operations/mock-data";
import {
  createWorkforceService,
  normalizeCrewDirectory,
  normalizeCrewProfile,
  normalizeEmployeeDirectory,
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
      notes: null,
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
      employment_status: "active",
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
    {
      id: "emp-a3",
      company_id: "company-a",
      profile_id: "prof-a3",
      employee_number: "E-003",
      employment_status: "inactive",
      position_title: "Operator",
      trade: "Concrete",
      supervisor_profile_id: "sup-a1",
      primary_crew_id: "crew-a1",
      hire_date: "2022-01-01",
      termination_date: null,
      availability_status: "unknown",
      notes: null,
      created_by: null,
      updated_by: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-03T00:00:00.000Z",
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
      status: "inactive",
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
      id: "mem-current-2",
      company_id: "company-a",
      crew_id: "crew-a1",
      employee_id: "emp-a3",
      role: "Support",
      is_primary: false,
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
      crew_id: "crew-a1",
      employee_id: "emp-a2",
      role: "Future",
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
      crew_id: "crew-a1",
      employee_id: "emp-a2",
      role: "Past",
      is_primary: false,
      starts_on: "2019-01-01",
      ends_on: "2020-01-01",
      status: "ended",
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
      assignment_type: "crew",
      crew_id: "crew-a1",
      employee_id: null,
      project_id: "proj-a1",
      phase_id: "phase-a1",
      task_id: "task-a1",
      title: "Current concrete shift",
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
    {
      id: "as-upcoming",
      company_id: "company-a",
      assignment_type: "crew",
      crew_id: "crew-a1",
      employee_id: null,
      project_id: "proj-a1",
      phase_id: null,
      task_id: null,
      title: "Upcoming handoff",
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
      assignment_type: "crew",
      crew_id: "crew-a1",
      employee_id: null,
      project_id: "proj-a2",
      phase_id: null,
      task_id: null,
      title: "Completed handoff",
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
      id: "as-crew2",
      company_id: "company-a",
      assignment_type: "crew",
      crew_id: "crew-a2",
      employee_id: null,
      project_id: "proj-a2",
      phase_id: null,
      task_id: null,
      title: "Electric wrap",
      description: null,
      starts_at: "2020-01-01T08:00:00.000Z",
      ends_at: "2100-01-01T12:00:00.000Z",
      planned_hours: 4,
      status: "in_progress",
      source_type: "task",
      source_id: "task-x",
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
    { id: "prof-a3", first_name: "Cora", last_name: "Tenn" },
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

async function main() {
  const fixture = makeFixture();

  await test("1. crew directory filtering, member counts, and sorting are behavioral", () => {
    const bySearch = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "Concrete",
        status: "all",
        leadId: "all",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(bySearch.items.length === 1 && bySearch.items[0].id === "crew-a1", "search filter is enforced");

    const byStatus = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "inactive",
        leadId: "all",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byStatus.items.length === 1 && byStatus.items[0].id === "crew-a2", "status filter is enforced");

    const byLead = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "lead-a1",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byLead.items.length === 1 && byLead.items[0].id === "crew-a1", "lead filter is enforced");

    const bySupervisor = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "all",
        supervisorId: "sup-a2",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(bySupervisor.items.length === 1 && bySupervisor.items[0].id === "crew-a2", "supervisor filter is enforced");

    const byProject = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "all",
        supervisorId: "all",
        projectId: "proj-a1",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byProject.items.length === 1 && byProject.items[0].id === "crew-a1", "project filter is enforced");

    const byMembers = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "all",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "members_desc",
        page: 1,
        pageSize: 20,
      },
    });
    assert(byMembers.items[0].activeMemberCount === 2, "active member count is normalized from current memberships");
    assert(byMembers.items[0].id === "crew-a1", "members_desc sorting is deterministic");
  });

  await test("2. crew profile grouping and equipment/navigation normalization are behavioral", () => {
    const directory = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "all",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });

    const profile = normalizeCrewProfile({
      crewId: "crew-a1",
      directory,
      memberships: directory.membershipViews,
      assignments: directory.assignmentViews,
      equipment: directory.equipment,
    });

    assert(Boolean(profile), "crew profile resolves from normalized directory");
    assert(profile?.memberships.current.length === 2, "current membership grouping is canonical");
    assert(profile?.memberships.planned.length === 1, "planned membership grouping is canonical");
    assert(profile?.memberships.ended.length === 1, "ended membership grouping is canonical");
    assert((profile?.assignments.current.length ?? 0) >= 1, "current assignment grouping is canonical");
    assert((profile?.assignments.upcoming.length ?? 0) >= 1, "upcoming assignment grouping is canonical");
    assert((profile?.assignments.completed.length ?? 0) >= 1, "completed assignment grouping is canonical");
    assert((profile?.memberships.current[0].employeeId ?? "").startsWith("emp-"), "employee navigation data preserves employee ids");
    assert((profile?.equipment.crew[0].href ?? "").startsWith("/equipment/"), "equipment links are normalized");

    const assignmentIds = (profile?.assignments.current ?? []).map((item) => item.id);
    assert(new Set(assignmentIds).size === assignmentIds.length, "crew profile does not duplicate assignment entries");
    assert(
      profile?.partialNotices.some((notice) => notice.includes("not available from Workforce Foundation Phase 1")) ?? false,
      "unsupported time/safety/certification surfaces are represented as deliberate partial notices",
    );
  });

  await test("3. specialty options derive from workforce trade values and not projects", async () => {
    const service = createCrewService({
      loadEmployeeRows: async () => fixture.employees,
      loadDirectory: async () => normalizeCrewDirectory({
        ...fixture,
        filters: {
          query: "",
          status: "all",
          leadId: "all",
          supervisorId: "all",
          projectId: "all",
          assignmentStatus: "all",
          sortBy: "name_asc",
          page: 1,
          pageSize: 20,
        },
      }),
      loadCrewProfile: async () => null,
    });

    const specialties = await service.getSpecialtyOptions();
    assert(specialties.length === 2, "specialties are derived from distinct workforce trade values");
    assert(specialties[0] === "Concrete" && specialties[1] === "Electrical", "specialties are sorted and normalized from trades");
    assert(!specialties.includes("North Tower"), "project names are never relabeled as specialties");
  });

  await test("4. crew service default-directory helpers dedupe in-flight fetches", async () => {
    let loadCalls = 0;
    const directory = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "all",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });

    const service = createCrewService({
      loadDirectory: async () => {
        loadCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 5));
        return directory;
      },
      loadCrewProfile: async () => null,
      loadEmployeeRows: async () => fixture.employees,
    });

    await Promise.all([
      service.getSummary(),
      service.getLeadOptions(),
      service.getSupervisorOptions(),
      service.getProjectOptions(),
    ]);

    assert(loadCalls === 1, "default crew directory request is deduplicated across concurrent helper calls");
  });

  await test("5. cross-module employee and crew directories stay semantically consistent", () => {
    const employeeDirectory = normalizeEmployeeDirectory({
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

    const crewDirectory = normalizeCrewDirectory({
      ...fixture,
      filters: {
        query: "",
        status: "all",
        leadId: "all",
        supervisorId: "all",
        projectId: "all",
        assignmentStatus: "all",
        sortBy: "name_asc",
        page: 1,
        pageSize: 20,
      },
    });

    const employee = employeeDirectory.items.find((item) => item.id === "emp-a1");
    const crew = crewDirectory.items.find((item) => item.id === "crew-a1");
    assert(employee?.currentProjectName === crew?.currentProjectName, "shared fixture preserves project identity across employee and crew views");
    assert(employee?.currentAssignmentStatus === crew?.currentAssignmentStatus, "assignment status semantics remain aligned across modules");
  });

  await test("6. workforce crew directory remains company scoped", async () => {
    const supabaseRows = {
      employees: fixture.employees,
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
          employee_id: "emp-a1",
        },
      ],
      workforce_assignments: [
        ...fixture.assignments,
        {
          ...fixture.assignments[0],
          id: "as-b1",
          company_id: "company-b",
          crew_id: "crew-b1",
          project_id: "proj-b1",
        },
      ],
      profiles: fixture.profiles,
      projects: [...fixture.projects, { id: "proj-b1", name: "Other Project" }],
      project_phases: fixture.phases,
      tasks: fixture.tasks,
      equipment: fixture.equipment,
    };

    const { client, calls } = makeSupabaseStub(supabaseRows);
    const workforce = createWorkforceService(client as never);
    const scoped = await workforce.getCrewDirectory("company-a", {
      query: "",
      status: "all",
      leadId: "all",
      supervisorId: "all",
      projectId: "all",
      assignmentStatus: "all",
      sortBy: "name_asc",
      page: 1,
      pageSize: 20,
    });

    assert(scoped.items.every((item) => item.id !== "crew-b1"), "cross-company crew rows are excluded from scoped directory");
    assert(calls.every((call) => call.filters.some(([column, value]) => column === "company_id" && value === "company-a")), "all crew directory workforce queries include company scoping");
  });

  await test("7. operations compatibility consumes canonical workforce values without mutating semantics", async () => {
    const payload = await getOperationsPayload(
      { date: "2026-08-01", shift: "all", project: "all", query: "" },
      {
        crewService: {
          getCrews: async () => ({
            items: [
              {
                id: "crew-a1",
                crewCode: "CR-01",
                name: "Concrete Alpha",
                status: "active",
                leadName: "Tara Crew",
                leadProfileId: "lead-a1",
                supervisorName: "Sarah Lead",
                supervisorProfileId: "sup-a1",
                homeLocation: "Yard A",
                description: null,
                notes: null,
                activeMemberCount: 2,
                primaryMemberCount: 1,
                currentAssignmentId: "as-current",
                currentAssignmentTitle: "Current concrete shift",
                currentProjectId: "proj-a1",
                currentProjectName: "North Tower",
                currentPhaseOrTask: "Foundation",
                currentAssignmentStatus: "confirmed",
                nextAssignmentTitle: null,
                nextProjectName: null,
                updatedAt: "2026-01-05T00:00:00.000Z",
                equipmentCount: 1,
                projectEquipmentCount: 1,
                hasEquipmentConflict: false,
                availability: "assigned",
                isActive: true,
              },
            ],
            total: 1,
            totalPages: 1,
            page: 1,
            pageSize: 50,
            summary: {
              totalCrews: 1,
              activeCrews: 1,
              availableCrews: 0,
              assignedCrews: 1,
            },
            options: {
              leadOptions: [],
              supervisorOptions: [],
              projectOptions: [],
            },
            partialNotices: [],
          }),
        },
        employeeService: {
          getSummary: async () => ({
            totalEmployees: 3,
            activeToday: 2,
            available: 1,
            assignedToProjects: 1,
            onLeave: 0,
          }),
        },
        schedulingService: {
          getScheduling: async () => ({
            assignments: [],
            openShifts: [],
            conflicts: [],
            dispatch: [],
          } as never),
        },
      },
    );

    assert(payload.crewAllocations[0].availability === "assigned", "operations compatibility preserves canonical crew availability");
    assert(payload.crewAllocations[0].crewName === "Concrete Alpha", "operations compatibility consumes canonical identity labels");
  });

  await test("8. crew service and operations page stay mock-safe in production path", () => {
    const serviceSource = read("lib/crews/service.ts");
    const operationsPageSource = read("app/(app)/operations/page.tsx");
    const operationsHookSource = read("lib/operations/use-operations.ts");
    assert(!serviceSource.includes("mock-data"), "crew service has no mock fallback");
    assert(operationsPageSource.includes("useOperationsCommandCenter"), "production operations page uses live command-center path");
    assert(!operationsPageSource.includes("useOperations("), "production operations page does not use legacy mock hook");
    assert(operationsHookSource.includes("createOperationsService"), "legacy operations mock compatibility remains isolated to legacy hook");
  });

  console.log(`\nCrews Phase 1 live integration results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
