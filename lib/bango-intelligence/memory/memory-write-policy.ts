import type { MemoryActor, MemoryCategory, MemoryWriteSource } from "./memory-types";

const MEMORY_WRITER_ROLES = new Set([
  "owner",
  "administrator",
  "operations_manager",
  "project_manager",
  "superintendent",
  "estimator",
  "foreman",
  "office_manager",
  "accountant",
]);

const VERIFIED_LESSON_ROLES = new Set(["owner", "administrator", "operations_manager", "project_manager", "superintendent"]);
const FINANCIAL_MEMORY_ROLES = new Set(["owner", "administrator", "accountant", "operations_manager"]);

export function canActorWriteMemory(
  actor: MemoryActor,
  source: MemoryWriteSource,
  category: MemoryCategory,
): { allowed: boolean; reason: string | null } {
  const role = actor.companyRole ?? "employee";

  if (!MEMORY_WRITER_ROLES.has(role)) {
    return { allowed: false, reason: "Role is not allowed to create business memory." };
  }

  if (source === "verified_project_lesson" && !VERIFIED_LESSON_ROLES.has(role)) {
    return { allowed: false, reason: "Only authorized roles can record verified lessons." };
  }

  if (category === "financial_insight" && !FINANCIAL_MEMORY_ROLES.has(role)) {
    return { allowed: false, reason: "Role cannot write financial insight memories." };
  }

  return { allowed: true, reason: null };
}
