import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { normalizeIndustryKey, resolveAdaptiveBosConfig } from "./config";

const root = process.cwd();
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260904203000_adaptive_bos_configuration_engine.sql"), "utf8");
const route = fs.readFileSync(path.join(root, "app/api/adaptive-bos/profile/route.ts"), "utf8");

assert(migration.includes("create table public.bos_industry_templates"));
assert(migration.includes("create table public.company_operating_profiles"));
assert(migration.includes("Cleaning Services"));
assert(migration.includes("Healthcare"));
assert(migration.includes("Manufacturing"));
assert(migration.includes("Logistics"));
assert(migration.includes("Professional Services"));
assert(migration.includes("Preserve every existing B.O.S. workspace as construction"));
assert(route.includes("resolveWorkspaceContext"), "Adaptive profile API must stay tenant-scoped");
assert(route.includes("No supported profile fields were supplied."));

assert.equal(normalizeIndustryKey("commercial construction contractor"), "construction");
assert.equal(normalizeIndustryKey("janitorial cleaning company"), "cleaning");
assert.equal(normalizeIndustryKey("medical clinic"), "healthcare");
assert.equal(normalizeIndustryKey("freight and trucking"), "logistics");
assert.equal(normalizeIndustryKey("unknown niche business"), "generic");

const cleaning = resolveAdaptiveBosConfig({ industryKey:"cleaning" });
assert.equal(cleaning.labels.materials, "Cleaning Supplies");
assert.equal(cleaning.labels.project, "Service Job");
assert(cleaning.enabledModules.includes("inventory"));

const construction = resolveAdaptiveBosConfig();
assert.equal(construction.industryKey, "construction");
assert.equal(construction.labels.project, "Project");
assert(construction.enabledModules.includes("materials"));

const customized = resolveAdaptiveBosConfig({
  industryKey:"professional services",
  terminologyOverrides:{ project:"Matter" },
  moduleOverrides:{ inventory:true, equipment:false },
});
assert.equal(customized.industryKey, "professional_services");
assert.equal(customized.labels.project, "Matter");
assert(customized.enabledModules.includes("inventory"));
assert(!customized.enabledModules.includes("equipment"));

console.log("Adaptive B.O.S. configuration contract passed");
