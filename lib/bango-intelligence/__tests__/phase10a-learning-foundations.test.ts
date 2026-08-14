import { computeDeterministicConfidence } from "../learning/confidence-engine";
import { calculateTrendDirection } from "../learning/trend-calculator";
import { buildCrewLearning } from "../learning/crew-learning-engine";
import { buildVendorLearning } from "../learning/vendor-learning-engine";
import { buildCustomerLearning } from "../learning/customer-learning-engine";
import { buildProjectLearning } from "../learning/project-learning-engine";
import { buildCompanyLearning } from "../learning/company-learning-engine";
import { buildDeterministicLearningContext } from "../learning/learning-service";
import type {
  LearningChangeOrderRow,
  LearningCustomerRow,
  LearningEquipmentRow,
  LearningEstimateRow,
  LearningInvoiceRow,
  LearningMaterialRow,
  LearningMemoryRow,
  LearningProjectRow,
  LearningProvider,
  LearningTaskRow,
  LearningTimeScope,
  LearningVendorRow,
} from "../learning/learning-provider";
import type { LearningTimeWindow } from "../learning/metric-types";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string): void {
  if (condition) {
    console.log(`  ✓ ${message}`);
    passed += 1;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed += 1;
  }
}

async function test(name: string, fn: () => Promise<void> | void): Promise<void> {
  console.log(`\n${name}`);
  await fn();
}

const timeWindow: LearningTimeWindow = {
  name: "recent_90_days",
  startAt: "2026-05-01T00:00:00.000Z",
  endAt: "2026-07-31T00:00:00.000Z",
};

function task(id: string, overrides?: Partial<LearningTaskRow>): LearningTaskRow {
  return {
    id,
    company_id: "company-a",
    project_id: "project-a",
    assigned_profile_id: "profile-a",
    status: "completed",
    completion_percentage: 100,
    estimated_hours: 8,
    actual_hours: 8,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
    ...overrides,
  };
}

function memory(id: string, overrides?: Partial<LearningMemoryRow>): LearningMemoryRow {
  return {
    id,
    company_id: "company-a",
    project_id: "project-a",
    customer_id: "customer-a",
    related_task_id: null,
    phase: null,
    category: "lesson_learned",
    content: "Memory",
    source: "user_explicit_save",
    relevance_score: 0.6,
    recommendation_status: null,
    recommendation_outcome: null,
    verification_status: "unverified",
    linked_vendor_id: null,
    linked_equipment_id: null,
    linked_material_id: null,
    created_at: "2026-06-01T00:00:00.000Z",
    updated_at: "2026-06-02T00:00:00.000Z",
    ...overrides,
  };
}

function project(id: string, overrides?: Partial<LearningProjectRow>): LearningProjectRow {
  return {
    id,
    company_id: "company-a",
    name: "Project A",
    project_type: "commercial",
    status: "in_progress",
    contract_amount: 100000,
    estimated_cost: 85000,
    estimated_start_date: "2026-05-01",
    estimated_end_date: "2026-08-01",
    actual_start_date: "2026-05-03",
    actual_end_date: null,
    customer_id: "customer-a",
    created_at: "2026-05-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
    ...overrides,
  };
}

class StubLearningProvider implements LearningProvider {
  constructor(
    private readonly seed: {
      tasks?: LearningTaskRow[];
      projects?: LearningProjectRow[];
      changeOrders?: LearningChangeOrderRow[];
      estimates?: LearningEstimateRow[];
      invoices?: LearningInvoiceRow[];
      memories?: LearningMemoryRow[];
      vendors?: LearningVendorRow[];
      customers?: LearningCustomerRow[];
      equipment?: LearningEquipmentRow[];
      materials?: LearningMaterialRow[];
    },
  ) {}

  async getTasks(companyId: string, scope: LearningTimeScope): Promise<LearningTaskRow[]> {
    void companyId;
    void scope;
    return this.seed.tasks ?? [];
  }

  async getProjects(companyId: string, scope: LearningTimeScope): Promise<LearningProjectRow[]> {
    void companyId;
    void scope;
    return this.seed.projects ?? [];
  }

  async getChangeOrders(companyId: string, scope: LearningTimeScope): Promise<LearningChangeOrderRow[]> {
    void companyId;
    void scope;
    return this.seed.changeOrders ?? [];
  }

  async getEstimates(companyId: string, scope: LearningTimeScope): Promise<LearningEstimateRow[]> {
    void companyId;
    void scope;
    return this.seed.estimates ?? [];
  }

  async getInvoices(companyId: string, scope: LearningTimeScope): Promise<LearningInvoiceRow[]> {
    void companyId;
    void scope;
    return this.seed.invoices ?? [];
  }

  async getMemories(companyId: string, scope: LearningTimeScope): Promise<LearningMemoryRow[]> {
    void companyId;
    void scope;
    return this.seed.memories ?? [];
  }

  async getVendors(companyId: string): Promise<LearningVendorRow[]> {
    void companyId;
    return this.seed.vendors ?? [];
  }

  async getCustomers(companyId: string): Promise<LearningCustomerRow[]> {
    void companyId;
    return this.seed.customers ?? [];
  }

  async getEquipment(companyId: string, scope: LearningTimeScope): Promise<LearningEquipmentRow[]> {
    void companyId;
    void scope;
    return this.seed.equipment ?? [];
  }

  async getMaterials(companyId: string, scope: LearningTimeScope): Promise<LearningMaterialRow[]> {
    void companyId;
    void scope;
    return this.seed.materials ?? [];
  }
}

async function main(): Promise<void> {
  await test("1. confidence is insufficient with zero evidence", () => {
    const result = computeDeterministicConfidence({ sourceCount: 0, sampleSize: 0, requiredSampleSize: 5 });
    assert(result === "insufficient", "Returns insufficient when no evidence exists");
  });

  await test("2. confidence reaches low threshold", () => {
    const result = computeDeterministicConfidence({ sourceCount: 2, sampleSize: 3, requiredSampleSize: 10 });
    assert(result === "low", "Returns low confidence at conservative low threshold");
  });

  await test("3. confidence reaches medium threshold", () => {
    const result = computeDeterministicConfidence({ sourceCount: 3, sampleSize: 6, requiredSampleSize: 10 });
    assert(result === "medium", "Returns medium confidence when sample crosses 60% threshold");
  });

  await test("4. confidence reaches high threshold", () => {
    const result = computeDeterministicConfidence({ sourceCount: 5, sampleSize: 10, requiredSampleSize: 10 });
    assert(result === "high", "Returns high confidence only at strongest threshold");
  });

  await test("5. trend reports insufficient data when missing points", () => {
    const result = calculateTrendDirection({ current: null, previous: 10 });
    assert(result === "insufficient_data", "Trend is insufficient without full data points");
  });

  await test("6. trend reports stable within minimum delta", () => {
    const result = calculateTrendDirection({ current: 100, previous: 100.02, minimumDeltaPercent: 0.1 });
    assert(result === "stable", "Trend is stable when change is below minimum threshold");
  });

  await test("7. trend reports improving and declining", () => {
    const improving = calculateTrendDirection({ current: 120, previous: 100, minimumDeltaPercent: 0.1 });
    const declining = calculateTrendDirection({ current: 80, previous: 100, minimumDeltaPercent: 0.1 });
    assert(improving === "improving", "Trend can report improving");
    assert(declining === "declining", "Trend can report declining");
  });

  await test("8. crew engine marks insufficient on empty task set", () => {
    const output = buildCrewLearning("company-a", [], timeWindow);
    const assigned = output.metrics.find((m) => m.metricType === "crew_assigned_task_count");
    assert(Boolean(assigned) && assigned?.confidence === "insufficient", "Crew assigned metric is insufficient with no tasks");
    assert(output.limitations.length > 0, "Crew learning emits limitations for sparse data");
  });

  await test("9. crew engine computes hours variance with evidence", () => {
    const output = buildCrewLearning(
      "company-a",
      [
        task("t1", { estimated_hours: 10, actual_hours: 12 }),
        task("t2", { estimated_hours: 8, actual_hours: 8 }),
      ],
      timeWindow,
    );
    const variance = output.metrics.find((m) => m.metricType === "crew_hours_variance_ratio");
    assert(Boolean(variance) && variance?.value === 1.1111, "Crew hours variance is deterministic from task hours");
  });

  await test("10. vendor engine emits zero-data limitations", () => {
    const output = buildVendorLearning("company-a", [], [], timeWindow);
    const linked = output.metrics.find((m) => m.metricType === "vendor_linked_memory_count");
    assert(Boolean(linked) && linked?.confidence === "insufficient", "Vendor metric is insufficient without vendor memories");
    assert(output.limitations.length > 0, "Vendor learning emits sparse-data limitation");
  });

  await test("11. vendor engine tracks positive and negative outcomes", () => {
    const vendors: LearningVendorRow[] = [{ id: "vendor-a", company_id: "company-a", preferred_vendor: true, quality_rating: 4, delivery_rating: 4, status: "active" }];
    const memories = [
      memory("m1", { linked_vendor_id: "vendor-a", recommendation_outcome: "positive" }),
      memory("m2", { linked_vendor_id: "vendor-a", recommendation_outcome: "negative" }),
    ];
    const output = buildVendorLearning("company-a", vendors, memories, timeWindow);
    const positive = output.metrics.find((m) => m.metricType === "vendor_positive_outcome_count");
    const negative = output.metrics.find((m) => m.metricType === "vendor_negative_outcome_count");
    assert(Boolean(positive) && positive?.value === 1, "Vendor positive outcomes counted deterministically");
    assert(Boolean(negative) && negative?.value === 1, "Vendor negative outcomes counted deterministically");
  });

  await test("12. customer engine counts verified preferences", () => {
    const customers: LearningCustomerRow[] = [{ id: "customer-a", company_id: "company-a", status: "active", created_at: "2026-05-01", updated_at: "2026-07-01" }];
    const memories = [
      memory("m1", { customer_id: "customer-a", category: "customer_preference", verification_status: "verified" }),
      memory("m2", { customer_id: "customer-a", category: "payment_pattern" }),
    ];
    const output = buildCustomerLearning("company-a", customers, memories, timeWindow);
    const metric = output.metrics.find((m) => m.metricType === "customer_verified_preference_count");
    assert(Boolean(metric) && metric?.value === 1, "Customer verified preferences are counted");
  });

  await test("13. customer engine flags sparse observation limitation", () => {
    const customers: LearningCustomerRow[] = [{ id: "customer-a", company_id: "company-a", status: "active", created_at: "2026-05-01", updated_at: "2026-07-01" }];
    const output = buildCustomerLearning("company-a", customers, [memory("m1", { customer_id: "customer-a" })], timeWindow);
    assert(output.limitations.length > 0, "Customer learning warns when fewer than 3 memories exist");
  });

  await test("14. project engine returns empty output when no project scope", () => {
    const output = buildProjectLearning("company-a", null, [], [], [], [], [], timeWindow);
    assert(output.metrics.length === 0, "Project metrics are skipped when no project is selected");
    assert(output.limitations.length > 0, "Project learning provides explicit no-project limitation");
  });

  await test("15. project engine computes estimate to invoice ratio", () => {
    const output = buildProjectLearning(
      "company-a",
      project("project-a"),
      [task("t1")],
      [],
      [{ id: "e1", company_id: "company-a", project_id: "project-a", total_amount: 100, status: "sent", created_at: "2026-06-01" }],
      [{ id: "i1", company_id: "company-a", project_id: "project-a", total_amount: 75, amount_paid: 40, status: "sent", created_at: "2026-06-02" }],
      [memory("m1", { project_id: "project-a" })],
      timeWindow,
    );
    const ratioMetric = output.metrics.find((m) => m.metricType === "project_estimate_to_invoice_ratio");
    assert(Boolean(ratioMetric) && ratioMetric?.value === 0.75, "Project estimate-to-invoice ratio is deterministic");
  });

  await test("16. company engine emits sparse baseline limitation", () => {
    const output = buildCompanyLearning("company-a", [], [], [], [], [], timeWindow);
    assert(output.limitations.length > 0, "Company learning marks low sample baseline");
  });

  await test("17. company engine computes project type aggregates", () => {
    const output = buildCompanyLearning(
      "company-a",
      [memory("m1", { category: "change_order_pattern" }), memory("m2", { category: "lesson_learned" })],
      [task("t1", { status: "overdue" })],
      [project("p1", { contract_amount: 100000, estimated_cost: 80000 }), project("p2", { contract_amount: 200000, estimated_cost: 160000 })],
      [],
      [],
      timeWindow,
    );
    const contractMetric = output.metrics.find((m) => m.metricType === "project_type_average_contract_amount");
    assert(Boolean(contractMetric) && contractMetric?.value === 150000, "Company project-type contract average is deterministic");
  });

  await test("18. learning service builds full deterministic snapshot", async () => {
    const provider = new StubLearningProvider({
      tasks: [task("t1"), task("t2", { status: "overdue", completion_percentage: 40 })],
      projects: [project("project-a")],
      changeOrders: [{ id: "co1", company_id: "company-a", project_id: "project-a", status: "pending", total_amount: 1000, created_at: "2026-06-01" }],
      estimates: [{ id: "e1", company_id: "company-a", project_id: "project-a", total_amount: 1000, status: "sent", created_at: "2026-06-01" }],
      invoices: [{ id: "i1", company_id: "company-a", project_id: "project-a", total_amount: 900, amount_paid: 700, status: "sent", created_at: "2026-06-10" }],
      memories: [memory("m1", { category: "lesson_learned" }), memory("m2", { category: "vendor_preference", linked_vendor_id: "vendor-a" })],
      vendors: [{ id: "vendor-a", company_id: "company-a", preferred_vendor: true, quality_rating: 5, delivery_rating: 5, status: "active" }],
      customers: [{ id: "customer-a", company_id: "company-a", status: "active", created_at: "2026-05-01", updated_at: "2026-07-01" }],
      equipment: [{ id: "eq1", company_id: "company-a", status: "active", vendor_id: "vendor-a", utilization_target_percent: 80, created_at: "2026-05-01", updated_at: "2026-07-01" }],
      materials: [{ id: "mat1", company_id: "company-a", status: "active", preferred_vendor_id: "vendor-a", current_stock: 20, reorder_point: 10, created_at: "2026-05-01", updated_at: "2026-07-01" }],
    });

    const result = await buildDeterministicLearningContext(provider, {
      companyId: "company-a",
      projectId: "project-a",
      customerId: "customer-a",
      nowIso: "2026-07-31T00:00:00.000Z",
    });

    assert(result.snapshot.metrics.length > 0, "Learning service emits metrics snapshot");
    assert(result.companyDNA.traits.length > 0, "Learning service emits company DNA traits");
  });

  await test("19. learning service excludes low-confidence from briefing lines", async () => {
    const provider = new StubLearningProvider({
      tasks: [],
      projects: [],
      changeOrders: [],
      estimates: [],
      invoices: [],
      memories: [],
      vendors: [],
      customers: [],
      equipment: [],
      materials: [],
    });

    const result = await buildDeterministicLearningContext(provider, {
      companyId: "company-a",
      projectId: null,
      customerId: null,
      nowIso: "2026-07-31T00:00:00.000Z",
    });

    assert(result.briefingLines.length === 0, "Briefing lines are empty when confidence is insufficient");
  });

  await test("20. learning service keeps project/customer DNA null when scope absent", async () => {
    const provider = new StubLearningProvider({
      tasks: [task("t1")],
      projects: [project("project-a")],
      memories: [memory("m1")],
    });

    const result = await buildDeterministicLearningContext(provider, {
      companyId: "company-a",
      projectId: null,
      customerId: null,
      nowIso: "2026-07-31T00:00:00.000Z",
    });

    assert(result.projectDNA === null, "Project DNA stays null without project scope");
    assert(result.customerDNA === null, "Customer DNA stays null without customer scope");
  });

  console.log(`\nPhase 10A results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
