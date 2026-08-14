import type { MemoryCategory } from "./memory-types";

export const MEMORY_CATEGORIES: readonly MemoryCategory[] = [
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
  "conversation_summary",
] as const;
