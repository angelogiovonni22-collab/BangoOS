import fs from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;

function read(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

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

async function main() {
  const workspaceComponent = read("components/projects/workspace/project-trade-partners-workspace.tsx");
  const pageSource = read("app/(app)/projects/[id]/page.tsx");

  await test("1. empty state readability and action are present", () => {
    check(workspaceComponent.includes("No Subcontractors Assigned"), "empty-state title exists");
    check(workspaceComponent.includes("Assign your first subcontractor"), "empty-state description exists");
    check(workspaceComponent.includes("Assign Subcontractor"), "primary action label exists");
  });

  await test("2. component uses service-only data access", () => {
    check(workspaceComponent.includes("createTradePartnerAssignmentsService"), "trade partner assignment service is used");
    check(workspaceComponent.includes("createVendorsService"), "vendor service is used");
    check(!workspaceComponent.includes('.from("'), "component does not query Supabase directly");
  });

  await test("3. assignment flow handles create, edit, and archive", () => {
    check(workspaceComponent.includes("createTradePartnerAssignment"), "create flow wired");
    check(workspaceComponent.includes("updateTradePartnerAssignment"), "edit flow wired");
    check(workspaceComponent.includes("archiveTradePartnerAssignment"), "archive flow wired");
    check(workspaceComponent.includes("View Details"), "view details action exists");
    check(workspaceComponent.includes("Edit"), "edit action exists");
    check(workspaceComponent.includes("Archive"), "archive action exists");
  });

  await test("4. summary panel and fallbacks are present", () => {
    check(workspaceComponent.includes("Project Subcontractor Summary"), "summary panel title exists");
    check(workspaceComponent.includes("Total Assigned"), "total assigned metric exists");
    check(workspaceComponent.includes("Total Contract Value"), "total contract value metric exists");
    check(workspaceComponent.includes("Average Crew Size"), "average crew size metric exists");
    check(workspaceComponent.includes("Next Scheduled Start"), "next scheduled start metric exists");
    check(workspaceComponent.includes("Not Assigned"), "not assigned fallback exists");
    check(workspaceComponent.includes("Not Scheduled"), "not scheduled fallback exists");
    check(workspaceComponent.includes("Not Provided"), "not provided fallback exists");
  });

  await test("5. duplicate prevention and validation UX exist", () => {
    check(workspaceComponent.includes("This vendor already has an active assignment on this project."), "duplicate active assignment conflict message exists");
    check(workspaceComponent.includes("Vendor is required."), "required vendor validation exists");
    check(workspaceComponent.includes("Trade is required."), "required trade validation exists");
  });

  await test("6. project workspace routes subcontractors tab to component", () => {
    check(pageSource.includes("ProjectTradePartnersWorkspace"), "workspace page imports or renders component");
    check(pageSource.includes('activeTab === "subcontractors"'), "subcontractors tab branch exists");
  });

  console.log(`\nTrade partner workspace contract results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
