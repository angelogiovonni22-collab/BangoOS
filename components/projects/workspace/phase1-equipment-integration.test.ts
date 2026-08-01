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
  const page = read("app/(app)/projects/[id]/page.tsx");

  await test("1. equipment project workspace card keeps navigation and count tuple", () => {
    assert(page.includes('title="Equipment"'), "resources tab includes equipment module card");
    assert(page.includes('metricLabel="Assigned / Available / Conflicts"'), "equipment card labels the three count categories");
    assert(page.includes('metricValue={`${workspace.counts.assignedEquipment} / ${workspace.counts.availableEquipment} / ${workspace.counts.equipmentConflicts}`}'), "equipment card uses the three workspace counts directly");
    assert(page.includes('href="/equipment"'), "equipment card routes to equipment workspace");
  });

  await test("2. assigned equipment count is company-scoped and project-scoped", () => {
    assert(
      /from\("equipment"\)[\s\S]*?select\("id", \{ count: "exact", head: true \}\)[\s\S]*?eq\("company_id", workspaceResult\.context\.companyId\)[\s\S]*?eq\("assigned_job_id", projectId\)[\s\S]*?in\("status", \[\.\.\.PROJECT_WORKSPACE_ASSIGNED_EQUIPMENT_STATUSES\]\)/.test(page),
      "assigned equipment count is scoped by company_id + project id and uses shared project-workspace assigned status semantics",
    );
  });

  await test("3. available equipment count is company-scoped and unassigned", () => {
    assert(
      /from\("equipment"\)[\s\S]*?select\("id", \{ count: "exact", head: true \}\)[\s\S]*?eq\("company_id", workspaceResult\.context\.companyId\)[\s\S]*?eq\("status", "active"\)[\s\S]*?is\("assigned_job_id", null\)/.test(page),
      "available equipment count is scoped by company_id, active status, and no assigned project",
    );
  });

  await test("4. conflict count is company-scoped and tied to project allocation", () => {
    assert(
      /from\("equipment"\)[\s\S]*?select\("id", \{ count: "exact", head: true \}\)[\s\S]*?eq\("company_id", workspaceResult\.context\.companyId\)[\s\S]*?eq\("assigned_job_id", projectId\)[\s\S]*?or\(PROJECT_WORKSPACE_EQUIPMENT_CONFLICT_OR_FILTER\)/.test(page),
      "equipment conflict count uses shared project-workspace conflict semantics",
    );
  });

  await test("5. no-equipment case stays deterministic", () => {
    assert(page.includes("assignedEquipment: assignedEquipmentCountResponse.count || 0"), "assigned equipment count falls back to 0");
    assert(page.includes("availableEquipment: availableEquipmentCountResponse.count || 0"), "available equipment count falls back to 0");
    assert(page.includes("equipmentConflicts: equipmentConflictCountResponse.count || 0"), "conflict count falls back to 0");
  });

  console.log(`\nProject Workspace equipment integration results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
