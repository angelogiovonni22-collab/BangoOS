import type { MemoryActor, MemoryCategory, MemoryRecord } from "./memory-types";

const FINANCIAL_ROLES = new Set(["owner", "administrator", "operations_manager", "accountant"]);
const HR_SENSITIVE_ROLES = new Set(["owner", "administrator", "hr_assistant"]);
const LEGAL_SENSITIVE_ROLES = new Set(["owner", "administrator", "operations_manager"]);
const SAFETY_SENSITIVE_ROLES = new Set(["owner", "administrator", "operations_manager"]);

export function canActorReadMemory(actor: Pick<MemoryActor, "companyRole" | "allowedCapabilities">, record: Pick<MemoryRecord, "category" | "tags">): boolean {
  const role = actor.companyRole ?? "employee";
  const tags = new Set(record.tags.map((tag) => tag.toLowerCase()));

  if (record.category === "financial_insight" && !FINANCIAL_ROLES.has(role) && !actor.allowedCapabilities.includes("read_financials")) {
    return false;
  }

  if (hasAnyTag(tags, ["private_payroll", "disciplinary", "restricted_hr"]) && !HR_SENSITIVE_ROLES.has(role)) {
    return false;
  }

  if (hasAnyTag(tags, ["restricted_legal", "confidential_document"]) && !LEGAL_SENSITIVE_ROLES.has(role)) {
    return false;
  }

  if (hasAnyTag(tags, ["sensitive_safety_investigation"]) && !SAFETY_SENSITIVE_ROLES.has(role)) {
    return false;
  }

  return true;
}

export function defaultCategoriesForRole(actor: Pick<MemoryActor, "companyRole">): MemoryCategory[] {
  const role = actor.companyRole ?? "employee";
  const base: MemoryCategory[] = [
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
    "project_milestone",
    "document_summary",
  ];

  if (FINANCIAL_ROLES.has(role)) {
    base.push("financial_insight");
  }

  return base;
}

function hasAnyTag(tagSet: Set<string>, values: string[]): boolean {
  return values.some((value) => tagSet.has(value));
}
