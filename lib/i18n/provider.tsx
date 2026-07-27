"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import commonEn from "@/locales/en/common.json";
import dashboardEn from "@/locales/en/dashboard.json";
import navigationEn from "@/locales/en/navigation.json";
import commonEs from "@/locales/es/common.json";
import dashboardEs from "@/locales/es/dashboard.json";
import navigationEs from "@/locales/es/navigation.json";

export type AppLocale = "en" | "es";

type NamespaceDictionary = Record<string, string>;

type LocaleDictionaries = {
  common: NamespaceDictionary;
  dashboard: NamespaceDictionary;
  navigation: NamespaceDictionary;
};

type TranslationNamespace = keyof LocaleDictionaries;

type TranslationResources = Record<AppLocale, LocaleDictionaries>;

type I18nContextValue = {
  locale: AppLocale;
  userScope: string;
  setLocale: (nextLocale: AppLocale) => void;
  setUserScope: (scope: string) => void;
  t: (key: string) => string;
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

const resources: TranslationResources = {
  en: {
    common: commonEn,
    dashboard: dashboardEn,
    navigation: navigationEn,
  },
  es: {
    common: commonEs,
    dashboard: dashboardEs,
    navigation: navigationEs,
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

function resolveNamespaceAndKey(path: string): {
  namespace: TranslationNamespace;
  lookupKey: string;
} {
  const [firstSegment, ...rest] = path.split(".").filter(Boolean);

  if (!firstSegment) {
    return { namespace: "common", lookupKey: "" };
  }

  if (firstSegment === "common" || firstSegment === "dashboard" || firstSegment === "navigation") {
    return { namespace: firstSegment, lookupKey: rest.join(".") };
  }

  return { namespace: "common", lookupKey: path };
}

function translate(locale: AppLocale, key: string) {
  const { namespace, lookupKey } = resolveNamespaceAndKey(key);

  if (!lookupKey) {
    return key;
  }

  const dictionary = resources[locale][namespace];

  return dictionary[lookupKey] || resources[DEFAULT_LOCALE][namespace][lookupKey] || key;
}

export function I18nProvider({
  children,
  initialLocale = DEFAULT_LOCALE,
  initialUserScope = DEFAULT_SCOPE,
}: I18nProviderProps) {
  const [userScope, setUserScopeState] = useState<string>(() => {
    if (typeof window === "undefined") {
      return initialUserScope;
    }

    return window.localStorage.getItem(ACTIVE_SCOPE_KEY) || initialUserScope;
  });

  const [locale, setLocaleState] = useState<AppLocale>(() => {
    if (typeof window === "undefined") {
      return initialLocale;
    }

    const scope = window.localStorage.getItem(ACTIVE_SCOPE_KEY) || initialUserScope;
    const languageMap = readStoredLanguageMap();

    return languageMap[scope] || initialLocale;
  });

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);

    if (typeof window === "undefined") {
      return;
    }

    const languageMap = readStoredLanguageMap();
    languageMap[userScope] = nextLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, userScope);
  }, [userScope]);

  const setUserScope = useCallback((scope: string) => {
    const normalizedScope = scope.trim() || DEFAULT_SCOPE;
    setUserScopeState(normalizedScope);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(ACTIVE_SCOPE_KEY, normalizedScope);

    const languageMap = readStoredLanguageMap();
    const scopedLocale = languageMap[normalizedScope] || DEFAULT_LOCALE;
    setLocaleState(scopedLocale);
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      userScope,
      setLocale,
      setUserScope,
      t: (key: string) => translate(locale, key),
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
