import {
  createTradePartnerAssignmentsService,
  TradePartnerAssignmentsError,
  type TradePartnerAssignment,
} from "./service";
import type {
  CreateTradePartnerAssignmentInput,
  TradePartnerAssignmentListFilters,
  TradePartnerAssignmentRow,
  TradePartnerAssignmentStatus,
  UpdateTradePartnerAssignmentInput,
} from "./types";

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

async function test(name: string, fn: () => Promise<void> | void) {
  console.log(`\n${name}`);
  await fn();
}

type FakeRepoState = {
  assignments: TradePartnerAssignmentRow[];
  projects: Array<{ id: string; company_id: string }>;
  vendors: Array<{ id: string; company_id: string }>;
};

function toIso(offsetMinutes: number) {
  return new Date(Date.UTC(2026, 7, 6, 12, offsetMinutes, 0)).toISOString();
}

function makeAssignment(seed: Partial<TradePartnerAssignmentRow> & Pick<TradePartnerAssignmentRow, "id" | "company_id" | "project_id" | "vendor_id" | "trade_name">): TradePartnerAssignmentRow {
  return {
    id: seed.id,
    company_id: seed.company_id,
    project_id: seed.project_id,
    vendor_id: seed.vendor_id,
    trade_name: seed.trade_name,
    scope_of_work: seed.scope_of_work ?? null,
    primary_contact_name: seed.primary_contact_name ?? null,
    primary_contact_phone: seed.primary_contact_phone ?? null,
    primary_contact_email: seed.primary_contact_email ?? null,
    contract_status: seed.contract_status ?? "draft",
    contract_amount: seed.contract_amount ?? null,
    payment_terms: seed.payment_terms ?? null,
    retainage_percent: seed.retainage_percent ?? null,
    start_date: seed.start_date ?? null,
    target_completion_date: seed.target_completion_date ?? null,
    crew_size: seed.crew_size ?? null,
    assignment_status: seed.assignment_status ?? "active",
    notes: seed.notes ?? null,
    created_by: seed.created_by ?? null,
    updated_by: seed.updated_by ?? null,
    created_at: seed.created_at ?? toIso(0),
    updated_at: seed.updated_at ?? toIso(0),
  };
}

function createFakeRepository(state: FakeRepoState) {
  return {
    async listByProject(companyId: string, projectId: string, assignmentStatus?: TradePartnerAssignmentStatus | "all") {
      const data = state.assignments
        .filter((item) => item.company_id === companyId && item.project_id === projectId)
        .filter((item) => assignmentStatus === "all" || assignmentStatus === undefined || item.assignment_status === assignmentStatus)
        .sort((a, b) => (a.created_at > b.created_at ? -1 : 1));

      return { data, error: null };
    },

    async getById(companyId: string, assignmentId: string) {
      const data = state.assignments.find((item) => item.company_id === companyId && item.id === assignmentId) || null;
      return { data, error: null };
    },

    async projectExists(companyId: string, projectId: string) {
      return { exists: state.projects.some((item) => item.company_id === companyId && item.id === projectId), error: null };
    },

    async vendorExists(companyId: string, vendorId: string) {
      return { exists: state.vendors.some((item) => item.company_id === companyId && item.id === vendorId), error: null };
    },

    async findActiveDuplicate(companyId: string, projectId: string, vendorId: string, excludeId?: string) {
      const data = state.assignments.find((item) => {
        if (item.company_id !== companyId) return false;
        if (item.project_id !== projectId) return false;
        if (item.vendor_id !== vendorId) return false;
        if (item.assignment_status !== "active") return false;
        if (excludeId && item.id === excludeId) return false;
        return true;
      }) || null;

      return { data, error: null };
    },

    async create(payload) {
      const row = {
        id: payload.id ?? `tp-${state.assignments.length + 1}`,
        company_id: payload.company_id,
        project_id: payload.project_id,
        vendor_id: payload.vendor_id,
        trade_name: payload.trade_name,
        scope_of_work: payload.scope_of_work ?? null,
        primary_contact_name: payload.primary_contact_name ?? null,
        primary_contact_phone: payload.primary_contact_phone ?? null,
        primary_contact_email: payload.primary_contact_email ?? null,
        contract_status: payload.contract_status ?? "draft",
        contract_amount: payload.contract_amount ?? null,
        payment_terms: payload.payment_terms ?? null,
        retainage_percent: payload.retainage_percent ?? null,
        start_date: payload.start_date ?? null,
        target_completion_date: payload.target_completion_date ?? null,
        crew_size: payload.crew_size ?? null,
        assignment_status: payload.assignment_status ?? "active",
        notes: payload.notes ?? null,
        created_by: payload.created_by ?? null,
        updated_by: payload.updated_by ?? null,
        created_at: payload.created_at ?? toIso(10),
        updated_at: payload.updated_at ?? toIso(10),
      } satisfies TradePartnerAssignmentRow;
      state.assignments.push(row);
      return { data: row, error: null };
    },

    async update(companyId: string, assignmentId: string, payload: Partial<TradePartnerAssignmentRow>) {
      const index = state.assignments.findIndex((item) => item.company_id === companyId && item.id === assignmentId);
      if (index === -1) {
        return { data: null, error: null };
      }

      state.assignments[index] = {
        ...state.assignments[index],
        ...payload,
      };

      return { data: state.assignments[index], error: null };
    },
  };
}

function createServiceFixture(options: {
  companyId?: string;
  userId?: string;
  state?: FakeRepoState;
}) {
  const state = options.state ?? {
    assignments: [],
    projects: [{ id: "project-a", company_id: "company-a" }],
    vendors: [{ id: "vendor-a", company_id: "company-a" }],
  };

  const service = createTradePartnerAssignmentsService({
    supabaseClient: null,
    resolveWorkspace: async () => ({
      context: {
        userId: options.userId ?? "user-a",
        companyId: options.companyId ?? "company-a",
        role: "owner",
        companyName: "Company A",
        companySlug: null,
        membershipId: null,
        membershipStatus: "active",
      },
      errorCode: null,
      errorMessage: null,
    }),
    repository: createFakeRepository(state),
    now: () => toIso(30),
  });

  return { service, state };
}

async function expectThrows(code: TradePartnerAssignmentsError["code"], fn: () => Promise<unknown>) {
  try {
    await fn();
    return false;
  } catch (error) {
    return error instanceof TradePartnerAssignmentsError && error.code === code;
  }
}

async function main() {
  await test("1. company scoping blocks cross-company assignment reads", async () => {
    const state: FakeRepoState = {
      assignments: [
        makeAssignment({ id: "tp-1", company_id: "company-b", project_id: "project-b", vendor_id: "vendor-b", trade_name: "Electrical" }),
      ],
      projects: [{ id: "project-a", company_id: "company-a" }],
      vendors: [{ id: "vendor-a", company_id: "company-a" }],
    };

    const { service } = createServiceFixture({ companyId: "company-a", state });
    const assignment = await service.getTradePartnerAssignment("tp-1");
    check(assignment === null, "cross-company assignment is not returned");
  });

  await test("2. list validates project scope", async () => {
    const { service } = createServiceFixture({});
    const threw = await expectThrows("NOT_FOUND", async () => {
      const filters: TradePartnerAssignmentListFilters = { projectId: "project-missing" };
      await service.listProjectTradePartnerAssignments(filters);
    });
    check(threw, "listing by unknown project throws NOT_FOUND");
  });

  await test("3. create validates project and vendor scope", async () => {
    const { service } = createServiceFixture({});
    const missingProject = await expectThrows("NOT_FOUND", async () => {
      const input: CreateTradePartnerAssignmentInput = {
        projectId: "missing",
        vendorId: "vendor-a",
        tradeName: "Plumbing",
      };
      await service.createTradePartnerAssignment(input);
    });

    const missingVendor = await expectThrows("NOT_FOUND", async () => {
      const input: CreateTradePartnerAssignmentInput = {
        projectId: "project-a",
        vendorId: "missing-vendor",
        tradeName: "Plumbing",
      };
      await service.createTradePartnerAssignment(input);
    });

    check(missingProject, "create rejects missing company-scoped project");
    check(missingVendor, "create rejects missing company-scoped vendor");
  });

  await test("4. create assignment stores normalized scoped payload", async () => {
    const { service, state } = createServiceFixture({});
    const created = await service.createTradePartnerAssignment({
      projectId: "project-a",
      vendorId: "vendor-a",
      tradeName: " Framing ",
      scopeOfWork: " walls ",
      contractStatus: "draft",
      assignmentStatus: "active",
      crewSize: 6,
    });

    check(created.tradeName === "Framing", "trade name is normalized");
    check(created.scopeOfWork === "walls", "scope text is normalized");
    check(created.assignmentStatus === "active", "assignment status is set");
    check(state.assignments.length === 1, "assignment row is persisted");
  });

  await test("5. duplicate active assignment prevention works", async () => {
    const state: FakeRepoState = {
      assignments: [
        makeAssignment({
          id: "tp-existing",
          company_id: "company-a",
          project_id: "project-a",
          vendor_id: "vendor-a",
          trade_name: "Electrical",
          assignment_status: "active",
        }),
      ],
      projects: [{ id: "project-a", company_id: "company-a" }],
      vendors: [{ id: "vendor-a", company_id: "company-a" }],
    };

    const { service } = createServiceFixture({ state });
    const threw = await expectThrows("CONFLICT", async () => {
      await service.createTradePartnerAssignment({
        projectId: "project-a",
        vendorId: "vendor-a",
        tradeName: "Electrical",
        assignmentStatus: "active",
      });
    });

    check(threw, "second active assignment for same project/vendor is blocked");
  });

  await test("6. update assignment applies typed changes", async () => {
    const state: FakeRepoState = {
      assignments: [
        makeAssignment({ id: "tp-2", company_id: "company-a", project_id: "project-a", vendor_id: "vendor-a", trade_name: "Plumbing" }),
      ],
      projects: [{ id: "project-a", company_id: "company-a" }],
      vendors: [{ id: "vendor-a", company_id: "company-a" }],
    };

    const { service } = createServiceFixture({ state });
    const updated = await service.updateTradePartnerAssignment("tp-2", {
      tradeName: "Mechanical",
      contractAmount: 125000,
      notes: "Updated",
    } satisfies UpdateTradePartnerAssignmentInput);

    check(updated.tradeName === "Mechanical", "trade name updates");
    check(updated.contractAmount === 125000, "contract amount updates");
    check(updated.notes === "Updated", "notes update");
  });

  await test("7. status transition updates and enforces transition rules", async () => {
    const state: FakeRepoState = {
      assignments: [
        makeAssignment({ id: "tp-3", company_id: "company-a", project_id: "project-a", vendor_id: "vendor-a", trade_name: "Drywall", assignment_status: "inactive" }),
      ],
      projects: [{ id: "project-a", company_id: "company-a" }],
      vendors: [{ id: "vendor-a", company_id: "company-a" }],
    };

    const { service } = createServiceFixture({ state });
    const activated = await service.changeTradePartnerAssignmentStatus("tp-3", "active");
    check(activated.assignmentStatus === "active", "inactive can transition to active");

    const archived = await service.changeTradePartnerAssignmentStatus("tp-3", "archived");
    check(archived.assignmentStatus === "archived", "active can transition to archived");

    const invalid = await expectThrows("VALIDATION", async () => {
      await service.changeTradePartnerAssignmentStatus("tp-3", "active");
    });

    check(invalid, "archived cannot transition back to active");
  });

  await test("8. unauthorized cross-company update is blocked as not found", async () => {
    const state: FakeRepoState = {
      assignments: [
        makeAssignment({ id: "tp-4", company_id: "company-b", project_id: "project-b", vendor_id: "vendor-b", trade_name: "Roofing" }),
      ],
      projects: [{ id: "project-a", company_id: "company-a" }],
      vendors: [{ id: "vendor-a", company_id: "company-a" }],
    };

    const { service } = createServiceFixture({ companyId: "company-a", state });
    const threw = await expectThrows("NOT_FOUND", async () => {
      await service.updateTradePartnerAssignment("tp-4", { notes: "x" });
    });

    check(threw, "cross-company update fails with NOT_FOUND");
  });

  await test("9. archive behavior follows domain convention", async () => {
    const state: FakeRepoState = {
      assignments: [
        makeAssignment({ id: "tp-5", company_id: "company-a", project_id: "project-a", vendor_id: "vendor-a", trade_name: "Concrete", assignment_status: "active" }),
      ],
      projects: [{ id: "project-a", company_id: "company-a" }],
      vendors: [{ id: "vendor-a", company_id: "company-a" }],
    };

    const { service } = createServiceFixture({ state });
    const archived = await service.archiveTradePartnerAssignment("tp-5");
    check(archived.assignmentStatus === "archived", "archive operation sets archived status");
  });

  await test("10. typed service contract shape is stable", async () => {
    const { service } = createServiceFixture({});

    const methods: Array<keyof typeof service> = [
      "listProjectTradePartnerAssignments",
      "getTradePartnerAssignment",
      "createTradePartnerAssignment",
      "updateTradePartnerAssignment",
      "changeTradePartnerAssignmentStatus",
      "archiveTradePartnerAssignment",
    ];

    check(methods.every((name) => typeof service[name] === "function"), "service exposes expected methods");

    const created: TradePartnerAssignment = await service.createTradePartnerAssignment({
      projectId: "project-a",
      vendorId: "vendor-a",
      tradeName: "Site Prep",
      assignmentStatus: "inactive",
    });

    check(typeof created.id === "string" && created.id.length > 0, "create returns typed TradePartnerAssignment");
  });

  console.log(`\nTrade partner assignment service results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
