import type { MemoryCapabilities, MemoryRecord, MemoryRetrievalQuery } from "./memory-types";

export function buildMemoryCapabilities(roleId: string): MemoryCapabilities {
  switch (roleId) {
    case "superintendent":
      return {
        roleId,
        allowedCategories: [
          "preference",
          "decision",
          "recommendation",
          "outcome",
          "lesson_learned",
          "operational_pattern",
          "customer_preference",
          "vendor_preference",
          "crew_performance",
          "safety_observation",
          "financial_insight",
          "project_milestone",
          "document_summary",
        ],
        deniedCategories: ["conversation_summary"],
        canReadRestrictedFinancials: false,
        canReadRestrictedHR: false,
      };
    case "financial_advisor":
      return {
        roleId,
        allowedCategories: [
          "preference",
          "decision",
          "recommendation",
          "outcome",
          "lesson_learned",
          "operational_pattern",
          "customer_preference",
          "vendor_preference",
          "crew_performance",
          "safety_observation",
          "financial_insight",
          "project_milestone",
          "document_summary",
        ],
        deniedCategories: ["conversation_summary"],
        canReadRestrictedFinancials: true,
        canReadRestrictedHR: false,
      };
    case "hr_assistant":
      return {
        roleId,
        allowedCategories: ["preference", "decision", "recommendation", "outcome", "lesson_learned", "operational_pattern", "document_summary"],
        deniedCategories: ["conversation_summary", "financial_insight", "safety_observation"],
        canReadRestrictedFinancials: false,
        canReadRestrictedHR: true,
      };
    default:
      return {
        roleId,
        allowedCategories: [
          "preference",
          "decision",
          "recommendation",
          "outcome",
          "lesson_learned",
          "operational_pattern",
          "customer_preference",
          "vendor_preference",
          "crew_performance",
          "safety_observation",
          "financial_insight",
          "project_milestone",
          "document_summary",
        ],
        deniedCategories: ["conversation_summary"],
        canReadRestrictedFinancials: false,
        canReadRestrictedHR: false,
      };
  }
}

export function canReadMemory(record: MemoryRecord, query: MemoryRetrievalQuery, capabilities: MemoryCapabilities): boolean {
  if (query.roleId && query.roleId !== capabilities.roleId) {
    return false;
  }

  if (record.roleRestrictions?.some((restriction) => restriction.deniedRoles?.includes(capabilities.roleId))) {
    return false;
  }

  if (record.roleRestrictions?.some((restriction) => restriction.prohibitedCategories?.includes(record.category))) {
    return false;
  }

  if (!capabilities.allowedCategories.includes(record.category)) {
    return false;
  }

  if (capabilities.deniedCategories.includes(record.category)) {
    return false;
  }

  const tags = new Set(record.tags.map((tag) => tag.toLowerCase()));
  if (!capabilities.canReadRestrictedFinancials && (record.category === "financial_insight" || tags.has("restricted-financial") || tags.has("private-payroll"))) {
    return false;
  }

  if (!capabilities.canReadRestrictedHR && tags.has("restricted-hr")) {
    return false;
  }

  return true;
}
