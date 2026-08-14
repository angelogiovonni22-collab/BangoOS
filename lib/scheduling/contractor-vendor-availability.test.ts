import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Database } from "@/types/database.types";
import { buildAvailableContractorsOrVendors } from "./contractor-vendor-availability";

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
type AssignmentRow = Database["public"]["Tables"]["trade_partner_assignments"]["Row"];

function vendor(overrides: Partial<VendorRow> & Pick<VendorRow, "id" | "display_name">): VendorRow {
  return {
    id: overrides.id,
    display_name: overrides.display_name,
    company_name: overrides.display_name,
    vendor_code: overrides.vendor_code ?? overrides.id.toUpperCase(),
    status: overrides.status ?? "active",
    preferred_vendor: overrides.preferred_vendor ?? false,
    city: overrides.city ?? null,
    state: overrides.state ?? null,
    email: overrides.email ?? null,
    mobile: overrides.mobile ?? null,
    phone: overrides.phone ?? null,
  } as VendorRow;
}

function assignment(overrides: Partial<AssignmentRow> & Pick<AssignmentRow, "vendor_id">): AssignmentRow {
  return {
    vendor_id: overrides.vendor_id,
    assignment_status: overrides.assignment_status ?? "active",
    start_date: overrides.start_date ?? null,
    target_completion_date: overrides.target_completion_date ?? null,
  } as AssignmentRow;
}

const today = "2026-08-11";
const available = buildAvailableContractorsOrVendors(
  [
    vendor({ id: "busy", display_name: "Busy Builder" }),
    vendor({ id: "future", display_name: "Future Electric" }),
    vendor({ id: "preferred", display_name: "Preferred Plumbing", preferred_vendor: true, city: "Austin", state: "TX", email: "crew@example.com" }),
    vendor({ id: "inactive", display_name: "Inactive Vendor", status: "inactive" }),
  ],
  [
    assignment({ vendor_id: "busy", start_date: "2026-08-01", target_completion_date: "2026-08-20" }),
    assignment({ vendor_id: "future", start_date: "2026-08-12", target_completion_date: "2026-08-20" }),
  ],
  today,
);

assert.deepEqual(available.map((item) => item.vendorId), ["preferred", "future"]);
assert.equal(available[0]?.location, "Austin, TX");
assert.equal(available[0]?.contact, "crew@example.com");

const panelSource = fs.readFileSync(path.resolve(process.cwd(), "components/scheduling/available-resources-panel.tsx"), "utf8");
const dashboardSource = fs.readFileSync(path.resolve(process.cwd(), "components/scheduling/scheduling-dashboard.tsx"), "utf8");
assert.ok(panelSource.includes("ContractorVendorAvailability"));
assert.ok(panelSource.includes("/vendors/${item.vendorId}"));
assert.ok(!panelSource.includes('resourceType === "employee"'));
assert.ok(dashboardSource.includes("payload.contractorVendors ?? []"));

console.log("+ contractor/vendor availability uses real vendor assignments and accurate UI semantics");
