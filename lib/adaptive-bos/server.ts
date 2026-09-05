import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveAdaptiveBosConfig,
  type AdaptiveBosCompanyProfile,
  type AdaptiveBosModuleKey,
  type AdaptiveBosResolvedConfig,
} from "./config";

// Adaptive B.O.S. tables are migration-backed until generated database types are refreshed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdaptiveSupabase = SupabaseClient<any>;

type IndustryTemplateRow = {
  key: string;
  label: string;
  labels: unknown;
  enabled_modules: unknown;
  workflow_hints: unknown;
  version: number;
};

const MODULE_KEYS = new Set<AdaptiveBosModuleKey>([
  "dashboard",
  "crm",
  "customers",
  "estimates",
  "projects",
  "scheduling",
  "workforce",
  "payroll",
  "vendors",
  "materials",
  "inventory",
  "procurement",
  "equipment",
  "documents",
  "compliance",
  "finance",
  "banking",
  "orion",
]);

function stringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const output: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string" && item.trim()) output[key] = item.trim();
  }
  return output;
}

function moduleList(value: unknown): AdaptiveBosModuleKey[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is AdaptiveBosModuleKey => typeof item === "string" && MODULE_KEYS.has(item as AdaptiveBosModuleKey));
}

export async function resolveAdaptiveBosConfigFromDatabase(
  supabase: SupabaseClient,
  profile?: AdaptiveBosCompanyProfile | null,
): Promise<AdaptiveBosResolvedConfig> {
  const fallback = resolveAdaptiveBosConfig(profile);
  const requestedKey = (profile?.industryKey || fallback.industryKey).trim().toLowerCase().replace(/[\s-]+/g, "_");
  const db = supabase as unknown as AdaptiveSupabase;
  const { data, error } = await db
    .from("bos_industry_templates")
    .select("key,label,labels,enabled_modules,workflow_hints,version")
    .eq("key", requestedKey)
    .eq("status", "active")
    .maybeSingle();

  if (error || !data) return fallback;

  const template = data as IndustryTemplateRow;
  const templateLabels = stringRecord(template.labels);
  const templateWorkflowHints = stringRecord(template.workflow_hints);
  const templateModules = moduleList(template.enabled_modules);
  const enabled = new Set<AdaptiveBosModuleKey>(templateModules.length ? templateModules : fallback.enabledModules);
  for (const [moduleKey, isEnabled] of Object.entries(profile?.moduleOverrides || {})) {
    if (!MODULE_KEYS.has(moduleKey as AdaptiveBosModuleKey)) continue;
    if (isEnabled) enabled.add(moduleKey as AdaptiveBosModuleKey);
    else enabled.delete(moduleKey as AdaptiveBosModuleKey);
  }

  return {
    industryKey: fallback.industryKey,
    industryLabel: profile?.industryLabel?.trim() || template.label?.trim() || fallback.industryLabel,
    labels: { ...fallback.labels, ...templateLabels, ...(profile?.terminologyOverrides || {}) },
    enabledModules: [...enabled],
    workflowHints: { ...fallback.workflowHints, ...templateWorkflowHints, ...(profile?.workflowOverrides || {}) },
    primaryServices: fallback.primaryServices,
  };
}
