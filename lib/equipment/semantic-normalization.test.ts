import {
  buildFleetSummaryMetrics,
  isEquipmentAvailable,
  isEquipmentConflict,
  isEquipmentIdle,
  isEquipmentInUse,
  isEquipmentMaintenanceDue,
  isEquipmentOutOfService,
  isEquipmentReserved,
  isProjectAssignedEquipmentCounted,
  type EquipmentListItem,
  type EquipmentSemanticSnapshot,
} from "@/lib/equipment";
import { buildPendingDecisions, buildSummaryMetrics, type CommandCenterEquipmentRow } from "@/lib/operations/command-center-normalizer";

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

function makeSnapshot(overrides: Partial<EquipmentSemanticSnapshot>): EquipmentSemanticSnapshot {
  return {
    status: "active",
    maintenanceStatus: "current",
    assignedJobId: null,
    expectedReturnDate: null,
    ...overrides,
  };
}

function toListItem(id: string, snapshot: EquipmentSemanticSnapshot): EquipmentListItem {
  return {
    id,
    equipmentNumber: id.toUpperCase(),
    name: `Asset ${id}`,
    equipmentType: "heavy_equipment",
    category: null,
    manufacturer: null,
    model: null,
    modelYear: null,
    serialNumber: null,
    ownershipType: "owned",
    currentLocationType: null,
    currentLocationName: null,
    assignedJobId: snapshot.assignedJobId,
    assignedEmployeeId: null,
    assignedCrewId: null,
    assignedAt: null,
    expectedReturnDate: snapshot.expectedReturnDate ?? null,
    effectiveInternalHourlyCost: 0,
    hourlyBillableRate: 0,
    maintenanceStatus: snapshot.maintenanceStatus as EquipmentListItem["maintenanceStatus"],
    status: snapshot.status as EquipmentListItem["status"],
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
    updatedAt: "2026-07-28T00:00:00.000Z",
  };
}

function toCommandCenterEquipmentRow(id: string, snapshot: EquipmentSemanticSnapshot): CommandCenterEquipmentRow {
  return {
    id,
    equipmentNumber: id.toUpperCase(),
    name: `Asset ${id}`,
    status: snapshot.status,
    maintenanceStatus: snapshot.maintenanceStatus,
    assignedJobId: snapshot.assignedJobId,
    nextServiceDate: null,
  };
}

async function main() {
  const fixtures = [
    makeSnapshot({ status: "active", assignedJobId: "p1" }),
    makeSnapshot({ status: "active", assignedJobId: null }),
    makeSnapshot({ status: "active", assignedJobId: null, expectedReturnDate: "2026-08-20" }),
    makeSnapshot({ status: "maintenance", assignedJobId: "p1", maintenanceStatus: "due_soon" }),
    makeSnapshot({ status: "out_of_service", assignedJobId: "p2", maintenanceStatus: "overdue" }),
    makeSnapshot({ status: "active", assignedJobId: "p1", maintenanceStatus: "overdue" }),
    makeSnapshot({ status: "out_of_service", assignedJobId: null, maintenanceStatus: "current" }),
  ];

  const listItems = fixtures.map((item, index) => toListItem(`eq-${index + 1}`, item));
  const commandRows = fixtures.map((item, index) => toCommandCenterEquipmentRow(`eq-${index + 1}`, item));

  await test("1. canonical semantic helper classifications are deterministic", () => {
    assert(fixtures.filter(isEquipmentInUse).length === 2, "in-use count is deterministic");
    assert(fixtures.filter(isEquipmentAvailable).length === 2, "available count is deterministic");
    assert(fixtures.filter(isEquipmentReserved).length === 1, "reserved count is deterministic");
    assert(fixtures.filter(isEquipmentIdle).length === 1, "idle count is deterministic");
    assert(fixtures.filter(isEquipmentMaintenanceDue).length === 3, "maintenance-due count is deterministic");
    assert(fixtures.filter(isEquipmentOutOfService).length === 3, "out-of-service count is deterministic");
    assert(fixtures.filter(isEquipmentConflict).length === 3, "conflict count is deterministic");
    assert(!isEquipmentConflict(fixtures[6]), "out-of-service equipment without assigned project is not a conflict");
  });

  await test("2. fleet and operations use identical semantic outcomes from identical data", () => {
    const fleet = buildFleetSummaryMetrics(listItems);
    const operations = buildSummaryMetrics({
      projects: [],
      tasks: [],
      schedule: [],
      photos: [],
      changeOrders: [],
      workforceRows: [],
      equipment: commandRows,
      todayIso: "2026-08-01",
      alertCount: 0,
      workforceAvailability: "partial",
      scheduleAvailability: "partial",
    });

    const fleetById = new Map(fleet.map((metric) => [metric.id, metric.value]));
    const operationsById = new Map(operations.map((metric) => [metric.id, metric.value]));

    assert(fleetById.get("equipmentInUse") === operationsById.get("equipmentInUse"), "fleet and operations in-use counts align");
    assert(fleetById.get("maintenanceDue") === operationsById.get("equipmentMaintenanceDue"), "fleet and operations maintenance-due counts align");
    assert(operationsById.get("equipmentConflicts") === fixtures.filter(isEquipmentConflict).length, "operations conflict metric aligns with canonical helper");
  });

  await test("3. project workspace canonical counts align with shared semantics", () => {
    const assignedProjectWide = fixtures.filter(isProjectAssignedEquipmentCounted).length;
    const available = fixtures.filter(isEquipmentAvailable).length;
    const projectOneConflicts = fixtures.filter((item) => item.assignedJobId === "p1" && isEquipmentConflict(item)).length;

    assert(assignedProjectWide === 4, "assigned equipment count semantics match project workspace status rules");
    assert(available === 2, "available count semantics match project workspace active-unassigned rules");
    assert(projectOneConflicts === 2, "project conflict semantics match assigned + overdue/out-of-service rules");
  });

  await test("4. pending equipment decisions use canonical conflict semantics", () => {
    const decisions = buildPendingDecisions({
      tasks: [],
      projectNameById: new Map([
        ["p1", "Project One"],
        ["p2", "Project Two"],
      ]),
      profileNameById: new Map(),
      changeOrders: [],
      estimates: [],
      invoices: [],
      equipment: commandRows,
    });

    const equipmentDecisions = decisions.filter((item) => item.decisionType === "equipment");
    assert(equipmentDecisions.length === fixtures.filter(isEquipmentConflict).length, "equipment decisions are created only for canonical conflict assets");
    assert(equipmentDecisions.every((item) => item.href.startsWith("/equipment/")), "equipment decision routes are deterministic and stable");
  });

  console.log(`\nEquipment semantic normalization results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
