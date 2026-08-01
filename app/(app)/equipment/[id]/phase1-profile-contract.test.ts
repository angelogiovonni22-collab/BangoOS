import fs from "node:fs";
import path from "node:path";

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

async function main() {
  const detailClient = read("app/(app)/equipment/[id]/equipment-detail-client.tsx");

  await test("1. route loading and company scoping remain intact", () => {
    assert(detailClient.includes("useParams"), "equipment detail reads route params");
    assert(detailClient.includes('.eq("id", equipmentId)'), "equipment detail query is scoped to route id");
    assert(detailClient.includes('.eq("company_id", workspace.context.companyId)'), "equipment detail query is scoped to company_id");
  });

  await test("2. profile partial-data notices remain explicit for unsupported tabs", () => {
    assert(detailClient.includes("dedicated history tables are not yet present"), "global partial-data notice exists for unsupported history data");
    assert(detailClient.includes("assignment-history table"), "assignments tab keeps explicit unsupported-history notice");
    assert(detailClient.includes("maintenance-log tables not yet present"), "maintenance tab keeps explicit unsupported-history notice");
    assert(detailClient.includes("dedicated inspection tables not yet present"), "inspections tab keeps explicit unsupported-history notice");
  });

  await test("3. overview values and navigation links remain intact", () => {
    assert(detailClient.includes('InfoRow label="Equipment number"'), "overview tab renders equipment number value");
    assert(detailClient.includes('InfoRow label="Status"'), "overview tab renders status value");
    assert(detailClient.includes('InfoRow label="Current project"'), "overview tab renders current project value");
    assert(detailClient.includes('href="/equipment"'), "breadcrumb supports navigation back to equipment list");
    assert(detailClient.includes('href={`/equipment/${equipment.id}/edit`}'), "detail page supports edit route navigation");
  });

  await test("4. unsupported timeline records are not fabricated", () => {
    assert(!detailClient.includes('from("equipment_assignment_history")'), "detail page does not query a missing assignment history table");
    assert(!detailClient.includes('from("equipment_maintenance_logs")'), "detail page does not query a missing maintenance log table");
    assert(!detailClient.includes("mockTimeline"), "detail page does not inject fake timeline data");
  });

  console.log(`\nEquipment profile phase 1 contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
