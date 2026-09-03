import { resources, type AppLocale, type TranslationNamespace } from "@/lib/i18n/config";

type TemplateEntry = {
  pattern: RegExp;
  keys: string[];
  localized: string;
};

const cache = new Map<AppLocale, { direct: Map<string, string>; templates: TemplateEntry[] }>();

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildIndex(locale: AppLocale) {
  const direct = new Map<string, string>();
  const templates: TemplateEntry[] = [];

  if (locale === "en") return { direct, templates };

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
        direct.set(normalized, localizedValue);
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
      templates.push({ pattern: new RegExp(source), keys, localized: localizedValue });
    }
  }

  return { direct, templates };
}

export function translateLiteral(locale: AppLocale, value: string) {
  if (locale === "en" || !value.trim()) return value;

  let index = cache.get(locale);
  if (!index) {
    index = buildIndex(locale);
    cache.set(locale, index);
  }

  const normalized = value.trim();
  const direct = index.direct.get(normalized);
  if (direct) return preserveOuterWhitespace(value, direct);

  for (const template of index.templates) {
    const match = template.pattern.exec(normalized);
    if (!match) continue;

    let localized = template.localized;
    template.keys.forEach((key, matchIndex) => {
      localized = localized.replace(
        new RegExp(`\\{\\{\\s*${escapeRegExp(key)}\\s*\\}\\}`, "g"),
        match[matchIndex + 1] ?? "",
      );
    });

    return preserveOuterWhitespace(value, localized);
  }

  return value;
}

function preserveOuterWhitespace(original: string, localized: string) {
  const leading = original.match(/^\s*/)?.[0] ?? "";
  const trailing = original.match(/\s*$/)?.[0] ?? "";
  return `${leading}${localized}${trailing}`;
}
