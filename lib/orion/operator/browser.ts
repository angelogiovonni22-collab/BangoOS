"use client";

import type { OrionRealtimeToolExecutionResult } from "@/lib/orion/realtime/types";
import { isKnownOrionOperatorHref, ORION_OPERATOR_MAIN_ROUTES } from "./routes";

export const ORION_UI_OPERATOR_TOOL = "orion_ui_operator";

export type OrionUiOperatorAction = "observe" | "navigate" | "set" | "click";

type OperatorParams = {
  action?: unknown;
  href?: unknown;
  ref?: unknown;
  value?: unknown;
};

type InteractiveElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | HTMLAnchorElement;

const DESTRUCTIVE_TEXT = /\b(delete|remove|refund|void|archive permanently|discard permanently)\b/i;
const MAX_CONTROLS = 120;

function ok(userMessage: string, details?: unknown, href?: string | null): OrionRealtimeToolExecutionResult {
  return {
    ok: true,
    statusCategory: "ui_operator_completed",
    userMessage,
    href: href || null,
    confirmationRequired: false,
    confirmationToken: null,
    details,
  };
}

function fail(userMessage: string, details?: unknown): OrionRealtimeToolExecutionResult {
  return {
    ok: false,
    statusCategory: "ui_operator_failed",
    userMessage,
    href: null,
    confirmationRequired: false,
    confirmationToken: null,
    details,
  };
}

function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function visible(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function associatedLabel(element: InteractiveElement) {
  if (element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement) return normalizeText(element.textContent || "");
  const aria = element.getAttribute("aria-label");
  if (aria) return normalizeText(aria);
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label?.textContent) return normalizeText(label.textContent);
  }
  const parentLabel = element.closest("label");
  if (parentLabel?.textContent) return normalizeText(parentLabel.textContent);
  return normalizeText(element.getAttribute("placeholder") || element.getAttribute("name") || element.id || "Control");
}

function semanticRef(element: InteractiveElement, index: number) {
  const semantic = element.getAttribute("data-orion-control");
  if (semantic) return `control:${semantic}`;
  const action = element.getAttribute("data-orion-action");
  if (action) return `action:${action}`;
  const lineField = element.getAttribute("data-orion-line-item-field");
  const row = element.closest<HTMLElement>("[data-orion-line-item-row]");
  if (lineField && row?.dataset.orionLineItemRow != null) return `line:${row.dataset.orionLineItemRow}:${lineField}`;
  if (element.id) return `id:${element.id}`;
  return `auto:${index}`;
}

function interactiveElements() {
  return Array.from(document.querySelectorAll<InteractiveElement>("input, textarea, select, button, a[href]"))
    .filter((element) => visible(element) && !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true")
    .slice(0, MAX_CONTROLS);
}

function describeElement(element: InteractiveElement, index: number) {
  const ref = semanticRef(element, index);
  const label = associatedLabel(element);
  let type = element.tagName.toLowerCase();
  let value = "";
  let options: Array<{ value: string; label: string }> | undefined;

  if (element instanceof HTMLInputElement) {
    type = element.type || "input";
    value = element.value;
  } else if (element instanceof HTMLTextAreaElement) {
    value = element.value;
  } else if (element instanceof HTMLSelectElement) {
    value = element.selectedOptions[0]?.textContent?.trim() || element.value;
    options = Array.from(element.options).slice(0, 80).map((option) => ({ value: option.value, label: normalizeText(option.textContent || option.value) }));
  } else if (element instanceof HTMLAnchorElement) {
    value = element.getAttribute("href") || "";
  }

  return {
    ref,
    label,
    type,
    value,
    options,
    required: "required" in element ? Boolean((element as HTMLInputElement).required) : false,
    semanticRole: element.getAttribute("data-orion-role") || null,
  };
}

function observe() {
  const controls = interactiveElements().map(describeElement);
  const headings = Array.from(document.querySelectorAll("h1,h2,h3"))
    .filter((element) => visible(element))
    .slice(0, 20)
    .map((element) => normalizeText(element.textContent || ""))
    .filter(Boolean);

  const alerts = Array.from(document.querySelectorAll('[role="alert"], [data-orion-status]'))
    .filter((element) => visible(element))
    .slice(0, 20)
    .map((element) => normalizeText(element.textContent || ""))
    .filter(Boolean);

  return ok("Current BOS screen observed.", {
    pathname: window.location.pathname,
    title: document.title,
    headings,
    alerts,
    controls,
  });
}

function resolveRef(ref: string): InteractiveElement | null {
  if (ref.startsWith("control:")) return document.querySelector(`[data-orion-control="${CSS.escape(ref.slice(8))}"]`) as InteractiveElement | null;
  if (ref.startsWith("action:")) return document.querySelector(`[data-orion-action="${CSS.escape(ref.slice(7))}"]`) as InteractiveElement | null;
  if (ref.startsWith("id:")) return document.getElementById(ref.slice(3)) as InteractiveElement | null;
  if (ref.startsWith("line:")) {
    const [, row, field] = ref.split(":");
    return document.querySelector(`[data-orion-line-item-row="${CSS.escape(row || "")}"] [data-orion-line-item-field="${CSS.escape(field || "")}"]`) as InteractiveElement | null;
  }
  if (ref.startsWith("auto:")) {
    const index = Number(ref.slice(5));
    return Number.isInteger(index) ? interactiveElements()[index] || null : null;
  }
  return null;
}

function nativeSetValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  if (element instanceof HTMLSelectElement) {
    const wanted = normalizeText(value).toLowerCase();
    const options = Array.from(element.options);
    const exactValue = options.find((option) => option.value.toLowerCase() === wanted);
    const exactLabel = options.find((option) => normalizeText(option.textContent || "").toLowerCase() === wanted);
    const partialLabel = options.find((option) => normalizeText(option.textContent || "").toLowerCase().includes(wanted));
    const option = exactValue || exactLabel || partialLabel;
    if (!option) return false;
    element.value = option.value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  element.focus();
  return true;
}

function setControl(ref: string, value: string) {
  const element = resolveRef(ref);
  if (!element) return fail("That visible BOS control is no longer available. Observe the screen again before continuing.", { ref });
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) {
    return fail("That control cannot accept a value.", { ref, label: associatedLabel(element) });
  }
  if (!visible(element) || element.hasAttribute("disabled")) return fail("That control is not currently interactive.", { ref });
  const didSet = nativeSetValue(element, value);
  if (!didSet) return fail("That value does not match an available option. Observe the screen and use one of the visible options.", { ref, value });
  return ok("Visible BOS control updated.", { ref, label: associatedLabel(element), value });
}

function operatorStatuses() {
  return Array.from(document.querySelectorAll('[role="alert"], [role="status"], [data-orion-status]'))
    .filter((element) => visible(element))
    .map((element) => normalizeText(element.textContent || ""))
    .filter(Boolean);
}

async function waitForVerifiedUiOutcome(pathname: string, statuses: string[]) {
  const deadline = performance.now() + 6_000;
  while (performance.now() < deadline) {
    if (window.location.pathname !== pathname) {
      return ok("Visible BOS action completed and navigation was verified.", { pathname: window.location.pathname, verified: true });
    }
    const nextStatuses = operatorStatuses();
    const changedStatus = nextStatuses.find((status) => !statuses.includes(status));
    if (changedStatus) {
      const failed = /error|unable|failed|required|missing|invalid|try again/i.test(changedStatus);
      return failed
        ? fail(`BOS reported: ${changedStatus}`, { pathname, status: changedStatus, verified: true })
        : ok(`BOS confirmed: ${changedStatus}`, { pathname, status: changedStatus, verified: true });
    }
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }
  return fail("BOS did not confirm that action. Observe the visible screen before claiming it completed.", { pathname, verified: false });
}

async function clickControl(ref: string) {
  const element = resolveRef(ref);
  if (!element) return fail("That visible BOS control is no longer available. Observe the screen again before continuing.", { ref });
  if (!(element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement)) return fail("That control is not clickable.", { ref });
  if (!visible(element) || element.hasAttribute("disabled")) return fail("That control is not currently clickable.", { ref });
  const label = associatedLabel(element);
  if (DESTRUCTIVE_TEXT.test(label)) {
    return fail("Destructive actions must use Orion's confirmed BOS action tools instead of direct UI control.", { ref, label, requiresCanonicalConfirmation: true });
  }
  const pathname = window.location.pathname;
  const statuses = operatorStatuses();
  const requiresVerification = element.dataset.orionVerify === "navigation-or-status";
  element.click();
  if (requiresVerification) return waitForVerifiedUiOutcome(pathname, statuses);
  return ok("Visible BOS control activated.", { ref, label });
}

function internalHref(value: unknown) {
  return isKnownOrionOperatorHref(value) ? String(value).trim() : null;
}

export async function executeOrionUiOperator(params: OperatorParams): Promise<OrionRealtimeToolExecutionResult> {
  if (typeof window === "undefined" || typeof document === "undefined") return fail("Orion UI Operator requires the BOS browser.");
  const action = typeof params.action === "string" ? params.action as OrionUiOperatorAction : null;
  if (action === "observe") return observe();
  if (action === "navigate") {
    const href = internalHref(params.href);
    if (!href) return fail("That BOS route does not exist. Use a verified BOS route instead.", { validMainRoutes: ORION_OPERATOR_MAIN_ROUTES });
    return ok("BOS navigation requested.", { href }, href);
  }
  if (action === "set") {
    const ref = typeof params.ref === "string" ? params.ref : "";
    const value = typeof params.value === "string" || typeof params.value === "number" ? String(params.value) : "";
    if (!ref) return fail("A visible control reference is required. Observe the screen first.");
    return setControl(ref, value);
  }
  if (action === "click") {
    const ref = typeof params.ref === "string" ? params.ref : "";
    if (!ref) return fail("A visible control reference is required. Observe the screen first.");
    return clickControl(ref);
  }
  return fail("A valid Orion UI Operator action is required.");
}
