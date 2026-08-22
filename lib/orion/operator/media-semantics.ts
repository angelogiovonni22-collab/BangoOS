"use client";

const MEDIA_TEXT = /\b(photo|image|document|file|plan|blueprint|pdf|attachment|download)\b/i;
const DOCUMENT_HREF = /\.(pdf|docx?|xlsx?|csv|txt|rtf)(?:[?#]|$)/i;
const IMAGE_HREF = /\.(png|jpe?g|webp|gif|heic|heif)(?:[?#]|$)/i;

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function compactContext(element: HTMLElement) {
  const container = element.closest<HTMLElement>("article, tr, li, [role='row'], [data-orion-media-context]");
  const text = normalizeText(container?.textContent || "");
  return text.slice(0, 240);
}

function filenameFromHref(href: string) {
  try {
    const url = new URL(href, window.location.origin);
    return decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) || "");
  } catch {
    return "";
  }
}

function mediaKind(element: HTMLButtonElement | HTMLAnchorElement) {
  const aria = normalizeText(element.getAttribute("aria-label"));
  const text = normalizeText(element.textContent);
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") || "" : "";
  const image = element.querySelector<HTMLImageElement>("img");
  const combined = `${aria} ${text} ${href}`;

  if (/\b(choose|upload|take)\b/i.test(combined) || element.closest("label")?.querySelector("input[type='file']")) return null;

  if (image || IMAGE_HREF.test(href) || /\b(photo|image)\b/i.test(combined)) return "photo" as const;
  if (DOCUMENT_HREF.test(href) || element instanceof HTMLAnchorElement && element.hasAttribute("download") || /\b(document|file|plan|blueprint|pdf|attachment)\b/i.test(combined)) return "document" as const;
  if (MEDIA_TEXT.test(combined)) return "media" as const;
  return null;
}

function descriptiveLabel(element: HTMLButtonElement | HTMLAnchorElement, kind: "photo" | "document" | "media") {
  const aria = normalizeText(element.getAttribute("aria-label"));
  const imageAlt = normalizeText(element.querySelector<HTMLImageElement>("img")?.alt);
  const href = element instanceof HTMLAnchorElement ? element.getAttribute("href") || "" : "";
  const hrefFile = filenameFromHref(href);
  const text = normalizeText(element.textContent);
  const context = compactContext(element);
  const candidates = [aria, imageAlt, hrefFile, text, context].filter(Boolean);
  const unique = Array.from(new Set(candidates));
  const detail = unique.join(" — ").slice(0, 320);
  return `${kind}: ${detail || "visible item"}`;
}

/**
 * Adds stable, non-visual Orion metadata to media controls that already exist in
 * the mounted BOS UI. No click handlers or user-facing DOM are changed.
 */
export function ensureOrionMediaSemantics() {
  if (typeof document === "undefined") return;

  const controls = Array.from(document.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button, a[href]"));
  let mediaIndex = 0;

  for (const control of controls) {
    const kind = mediaKind(control);
    if (!kind) continue;

    const role = descriptiveLabel(control, kind);
    control.setAttribute("data-orion-role", role);

    if (!control.hasAttribute("data-orion-action") && !control.hasAttribute("data-orion-control")) {
      mediaIndex += 1;
      control.setAttribute("data-orion-action", `open-${kind}-${mediaIndex}`);
    }
  }
}

function searchableTokens(value: string) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((token) => token.length > 2 && !["open", "show", "view", "the", "this", "that", "please"].includes(token));
}

/** Opens the best visible photo/document match for a typed Orion request. */
export function openBestMatchingOrionMedia(query: string) {
  if (typeof document === "undefined" || !/\b(open|show|view)\b/i.test(query)) return false;

  ensureOrionMediaSemantics();
  const requestedTokens = searchableTokens(query);
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-orion-role]"))
    .map((control) => {
      const role = normalizeText(control.getAttribute("data-orion-role")).toLowerCase();
      const matchedTokens = requestedTokens.filter((token) => role.includes(token));
      const requestedKind = /\b(photo|image)\b/i.test(query)
        ? "photo"
        : /\b(document|file|plan|blueprint|pdf|attachment)\b/i.test(query)
          ? "document"
          : null;
      const kindMatch = requestedKind ? role.startsWith(`${requestedKind}:`) : true;
      return { control, score: (kindMatch ? 10 : 0) + matchedTokens.length };
    })
    .filter((candidate) => candidate.score >= 10)
    .sort((left, right) => right.score - left.score);

  if (candidates.length === 0) return false;
  if (requestedTokens.length > 0 && candidates[0].score === 10 && candidates.length > 1) return false;

  const selected = candidates[0].control;
  const selectedRole = normalizeText(selected.getAttribute("data-orion-role")).toLowerCase();
  if (selectedRole.startsWith("document:") && !(selected instanceof HTMLAnchorElement)) {
    const signedDocumentLink = candidates
      .map((candidate) => candidate.control)
      .find((control): control is HTMLAnchorElement => control instanceof HTMLAnchorElement && Boolean(control.href));
    if (signedDocumentLink) {
      window.open(signedDocumentLink.href, "_blank", "noopener,noreferrer");
      return true;
    }
  }

  selected.click();
  return true;
}
