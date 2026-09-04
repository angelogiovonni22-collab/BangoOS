export type AdaptiveIndustryKey =
  | "construction"
  | "cleaning"
  | "healthcare"
  | "manufacturing"
  | "logistics"
  | "professional_services"
  | "generic";

export type AdaptiveBosModuleKey =
  | "dashboard"
  | "crm"
  | "customers"
  | "estimates"
  | "projects"
  | "scheduling"
  | "workforce"
  | "payroll"
  | "vendors"
  | "materials"
  | "inventory"
  | "procurement"
  | "equipment"
  | "documents"
  | "compliance"
  | "finance"
  | "banking"
  | "orion";

export type AdaptiveBosTemplate = {
  key: AdaptiveIndustryKey;
  label: string;
  labels: Record<string, string>;
  enabledModules: AdaptiveBosModuleKey[];
  workflowHints: Record<string, string>;
};

export type AdaptiveBosCompanyProfile = {
  industryKey?: string | null;
  industryLabel?: string | null;
  businessModel?: string | null;
  primaryServices?: string[] | null;
  moduleOverrides?: Partial<Record<AdaptiveBosModuleKey, boolean>> | null;
  terminologyOverrides?: Record<string, string> | null;
  workflowOverrides?: Record<string, string> | null;
};

export type AdaptiveBosResolvedConfig = {
  industryKey: AdaptiveIndustryKey;
  industryLabel: string;
  labels: Record<string, string>;
  enabledModules: AdaptiveBosModuleKey[];
  workflowHints: Record<string, string>;
  primaryServices: string[];
};

const COMMON_MODULES: AdaptiveBosModuleKey[] = [
  "dashboard",
  "crm",
  "customers",
  "estimates",
  "projects",
  "scheduling",
  "workforce",
  "vendors",
  "documents",
  "finance",
  "banking",
  "orion",
];

export const ADAPTIVE_BOS_TEMPLATES: Record<AdaptiveIndustryKey, AdaptiveBosTemplate> = {
  construction: {
    key: "construction",
    label: "Construction",
    labels: {
      project: "Project",
      projects: "Projects",
      customer: "Customer",
      customers: "Customers",
      estimate: "Estimate",
      estimates: "Estimates",
      vendor: "Contractor or Vendor",
      vendors: "Contractors & Vendors",
      workforce: "Workforce",
      materials: "Materials",
      procurement: "Procurement",
      equipment: "Equipment",
    },
    enabledModules: [...COMMON_MODULES, "payroll", "materials", "inventory", "procurement", "equipment", "compliance"],
    workflowHints: {
      projectLifecycle: "lead>estimate>approval>project>procurement>field_execution>closeout",
      schedulingModel: "crew_and_trade",
      costingModel: "job_costing",
    },
  },
  cleaning: {
    key: "cleaning",
    label: "Cleaning Services",
    labels: {
      project: "Service Job",
      projects: "Service Jobs",
      customer: "Client",
      customers: "Clients",
      estimate: "Quote",
      estimates: "Quotes",
      vendor: "Supplier or Partner",
      vendors: "Suppliers & Partners",
      workforce: "Cleaning Teams",
      materials: "Cleaning Supplies",
      procurement: "Supply Purchasing",
      equipment: "Cleaning Equipment",
    },
    enabledModules: [...COMMON_MODULES, "payroll", "materials", "inventory", "procurement", "equipment"],
    workflowHints: {
      projectLifecycle: "lead>quote>service_plan>dispatch>service>inspection>invoice",
      schedulingModel: "recurring_and_route",
      costingModel: "service_job_costing",
    },
  },
  healthcare: {
    key: "healthcare",
    label: "Healthcare",
    labels: {
      project: "Care Program",
      projects: "Care Programs",
      customer: "Patient or Client",
      customers: "Patients & Clients",
      estimate: "Service Plan",
      estimates: "Service Plans",
      vendor: "Provider or Supplier",
      vendors: "Providers & Suppliers",
      workforce: "Care Team",
      materials: "Clinical Supplies",
      procurement: "Supply Purchasing",
      equipment: "Medical Equipment",
    },
    enabledModules: [...COMMON_MODULES, "payroll", "inventory", "procurement", "equipment", "compliance"],
    workflowHints: {
      projectLifecycle: "intake>eligibility>care_plan>schedule>service>documentation>billing",
      schedulingModel: "credential_and_availability",
      costingModel: "service_line_costing",
    },
  },
  manufacturing: {
    key: "manufacturing",
    label: "Manufacturing",
    labels: {
      project: "Production Order",
      projects: "Production Orders",
      customer: "Customer",
      customers: "Customers",
      estimate: "Quote",
      estimates: "Quotes",
      vendor: "Supplier",
      vendors: "Suppliers",
      workforce: "Production Workforce",
      materials: "Raw Materials",
      procurement: "Purchasing",
      equipment: "Plant Equipment",
    },
    enabledModules: [...COMMON_MODULES, "payroll", "materials", "inventory", "procurement", "equipment", "compliance"],
    workflowHints: {
      projectLifecycle: "demand>quote>production_order>material_plan>production>quality>shipment",
      schedulingModel: "capacity_and_shift",
      costingModel: "production_order_costing",
    },
  },
  logistics: {
    key: "logistics",
    label: "Logistics",
    labels: {
      project: "Shipment",
      projects: "Shipments",
      customer: "Account",
      customers: "Accounts",
      estimate: "Rate Quote",
      estimates: "Rate Quotes",
      vendor: "Carrier or Vendor",
      vendors: "Carriers & Vendors",
      workforce: "Drivers & Operations",
      materials: "Consumables",
      procurement: "Purchasing",
      equipment: "Fleet",
    },
    enabledModules: [...COMMON_MODULES, "payroll", "procurement", "equipment", "compliance"],
    workflowHints: {
      projectLifecycle: "request>rate_quote>dispatch>pickup>in_transit>delivery>billing",
      schedulingModel: "route_and_asset",
      costingModel: "shipment_costing",
    },
  },
  professional_services: {
    key: "professional_services",
    label: "Professional Services",
    labels: {
      project: "Engagement",
      projects: "Engagements",
      customer: "Client",
      customers: "Clients",
      estimate: "Proposal",
      estimates: "Proposals",
      vendor: "Partner or Vendor",
      vendors: "Partners & Vendors",
      workforce: "Team",
      materials: "Resources",
      procurement: "Purchasing",
      equipment: "Assets",
    },
    enabledModules: [...COMMON_MODULES, "payroll"],
    workflowHints: {
      projectLifecycle: "lead>proposal>engagement>delivery>review>invoice",
      schedulingModel: "people_and_capacity",
      costingModel: "engagement_costing",
    },
  },
  generic: {
    key: "generic",
    label: "Business",
    labels: {
      project: "Work Item",
      projects: "Work",
      customer: "Customer",
      customers: "Customers",
      estimate: "Quote",
      estimates: "Quotes",
      vendor: "Vendor",
      vendors: "Vendors",
      workforce: "Team",
      materials: "Supplies",
      procurement: "Purchasing",
      equipment: "Assets",
    },
    enabledModules: COMMON_MODULES,
    workflowHints: {
      projectLifecycle: "lead>quote>work>delivery>invoice",
      schedulingModel: "people_and_time",
      costingModel: "work_costing",
    },
  },
};

const INDUSTRY_ALIASES: Array<[RegExp, AdaptiveIndustryKey]> = [
  [/(construction|contractor|remodel|builder|roof|plumb|electric|hvac|carpentr)/i, "construction"],
  [/(cleaning|janitorial|maid|housekeeping|sanitation)/i, "cleaning"],
  [/(health|medical|clinic|care|therapy|dental|patient)/i, "healthcare"],
  [/(manufactur|factory|fabricat|production|assembly)/i, "manufacturing"],
  [/(logistics|trucking|freight|delivery|warehouse|transport)/i, "logistics"],
  [/(consult|agency|accounting|legal|professional service|design firm)/i, "professional_services"],
];

export function normalizeIndustryKey(value?: string | null): AdaptiveIndustryKey {
  const normalized = (value || "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (normalized in ADAPTIVE_BOS_TEMPLATES) return normalized as AdaptiveIndustryKey;
  for (const [pattern, key] of INDUSTRY_ALIASES) if (pattern.test(value || "")) return key;
  return "generic";
}

export function resolveAdaptiveBosConfig(profile?: AdaptiveBosCompanyProfile | null): AdaptiveBosResolvedConfig {
  const industryKey = normalizeIndustryKey(profile?.industryKey || profile?.industryLabel || "construction");
  const template = ADAPTIVE_BOS_TEMPLATES[industryKey];
  const enabled = new Set(template.enabledModules);
  for (const [moduleKey, isEnabled] of Object.entries(profile?.moduleOverrides || {})) {
    if (isEnabled) enabled.add(moduleKey as AdaptiveBosModuleKey);
    else enabled.delete(moduleKey as AdaptiveBosModuleKey);
  }

  return {
    industryKey,
    industryLabel: profile?.industryLabel?.trim() || template.label,
    labels: { ...template.labels, ...(profile?.terminologyOverrides || {}) },
    enabledModules: [...enabled],
    workflowHints: { ...template.workflowHints, ...(profile?.workflowOverrides || {}) },
    primaryServices: (profile?.primaryServices || []).map((value) => value.trim()).filter(Boolean),
  };
}
