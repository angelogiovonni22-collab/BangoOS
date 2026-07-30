import type { EstimateLineCategory, EstimateStatus, EstimateUnit } from "@/lib/estimates/types";

export const ESTIMATE_CATEGORY_OPTIONS: Array<{ value: EstimateLineCategory; label: string }> = [
  { value: "labor", label: "Labor" },
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment" },
  { value: "subcontractors", label: "Subcontractors" },
  { value: "general_conditions", label: "General Conditions" },
  { value: "permits_fees", label: "Permits and Fees" },
  { value: "other", label: "Other" },
];

export const ESTIMATE_UNIT_OPTIONS: Array<{ value: EstimateUnit; label: string }> = [
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "square_foot", label: "Square Foot" },
  { value: "linear_foot", label: "Linear Foot" },
  { value: "cubic_yard", label: "Cubic Yard" },
  { value: "lump_sum", label: "Lump Sum" },
];

export const ESTIMATE_STATUS_OPTIONS: Array<{ value: EstimateStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "internal_review", label: "Internal Review" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "archived", label: "Archived" },
  { value: "ready", label: "Ready" },
  { value: "revision_requested", label: "Revision Requested" },
  { value: "void", label: "Void" },
  { value: "superseded", label: "Superseded" },
];
