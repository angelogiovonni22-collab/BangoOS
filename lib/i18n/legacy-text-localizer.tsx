"use client";

import { useEffect, useMemo, useRef } from "react";
import { resources, type AppLocale, type TranslationNamespace } from "@/lib/i18n/config";

const SKIP_SELECTOR = "[data-no-auto-i18n], [data-user-content], [contenteditable='true'], script, style, code, pre";
const TRANSLATABLE_ATTRIBUTES = ["placeholder", "title", "aria-label"] as const;

type AttributeName = (typeof TRANSLATABLE_ATTRIBUTES)[number];

function buildLiteralMap(locale: AppLocale) {
  const map = new Map<string, string>();
  if (locale === "en") return map;

  for (const namespace of Object.keys(resources.en) as TranslationNamespace[]) {
    const english = resources.en[namespace];
    const localized = resources[locale][namespace];
    for (const [key, englishValue] of Object.entries(english)) {
      const localizedValue = localized[key];
      if (!localizedValue || localizedValue === englishValue || englishValue.includes("{{")) continue;
      const normalized = englishValue.trim();
      if (normalized) map.set(normalized, localizedValue);
    }
  }

  return map;
}

function shouldSkip(element: Element | null) {
  return Boolean(element?.closest(SKIP_SELECTOR));
}

export function LegacyTextLocalizer({ locale }: { locale: AppLocale }) {
  const literalMap = useMemo(() => buildLiteralMap(locale), [locale]);
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
      const translated = literalMap.get(trimmed);
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
        const translated = literalMap.get(current.trim());
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
        for (const node of record.addedNodes) apply(node);
      }
    });
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [literalMap, locale]);

  return null;
}
