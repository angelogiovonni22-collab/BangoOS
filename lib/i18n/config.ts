import authEn from "@/locales/en/auth.json";
import blueprintsEn from "@/locales/en/blueprints.json";
import commonEn from "@/locales/en/common.json";
import crewsEn from "@/locales/en/crews.json";
import customersEn from "@/locales/en/customers.json";
import dailyReportsEn from "@/locales/en/daily-reports.json";
import dashboardEn from "@/locales/en/dashboard.json";
import employeesEn from "@/locales/en/employees.json";
import estimatesEn from "@/locales/en/estimates.json";
import financeEn from "@/locales/en/finance.json";
import navigationEn from "@/locales/en/navigation.json";
import onboardingEn from "@/locales/en/onboarding.json";
import operationsEn from "@/locales/en/operations.json";
import orionEn from "@/locales/en/orion.json";
import partnersEn from "@/locales/en/partners.json";
import projectsEn from "@/locales/en/projects.json";
import resourcesEn from "@/locales/en/resources.json";
import schedulingEn from "@/locales/en/scheduling.json";
import settingsEn from "@/locales/en/settings.json";
import authEs from "@/locales/es/auth.json";
import blueprintsEs from "@/locales/es/blueprints.json";
import commonEs from "@/locales/es/common.json";
import crewsEs from "@/locales/es/crews.json";
import customersEs from "@/locales/es/customers.json";
import dailyReportsEs from "@/locales/es/daily-reports.json";
import dashboardEs from "@/locales/es/dashboard.json";
import employeesEs from "@/locales/es/employees.json";
import estimatesEs from "@/locales/es/estimates.json";
import financeEs from "@/locales/es/finance.json";
import navigationEs from "@/locales/es/navigation.json";
import onboardingEs from "@/locales/es/onboarding.json";
import operationsEs from "@/locales/es/operations.json";
import orionEs from "@/locales/es/orion.json";
import partnersEs from "@/locales/es/partners.json";
import projectsEs from "@/locales/es/projects.json";
import resourcesEs from "@/locales/es/resources.json";
import schedulingEs from "@/locales/es/scheduling.json";
import settingsEs from "@/locales/es/settings.json";

export type AppLocale = "en" | "es";
export type NamespaceDictionary = Record<string, string>;

export type LocaleDictionaries = {
  auth: NamespaceDictionary;
  blueprints: NamespaceDictionary;
  common: NamespaceDictionary;
  crews: NamespaceDictionary;
  customers: NamespaceDictionary;
  dailyReports: NamespaceDictionary;
  dashboard: NamespaceDictionary;
  employees: NamespaceDictionary;
  estimates: NamespaceDictionary;
  finance: NamespaceDictionary;
  navigation: NamespaceDictionary;
  onboarding: NamespaceDictionary;
  operations: NamespaceDictionary;
  orion: NamespaceDictionary;
  partners: NamespaceDictionary;
  projects: NamespaceDictionary;
  resources: NamespaceDictionary;
  scheduling: NamespaceDictionary;
  settings: NamespaceDictionary;
};

export type TranslationNamespace = keyof LocaleDictionaries;
export type TranslationResources = Record<AppLocale, LocaleDictionaries>;

export const DEFAULT_LOCALE: AppLocale = "en";
export const DEFAULT_SCOPE = "local-default-user";
export const STORAGE_KEY = "bangoos:i18n:languageByUser";
export const ACTIVE_SCOPE_KEY = "bangoos:i18n:activeUserScope";
export const LOCALE_COOKIE_KEY = "bangoos_i18n_locale";

export const resources: TranslationResources = {
  en: {
    auth: authEn,
    blueprints: blueprintsEn,
    common: commonEn,
    crews: crewsEn,
    customers: customersEn,
    dailyReports: dailyReportsEn,
    dashboard: dashboardEn,
    employees: employeesEn,
    estimates: estimatesEn,
    finance: financeEn,
    navigation: navigationEn,
    onboarding: onboardingEn,
    operations: operationsEn,
    orion: orionEn,
    partners: partnersEn,
    projects: projectsEn,
    resources: resourcesEn,
    scheduling: schedulingEn,
    settings: settingsEn,
  },
  es: {
    auth: authEs,
    blueprints: blueprintsEs,
    common: commonEs,
    crews: crewsEs,
    customers: customersEs,
    dailyReports: dailyReportsEs,
    dashboard: dashboardEs,
    employees: employeesEs,
    estimates: estimatesEs,
    finance: financeEs,
    navigation: navigationEs,
    onboarding: onboardingEs,
    operations: operationsEs,
    orion: orionEs,
    partners: partnersEs,
    projects: projectsEs,
    resources: resourcesEs,
    scheduling: schedulingEs,
    settings: settingsEs,
  },
};

const namespaces = new Set<TranslationNamespace>(Object.keys(resources.en) as TranslationNamespace[]);

export function isAppLocale(value: string | undefined | null): value is AppLocale {
  return value === "en" || value === "es";
}

export function resolveNamespaceAndKey(path: string): { namespace: TranslationNamespace; lookupKey: string } {
  const [firstSegment, ...rest] = path.split(".").filter(Boolean);
  if (!firstSegment) return { namespace: "common", lookupKey: "" };
  if (namespaces.has(firstSegment as TranslationNamespace)) {
    return { namespace: firstSegment as TranslationNamespace, lookupKey: rest.join(".") };
  }
  return { namespace: "common", lookupKey: path };
}

export function translate(locale: AppLocale, key: string, params?: Record<string, string | number>) {
  const { namespace, lookupKey } = resolveNamespaceAndKey(key);
  if (!lookupKey) return key;
  const dictionary = resources[locale][namespace];
  const rawValue = dictionary[lookupKey] || resources[DEFAULT_LOCALE][namespace][lookupKey] || key;
  if (!params) return rawValue;
  return rawValue.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, paramKey: string) => {
    const value = params[paramKey];
    return value === undefined || value === null ? "" : String(value);
  });
}
