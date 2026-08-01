import {
  buildEquipmentQueryPlan,
  buildFleetGridRows,
  buildFleetSummaryMetrics,
  getEquipmentStatusView,
  isEquipmentAvailable,
  isEquipmentIdle,
  isEquipmentInUse,
  isEquipmentInspectionAlert,
  readSavedEquipmentViews,
  writeSavedEquipmentViews,
  type EquipmentListItem,
  type EquipmentSavedView,
  type StorageLike,
} from "@/lib/equipment";

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

function makeItem(overrides: Partial<EquipmentListItem>): EquipmentListItem {
  return {
    id: "eq-1",
    equipmentNumber: "EQ-1",
    name: "Excavator",
    equipmentType: "heavy_equipment",
    category: "Earthwork",
    manufacturer: "CAT",
    model: "320",
    modelYear: 2024,
    serialNumber: "SER-1",
    ownershipType: "owned",
    currentLocationType: "jobsite",
    currentLocationName: "Site A",
    assignedJobId: null,
    assignedEmployeeId: null,
    assignedCrewId: null,
    assignedAt: null,
    expectedReturnDate: null,
    effectiveInternalHourlyCost: 100,
    hourlyBillableRate: 150,
    maintenanceStatus: "current",
    status: "active",
    nextServiceDate: null,
    lastServiceDate: null,
    inspectionExpirationDate: null,
    warrantyExpirationDate: null,
    registrationExpirationDate: null,
    insuranceExpirationDate: null,
    certificationExpirationDate: null,
    qrCode: null,
    purchaseDate: null,
    purchasePrice: 0,
    currentValue: 0,
    meterType: null,
    currentMeterReading: 0,
    lifetimeHours: 0,
    lifetimeMiles: 0,
    utilizationTargetPercent: null,
    conditionScore: null,
    fuelType: null,
    maintenanceNotes: null,
    notes: null,
    defaultCostCodeId: null,
    defaultCostCodeLabel: null,
    vendorId: null,
    vendorName: null,
    criticalityLevel: "standard",
    replacementPriority: "normal",
    createdAt: "2026-07-28T00:00:00.000Z",
    updatedAt: "2026-07-31T00:00:00.000Z",
    ...overrides,
  };
}

async function main() {
  await test("1. equipment list query plan captures search + filters", () => {
    const plan = buildEquipmentQueryPlan({
      query: "EQ-1,CAT",
      status: "active",
      equipmentType: "all",
      category: "earth",
      ownershipType: "owned",
      vendorId: "ven-1",
      maintenanceStatus: "overdue",
      locationType: "jobsite",
      defaultCostCodeId: "cc-1",
      criticalityLevel: "high",
      replacementPriority: "urgent",
      assignedJobId: "proj-1",
      assignedEmployeeId: "emp-1",
      sortBy: "equipment_number_asc",
    });

    assert(plan.searchOr !== null && plan.searchOr.includes("EQ-1 CAT"), "search query is sanitized and added to OR filter plan");
    assert(plan.equals.some((item) => item.column === "status" && item.value === "active"), "status filter is represented in equals plan");
    assert(plan.ilike.some((item) => item.column === "category" && item.value === "%earth%"), "category filter is represented in ilike plan");
    assert(plan.equals.some((item) => item.column === "assigned_job_id" && item.value === "proj-1"), "project filter is represented in equals plan");
    assert(plan.equals.some((item) => item.column === "assigned_employee_id" && item.value === "emp-1"), "assigned employee filter is represented in equals plan");
  });

  await test("2. saved view storage helper is browser-safe and deterministic", () => {
    const memoryStore = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => memoryStore.get(key) ?? null,
      setItem: (key, value) => {
        memoryStore.set(key, value);
      },
    };

    const views: EquipmentSavedView[] = [
      {
        id: "view-1",
        name: "Active Earthwork",
        query: "EQ",
        status: "active",
        equipmentType: "all",
        category: "Earthwork",
        ownershipType: "owned",
        vendorId: "",
        maintenanceStatus: "all",
        locationType: "all",
        defaultCostCodeId: "",
        criticalityLevel: "all",
        replacementPriority: "all",
        assignedJobId: "",
        assignedEmployeeId: "",
        sortBy: "equipment_number_asc",
      },
    ];

    writeSavedEquipmentViews(storage, views, "test.views");
    const roundTrip = readSavedEquipmentViews(storage, "test.views");

    assert(roundTrip.length === 1 && roundTrip[0].name === "Active Earthwork", "saved views serialize and deserialize consistently");
    assert(readSavedEquipmentViews(null, "test.views").length === 0, "server-render-safe read returns empty with no storage");
  });

  await test("3. fleet status logic covers active/assigned/available/idle/maintenance/conflict states", () => {
    const assigned = makeItem({ id: "eq-assigned", status: "active", assignedJobId: "proj-1" });
    const employeeOnlyAssigned = makeItem({ id: "eq-employee-only", status: "active", assignedEmployeeId: "emp-1" });
    const idle = makeItem({ id: "eq-idle", status: "active" });
    const reserved = makeItem({ id: "eq-reserved", status: "active", expectedReturnDate: "2026-08-15" });
    const maintenance = makeItem({ id: "eq-maint", status: "maintenance", maintenanceStatus: "due_soon" });
    const outOfService = makeItem({ id: "eq-oos", status: "out_of_service", maintenanceStatus: "overdue", inspectionExpirationDate: "2026-07-20" });

    const items = [assigned, employeeOnlyAssigned, idle, reserved, maintenance, outOfService];
    const metrics = buildFleetSummaryMetrics(items);
    const rows = buildFleetGridRows(items, { "proj-1": "Project A" }, {});

    assert(isEquipmentInUse(assigned), "assigned active equipment is in use");
    assert(!isEquipmentInUse(employeeOnlyAssigned), "employee-only assignment does not count as in use without assigned project (project-workspace canonical behavior)");
    assert(isEquipmentAvailable(idle) && isEquipmentAvailable(reserved), "available state aligns with active + no project assignment");
    assert(isEquipmentIdle(idle), "active unassigned equipment without expected return is idle");
    assert(getEquipmentStatusView(maintenance) === "out_of_service", "maintenance status maps to out_of_service view");
    assert(getEquipmentStatusView(outOfService) === "out_of_service", "out_of_service status maps to out_of_service view");
    assert(isEquipmentInspectionAlert(outOfService), "inspection conflict alert is raised when inspection is overdue/near due");

    const metricById = new Map(metrics.map((metric) => [metric.id, metric.value]));
    assert(metricById.get("equipmentInUse") === 1, "summary tracks equipment in use deterministically");
    assert(metricById.get("idleEquipment") === 2, "summary tracks idle equipment deterministically");
    assert(metricById.get("maintenanceDue") === 2, "summary tracks due soon + overdue maintenance deterministically");
    assert(metricById.get("outOfService") === 2, "summary tracks maintenance + out_of_service assets deterministically");
    assert(metricById.get("inspectionAlerts") === 1, "summary tracks inspection alerts where supported");

    const assignedRow = rows.find((row) => row.equipmentId === "eq-assigned");
    assert(assignedRow?.currentProject === "Project A", "grid maps assigned project labels for navigation context");
  });

  console.log(`\nEquipment Phase 1 hardening results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
