"use client";

import { useEffect, useMemo, useRef } from "react";
import { resources, type AppLocale, type TranslationNamespace } from "@/lib/i18n/config";

const SKIP_SELECTOR = "[data-no-auto-i18n], [data-user-content], [contenteditable='true'], script, style, code, pre";
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label", "aria-description", "alt"] as const;
const SPANISH_WEEKDAYS: Record<string, string> = {
  MON: "LUN",
  TUE: "MAR",
  WED: "MIÉ",
  THU: "JUE",
  FRI: "VIE",
  SAT: "SÁB",
  SUN: "DOM",
};
const SPANISH_MONTHS: Record<string, string> = {
  JAN: "ENE",
  FEB: "FEB",
  MAR: "MAR",
  APR: "ABR",
  MAY: "MAY",
  JUN: "JUN",
  JUL: "JUL",
  AUG: "AGO",
  SEP: "SEP",
  OCT: "OCT",
  NOV: "NOV",
  DEC: "DIC",
};

type AttributeName = (typeof TRANSLATABLE_ATTRIBUTES)[number];
type TemplateTranslation = { pattern: RegExp; keys: string[]; localized: string };

type TranslationIndex = {
  literalMap: Map<string, string>;
  foldedLiteralMap: Map<string, string>;
  templates: TemplateTranslation[];
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fold(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

function buildTranslationIndex(locale: AppLocale): TranslationIndex {
  const literalMap = new Map<string, string>();
  const foldedLiteralMap = new Map<string, string>();
  const templates: TemplateTranslation[] = [];
  if (locale === "en") return { literalMap, foldedLiteralMap, templates };

  for (const namespace of Object.keys(resources.en) as TranslationNamespace[]) {
    const english = resources.en[namespace];
    const localized = resources[locale][namespace];
    for (const [key, englishValue] of Object.entries(english)) {
      const localizedValue = localized[key];
      if (!localizedValue || localizedValue === englishValue) continue;
      const normalized = englishValue.trim();
      if (!normalized) continue;

      const tokenMatches = [...normalized.matchAll(/\{\{\s*(\w+)\s*\}\}/g)];
      if (!tokenMatches.length) {
        literalMap.set(normalized, localizedValue);
        const folded = fold(normalized);
        if (!foldedLiteralMap.has(folded)) foldedLiteralMap.set(folded, localizedValue);
        continue;
      }

      const keys = tokenMatches.map((match) => match[1]);
      let cursor = 0;
      let source = "^";
      for (const match of tokenMatches) {
        const index = match.index ?? 0;
        source += escapeRegExp(normalized.slice(cursor, index));
        source += "(.+?)";
        cursor = index + match[0].length;
      }
      source += escapeRegExp(normalized.slice(cursor));
      source += "$";
      templates.push({ pattern: new RegExp(source, "i"), keys, localized: localizedValue });
    }
  }

  return { literalMap, foldedLiteralMap, templates };
}

function translateScheduleDate(value: string) {
  const match = /^(MON|TUE|WED|THU|FRI|SAT|SUN),\s+(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s+(\d{1,2})$/i.exec(value);
  if (!match) return null;
  const weekday = match[1].toUpperCase();
  const month = match[2].toUpperCase();
  return `${SPANISH_WEEKDAYS[weekday]}, ${match[3]} ${SPANISH_MONTHS[month]}`;
}

function translateKnownLiteral(value: string, index: TranslationIndex) {
  const normalized = value.trim();
  return index.literalMap.get(normalized) || index.foldedLiteralMap.get(fold(normalized)) || null;
}

function translateDecoratedLiteral(value: string, index: TranslationIndex) {
  const match = /^([^\p{L}\p{N}]*)(.*?)([^\p{L}\p{N}]*)$/u.exec(value.trim());
  if (!match || !match[2]) return null;
  const translatedCore = translateKnownLiteral(match[2], index);
  return translatedCore ? `${match[1]}${translatedCore}${match[3]}` : null;
}

function translateValue(value: string, index: TranslationIndex) {
  const normalized = value.trim();
  const direct = translateKnownLiteral(normalized, index);
  if (direct) return direct;

  for (const template of index.templates) {
    const match = template.pattern.exec(normalized);
    if (!match) continue;
    let localized = template.localized;
    template.keys.forEach((key, matchIndex) => {
      const captured = match[matchIndex + 1] ?? "";
      const translatedCaptured = translateKnownLiteral(captured, index) || captured;
      localized = localized.replace(new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"), translatedCaptured);
    });
    return localized;
  }

  return translateScheduleDate(normalized) || translateDecoratedLiteral(normalized, index);
}

function shouldSkip(element: Element | null) {
  return Boolean(element?.closest(SKIP_SELECTOR));
}

export function LegacyTextLocalizer({ locale }: { locale: AppLocale }) {
  const translationIndex = useMemo(() => buildTranslationIndex(locale), [locale]);
  const textOriginals = useRef(new WeakMap<Text, string>());
  const attributeOriginals = useRef(new WeakMap<Element, Map<AttributeName, string>>());

  useEffect(() => {
    const root = document.body;
    if (!root) return;
    let applying = false;

    const restoreNode = (textNode: Text) => {
      const original = textOriginals.current.get(textNode);
      if (original !== undefined && textNode.nodeValue !== original) textNode.nodeValue = original;
    };

    const translateNode = (textNode: Text) => {
      const parent = textNode.parentElement;
      if (!parent || shouldSkip(parent)) return;
      const current = textNode.nodeValue ?? "";
      const trimmed = current.trim();
      if (!trimmed) return;
      const translated = translateValue(trimmed, translationIndex);
      if (!translated) return;
      if (!textOriginals.current.has(textNode)) textOriginals.current.set(textNode, current);
      const leading = current.match(/^\s*/)?.[0] ?? "";
      const trailing = current.match(/\s*$/)?.[0] ?? "";
      textNode.nodeValue = `${leading}${translated}${trailing}`;
    };

    const restoreAttributes = (element: Element) => {
      const originals = attributeOriginals.current.get(element);
      if (!originals) return;
      for (const [attribute, value] of originals) {
        if (element.getAttribute(attribute) !== value) element.setAttribute(attribute, value);
      }
    };

    const translateAttributes = (element: Element) => {
      if (shouldSkip(element)) return;
      for (const attribute of TRANSLATABLE_ATTRIBUTES) {
        const current = element.getAttribute(attribute);
        if (!current) continue;
        const translated = translateValue(current, translationIndex);
        if (!translated) continue;
        let originals = attributeOriginals.current.get(element);
        if (!originals) {
          originals = new Map<AttributeName, string>();
          attributeOriginals.current.set(element, originals);
        }
        if (!originals.has(attribute)) originals.set(attribute, current);
        element.setAttribute(attribute, translated);
      }
    };

    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (locale === "en") restoreNode(node as Text); else translateNode(node as Text);
        return;
      }
      if (!(node instanceof Element)) return;
      if (locale === "en") restoreAttributes(node); else translateAttributes(node);
      if (shouldSkip(node)) return;
      for (const child of node.childNodes) visit(child);
    };

    const apply = (node: Node = root) => {
      if (applying) return;
      applying = true;
      try { visit(node); } finally { applying = false; }
    };

    apply();

    const observer = new MutationObserver((records) => {
      if (applying) return;
      for (const record of records) {
        if (record.type === "characterData") apply(record.target);
        if (record.type === "attributes") apply(record.target);
        for (const node of record.addedNodes) apply(node);
      }
    });
    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...TRANSLATABLE_ATTRIBUTES],
    });
    return () => observer.disconnect();
  }, [locale, translationIndex]);

  return null;
}
