import type { Database } from "@/types/database.types";
import type { ContractorVendorAvailability } from "./types";

type VendorRow = Database["public"]["Tables"]["vendors"]["Row"];
type TradePartnerAssignmentRow = Database["public"]["Tables"]["trade_partner_assignments"]["Row"];

export function buildAvailableContractorsOrVendors(
  vendors: VendorRow[],
  assignments: TradePartnerAssignmentRow[],
  today: string,
): ContractorVendorAvailability[] {
  const assignedVendorIds = new Set(
    assignments
      .filter((assignment) => assignment.assignment_status === "active")
      .filter((assignment) => (!assignment.start_date || assignment.start_date <= today)
        && (!assignment.target_completion_date || assignment.target_completion_date >= today))
      .map((assignment) => assignment.vendor_id),
  );

  return vendors
    .filter((vendor) => vendor.status === "active" && !assignedVendorIds.has(vendor.id))
    .map((vendor) => ({
      id: `contractor-vendor-${vendor.id}`,
      vendorId: vendor.id,
      name: vendor.display_name || vendor.company_name,
      vendorCode: vendor.vendor_code,
      location: [vendor.city, vendor.state].filter(Boolean).join(", ") || "Location not set",
      contact: vendor.email || vendor.mobile || vendor.phone || "Contact not set",
      preferred: vendor.preferred_vendor,
    }))
    .sort((left, right) => Number(right.preferred) - Number(left.preferred) || left.name.localeCompare(right.name));
}
