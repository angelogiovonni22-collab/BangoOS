"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "./button";
import { useI18n, type AppLocale } from "@/lib/i18n/provider";

export function LanguageSelector() {
  const { locale, setLocale, t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("mousedown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const languageLabel = locale === "es" ? t("common.spanish") : t("common.english");

  const selectLanguage = (nextLocale: AppLocale) => {
    setLocale(nextLocale);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-w-[126px] justify-between"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label={t("common.language")}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true">Globe</span>
          <span>{languageLabel}</span>
        </span>
        <span aria-hidden="true">▾</span>
      </Button>

      <div
        role="menu"
        aria-label={t("common.language")}
        className={`motion-nav absolute right-0 z-50 mt-2 w-44 origin-top-right rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-2 shadow-[var(--shadow-large)] transition duration-200 ${
          isOpen ? "scale-100 opacity-100" : "pointer-events-none scale-95 opacity-0"
        }`}
      >
        <LanguageOption
          label={t("common.english")}
          value="en"
          isActive={locale === "en"}
          onSelect={selectLanguage}
        />

        <LanguageOption
          label={t("common.spanish")}
          value="es"
          isActive={locale === "es"}
          onSelect={selectLanguage}
        />
      </div>
    </div>
  );
}

type LanguageOptionProps = {
  label: string;
  value: AppLocale;
  isActive: boolean;
  onSelect: (nextLocale: AppLocale) => void;
};

function LanguageOption({ label, value, isActive, onSelect }: LanguageOptionProps) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={isActive}
      className={`w-full rounded-[var(--radius-md)] px-3 py-2 text-left text-sm motion-hover-button ${
        isActive
          ? "bg-[var(--color-primary-50)] font-semibold text-[var(--color-primary-700)]"
          : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-primary)]"
      }`}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );
}
