"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import commonEn from "@/locales/en/common.json";
import authEn from "@/locales/en/auth.json";
import customersEn from "@/locales/en/customers.json";
import dashboardEn from "@/locales/en/dashboard.json";
import crewsEn from "@/locales/en/crews.json";
import employeesEn from "@/locales/en/employees.json";
import estimatesEn from "@/locales/en/estimates.json";
import navigationEn from "@/locales/en/navigation.json";
import onboardingEn from "@/locales/en/onboarding.json";
import operationsEn from "@/locales/en/operations.json";
import projectsEn from "@/locales/en/projects.json";
import schedulingEn from "@/locales/en/scheduling.json";
import commonEs from "@/locales/es/common.json";
import authEs from "@/locales/es/auth.json";
import customersEs from "@/locales/es/customers.json";
import dashboardEs from "@/locales/es/dashboard.json";
import crewsEs from "@/locales/es/crews.json";
import employeesEs from "@/locales/es/employees.json";
import estimatesEs from "@/locales/es/estimates.json";
import navigationEs from "@/locales/es/navigation.json";
import onboardingEs from "@/locales/es/onboarding.json";
import operationsEs from "@/locales/es/operations.json";
import projectsEs from "@/locales/es/projects.json";
import schedulingEs from "@/locales/es/scheduling.json";

export type AppLocale = "en" | "es";

type NamespaceDictionary = Record<string, string>;

type LocaleDictionaries = {
  auth: NamespaceDictionary;
  common: NamespaceDictionary;
  customers: NamespaceDictionary;
  dashboard: NamespaceDictionary;
  crews: NamespaceDictionary;
  employees: NamespaceDictionary;
  estimates: NamespaceDictionary;
  navigation: NamespaceDictionary;
  onboarding: NamespaceDictionary;
  operations: NamespaceDictionary;
  projects: NamespaceDictionary;
  scheduling: NamespaceDictionary;
};

type TranslationNamespace = keyof LocaleDictionaries;

type TranslationResources = Record<AppLocale, LocaleDictionaries>;

type I18nContextValue = {
  locale: AppLocale;
  userScope: string;
  setLocale: (nextLocale: AppLocale) => void;
  setUserScope: (scope: string) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type I18nProviderProps = {
  children: ReactNode;
  initialLocale?: AppLocale;
  initialUserScope?: string;
};

const DEFAULT_LOCALE: AppLocale = "en";
const DEFAULT_SCOPE = "local-default-user";
const STORAGE_KEY = "bangoos:i18n:languageByUser";
const ACTIVE_SCOPE_KEY = "bangoos:i18n:activeUserScope";
const LOCALE_COOKIE_KEY = "bangoos_i18n_locale";

const resources: TranslationResources = {
  en: {
    auth: authEn,
    common: commonEn,
    customers: customersEn,
    dashboard: dashboardEn,
    crews: crewsEn,
    employees: employeesEn,
    estimates: estimatesEn,
    navigation: navigationEn,
    onboarding: onboardingEn,
    operations: operationsEn,
    projects: projectsEn,
    scheduling: schedulingEn,
  },
  es: {
    auth: authEs,
    common: commonEs,
    customers: customersEs,
    dashboard: dashboardEs,
    crews: crewsEs,
    employees: employeesEs,
    estimates: estimatesEs,
    navigation: navigationEs,
    onboarding: onboardingEs,
    operations: operationsEs,
    projects: projectsEs,
    scheduling: schedulingEs,
  },
};

const I18nContext = createContext<I18nContextValue | null>(null);

function isAppLocale(value: string): value is AppLocale {
  return value === "en" || value === "es";
}

function readStoredLanguageMap() {
  if (typeof window === "undefined") {
    return {} as Record<string, AppLocale>;
  }

  const rawValue = window.localStorage.getItem(STORAGE_KEY);

  if (!rawValue) {
    return {} as Record<string, AppLocale>;
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, string>;

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AppLocale] =>
        isAppLocale(entry[1]),
      ),
    );
  } catch {
    return {} as Record<string, AppLocale>;
  }
}

function readCookieLocale() {
  if (typeof document === "undefined") {
    return null;
  }

  const legacyEncodedKey = encodeURIComponent("bangoos:i18n:locale");
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find(
      (part) => part.startsWith(`${LOCALE_COOKIE_KEY}=`) || part.startsWith(`${legacyEncodedKey}=`),
    );

  if (!cookie) {
    return null;
  }

  const cookieName = cookie.startsWith(`${LOCALE_COOKIE_KEY}=`)
    ? LOCALE_COOKIE_KEY
    : legacyEncodedKey;
  const value = decodeURIComponent(cookie.slice(cookieName.length + 1));
  return isAppLocale(value) ? value : null;
}

function writeCookieLocale(locale: AppLocale) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

function resolveNamespaceAndKey(path: string): {
  namespace: TranslationNamespace;
  lookupKey: string;
} {
  const [firstSegment, ...rest] = path.split(".").filter(Boolean);

  if (!firstSegment) {
    return { namespace: "common", lookupKey: "" };
  }

  if (
    firstSegment === "common"
    || firstSegment === "auth"
    || firstSegment === "customers"
    || firstSegment === "dashboard"
    || firstSegment === "crews"
    || firstSegment === "employees"
    || firstSegment === "estimates"
    || firstSegment === "navigation"
    || firstSegment === "onboarding"
    || firstSegment === "operations"
    || firstSegment === "projects"
    || firstSegment === "scheduling"
  ) {
    return { namespace: firstSegment, lookupKey: rest.join(".") };
  }

  return { namespace: "common", lookupKey: path };
}

function translate(locale: AppLocale, key: string, params?: Record<string, string | number>) {
  const { namespace, lookupKey } = resolveNamespaceAndKey(key);

  if (!lookupKey) {
    return key;
  }

  const dictionary = resources[locale][namespace];
  const rawValue = dictionary[lookupKey] || resources[DEFAULT_LOCALE][namespace][lookupKey] || key;

  if (!params) {
    return rawValue;
  }

  return rawValue.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, paramKey: string) => {
    const value = params[paramKey];
    return value === undefined || value === null ? "" : String(value);
  });
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  initialUserScope = DEFAULT_SCOPE,
}: I18nProviderProps) {
  const [userScope, setUserScopeState] = useState<string>(initialUserScope);
  const [locale, setLocaleState] = useState<AppLocale>(initialLocale);

  useEffect(() => {
    const storedScope = window.localStorage.getItem(ACTIVE_SCOPE_KEY) || userScope;
    const normalizedScope = storedScope.trim() || DEFAULT_SCOPE;
    const languageMap = readStoredLanguageMap();
    const cookieLocale = readCookieLocale();
    const syncedLocale = languageMap[normalizedScope] || cookieLocale || locale;

    if (normalizedScope !== userScope || syncedLocale !== locale) {
      queueMicrotask(() => {
        if (normalizedScope !== userScope) {
          setUserScopeState(normalizedScope);
        }

        if (syncedLocale !== locale) {
          setLocaleState(syncedLocale);
        }
      });
    }

    languageMap[normalizedScope] = syncedLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, normalizedScope);
    writeCookieLocale(syncedLocale);
  }, [locale, userScope]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);

    if (typeof window === "undefined") {
      return;
    }

    const languageMap = readStoredLanguageMap();
    languageMap[userScope] = nextLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, userScope);
    writeCookieLocale(nextLocale);
  }, [userScope]);

  const setUserScope = useCallback((scope: string) => {
    const normalizedScope = scope.trim() || DEFAULT_SCOPE;
    setUserScopeState(normalizedScope);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ACTIVE_SCOPE_KEY, normalizedScope);

    const languageMap = readStoredLanguageMap();
    const scopedLocale = languageMap[normalizedScope] || readCookieLocale() || locale;
    languageMap[normalizedScope] = scopedLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    setLocaleState(scopedLocale);
    writeCookieLocale(scopedLocale);
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      userScope,
      setLocale,
      setUserScope,
      t: (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    }),
    [locale, userScope, setLocale, setUserScope],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);

  if (!context) {
    throw new Error("useI18n must be used within an I18nProvider.");
  }

  return context;
}
