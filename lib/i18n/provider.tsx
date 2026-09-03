"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ACTIVE_SCOPE_KEY,
  DEFAULT_LOCALE,
  DEFAULT_SCOPE,
  LOCALE_COOKIE_KEY,
  STORAGE_KEY,
  isAppLocale,
  translate,
  type AppLocale,
} from "@/lib/i18n/config";
import { LegacyTextLocalizer } from "@/lib/i18n/legacy-text-localizer";

export type { AppLocale } from "@/lib/i18n/config";

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

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLanguageMap() {
  if (typeof window === "undefined") return {} as Record<string, AppLocale>;
  const rawValue = window.localStorage.getItem(STORAGE_KEY);
  if (!rawValue) return {} as Record<string, AppLocale>;
  try {
    const parsed = JSON.parse(rawValue) as Record<string, string>;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, AppLocale] => isAppLocale(entry[1])),
    );
  } catch {
    return {} as Record<string, AppLocale>;
  }
}

function readCookieLocale() {
  if (typeof document === "undefined") return null;
  const legacyEncodedKey = encodeURIComponent("bangoos:i18n:locale");
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${LOCALE_COOKIE_KEY}=`) || part.startsWith(`${legacyEncodedKey}=`));
  if (!cookie) return null;
  const cookieName = cookie.startsWith(`${LOCALE_COOKIE_KEY}=`) ? LOCALE_COOKIE_KEY : legacyEncodedKey;
  const value = decodeURIComponent(cookie.slice(cookieName.length + 1));
  return isAppLocale(value) ? value : null;
}

function writeCookieLocale(locale: AppLocale) {
  if (typeof document === "undefined") return;
  document.cookie = `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=31536000; SameSite=Lax`;
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
        if (normalizedScope !== userScope) setUserScopeState(normalizedScope);
        if (syncedLocale !== locale) setLocaleState(syncedLocale);
      });
    }

    languageMap[normalizedScope] = syncedLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, normalizedScope);
    writeCookieLocale(syncedLocale);
    document.documentElement.lang = syncedLocale;
  }, [locale, userScope]);

  const setLocale = useCallback((nextLocale: AppLocale) => {
    setLocaleState(nextLocale);
    if (typeof window === "undefined") return;
    const languageMap = readStoredLanguageMap();
    languageMap[userScope] = nextLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, userScope);
    writeCookieLocale(nextLocale);
    document.documentElement.lang = nextLocale;
  }, [userScope]);

  const setUserScope = useCallback((scope: string) => {
    const normalizedScope = scope.trim() || DEFAULT_SCOPE;
    setUserScopeState(normalizedScope);
    if (typeof window === "undefined") return;
    window.localStorage.setItem(ACTIVE_SCOPE_KEY, normalizedScope);
    const languageMap = readStoredLanguageMap();
    const scopedLocale = languageMap[normalizedScope] || readCookieLocale() || locale;
    languageMap[normalizedScope] = scopedLocale;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(languageMap));
    setLocaleState(scopedLocale);
    writeCookieLocale(scopedLocale);
    document.documentElement.lang = scopedLocale;
  }, [locale]);

  const value = useMemo<I18nContextValue>(() => ({
    locale,
    userScope,
    setLocale,
    setUserScope,
    t: (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
  }), [locale, userScope, setLocale, setUserScope]);

  return (
    <I18nContext.Provider value={value}>
      <LegacyTextLocalizer locale={locale} />
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error("useI18n must be used within an I18nProvider.");
  return context;
}
