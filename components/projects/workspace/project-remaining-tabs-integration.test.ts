import fs from "node:fs";
import path from "node:path";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function test(name: string, run: () => void) {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}`);
    throw error;
  }
}

const bridgePath = path.join(process.cwd(), "components", "projects", "workspace", "project-command-center-tab-placeholder.tsx");
const linkedModulePath = path.join(process.cwd(), "components", "projects", "workspace", "project-linked-module-workspace.tsx");
const customerBridgePath = path.join(process.cwd(), "components", "projects", "workspace", "project-customer-snapshot-bridge.tsx");
const bridge = fs.readFileSync(bridgePath, "utf8");
const linkedModule = fs.readFileSync(linkedModulePath, "utf8");
const customerBridge = fs.readFileSync(customerBridgePath, "utf8");

const linkedTabs = ["daily_logs", "documents", "crew", "change_orders", "rfis"];

test("remaining project tabs are routed to live project module workspaces", () => {
  assert(bridge.includes("ProjectLinkedModuleWorkspace"), "Shared project tab bridge should render ProjectLinkedModuleWorkspace");
  for (const tab of linkedTabs) {
    assert(bridge.includes(`\"${tab}\"`), `Shared project tab bridge should register ${tab}`);
  }
});

test("linked project workspace reads project-scoped operational data", () => {
  assert(linkedModule.includes('from("workflow_events")'), "Daily logs should read workflow events");
  assert(linkedModule.includes('from("workforce_assignments")'), "Crew should read workforce assignments");
  assert(linkedModule.includes('from("change_orders")'), "Change Orders should read change orders");
  assert(linkedModule.includes('from("project_communications")'), "RFIs should read project communications");
  assert(linkedModule.includes('tab === "documents"'), "Documents should render the linked project record index");
  assert(linkedModule.includes('.eq("project_id", projectId)'), "Operational records should be scoped to the active project");
});

test("linked project tabs surface the existing customer snapshot", () => {
  assert(bridge.includes("ProjectCustomerSnapshotBridge"), "Linked project tabs should render the customer snapshot bridge");
  assert(customerBridge.includes("ProjectCustomerSnapshot"), "Customer bridge should reuse ProjectCustomerSnapshot");
  assert(customerBridge.includes('from("customers")'), "Customer bridge should load the linked customer record");
});
