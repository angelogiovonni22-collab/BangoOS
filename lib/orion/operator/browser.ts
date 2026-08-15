"use client";

import type { OrionRealtimeToolExecutionResult } from "@/lib/orion/realtime/types";
import { resolveKnownOrionOperatorHref, ORION_OPERATOR_MAIN_ROUTES } from "./routes";

export const ORION_UI_OPERATOR_TOOL = "orion_ui_operator";

export type OrionUiOperatorAction = "observe" | "navigate" | "set" | "batch_set" | "click" | "scroll";

type BatchChange = {
  ref?: unknown;
  value?: unknown;
};

type OperatorParams = {
  action?: unknown;
  href?: unknown;
  ref?: unknown;
  value?: unknown;
  changes?: unknown;
  direction?: unknown;
};

type InteractiveElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | HTMLButtonElement | HTMLAnchorElement;
type SettableElement = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

type PreparedChange = {
  ref: string;
  value: string;
  element: SettableElement;
  label: string;
};

const DESTRUCTIVE_TEXT = /\b(delete|remove|refund|void|archive permanently|discard permanently)\b/i;
const MAX_CONTROLS = 120;
const MAX_BATCH_CHANGES = 40;
let observationRequiredAfterScroll = false;

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

function inViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth;
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
    inViewport: inViewport(element),
  };
}

function observe() {
  observationRequiredAfterScroll = false;
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

function isSettableElement(element: InteractiveElement): element is SettableElement {
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement;
}

function canSelectValue(element: HTMLSelectElement, value: string) {
  const wanted = normalizeText(value).toLowerCase();
  const options = Array.from(element.options);
  return options.some((option) => option.value.toLowerCase() === wanted)
    || options.some((option) => normalizeText(option.textContent || "").toLowerCase() === wanted)
    || options.some((option) => normalizeText(option.textContent || "").toLowerCase().includes(wanted));
}

function nativeSetValue(element: SettableElement, value: string, focus = true) {
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
    if (focus) element.focus();
    return true;
  }

  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  if (focus) element.focus();
  return true;
}

function setControl(ref: string, value: string) {
  if (observationRequiredAfterScroll) return fail("The BOS screen changed after scrolling. Observe the visible screen again before editing.", { reobserveRequired: true });
  const element = resolveRef(ref);
  if (!element) return fail("That visible BOS control is no longer available. Observe the screen again before continuing.", { ref });
  if (!isSettableElement(element)) {
    return fail("That control cannot accept a value.", { ref, label: associatedLabel(element) });
  }
  if (!visible(element) || !inViewport(element) || element.hasAttribute("disabled")) return fail("That control is outside the active viewport. Scroll it into view, then observe again.", { ref, scrollRequired: true });
  if (element.dataset.orionConfirmation === "required") return fail("That status-sensitive control requires Orion's confirmed canonical BOS action.", { ref, requiresCanonicalConfirmation: true });
  const didSet = nativeSetValue(element, value);
  if (!didSet) return fail("That value does not match an available option. Observe the screen and use one of the visible options.", { ref, value });
  return ok("Visible BOS control updated.", { ref, label: associatedLabel(element), value });
}

function parseBatchChanges(value: unknown): BatchChange[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_BATCH_CHANGES) return null;
  return value as BatchChange[];
}

function prepareBatchChange(change: BatchChange, index: number): PreparedChange | OrionRealtimeToolExecutionResult {
  const ref = typeof change.ref === "string" ? change.ref : "";
  const value = typeof change.value === "string" || typeof change.value === "number" ? String(change.value) : "";
  if (!ref) return fail("Every batch update requires an exact semantic control reference from the latest observation.", { index });
  const element = resolveRef(ref);
  if (!element) return fail("A batch control is no longer available. Observe the BOS screen again before continuing.", { index, ref, reobserveRequired: true });
  if (!isSettableElement(element)) return fail("A batch target cannot accept a value.", { index, ref, label: associatedLabel(element) });
  if (!visible(element) || element.hasAttribute("disabled")) return fail("A batch target is no longer active on the mounted BOS form. Observe again before continuing.", { index, ref, reobserveRequired: true });
  if (element.dataset.orionConfirmation === "required") return fail("A batch target requires Orion's confirmed canonical BOS action.", { index, ref, requiresCanonicalConfirmation: true });
  if (element instanceof HTMLSelectElement && !canSelectValue(element, value)) {
    return fail("A batch value does not match an available option. Observe the screen and use one of the returned options.", { index, ref, value });
  }
  return { ref, value, element, label: associatedLabel(element) };
}

function isPreparedChange(value: PreparedChange | OrionRealtimeToolExecutionResult): value is PreparedChange {
  return "element" in value;
}

function batchSetControls(changesValue: unknown) {
  if (observationRequiredAfterScroll) return fail("The BOS screen changed after scrolling. Observe the visible screen again before batch editing.", { reobserveRequired: true });
  const changes = parseBatchChanges(changesValue);
  if (!changes) return fail(`Batch editing requires between 1 and ${MAX_BATCH_CHANGES} field updates.`);

  const startedAt = performance.now();
  const seenRefs = new Set<string>();
  const prepared: PreparedChange[] = [];
  for (let index = 0; index < changes.length; index += 1) {
    const next = prepareBatchChange(changes[index], index);
    if (!isPreparedChange(next)) return next;
    if (seenRefs.has(next.ref)) return fail("A batch update cannot target the same BOS control more than once.", { ref: next.ref });
    seenRefs.add(next.ref);
    prepared.push(next);
  }

  for (const change of prepared) {
    nativeSetValue(change.element, change.value, false);
  }

  const last = prepared.at(-1);
  if (last) last.element.focus({ preventScroll: true });

  return ok(`${prepared.length} BOS fields updated in one operation.`, {
    updatedCount: prepared.length,
    elapsedMs: Math.round(performance.now() - startedAt),
    updates: prepared.map((change) => ({ ref: change.ref, label: change.label, value: change.value })),
    batch: true,
  });
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
  if (observationRequiredAfterScroll) return fail("The BOS screen changed after scrolling. Observe the visible screen again before interacting.", { reobserveRequired: true });
  const element = resolveRef(ref);
  if (!element) return fail("That visible BOS control is no longer available. Observe the screen again before continuing.", { ref });
  if (!(element instanceof HTMLButtonElement || element instanceof HTMLAnchorElement)) return fail("That control is not clickable.", { ref });
  if (!visible(element) || !inViewport(element) || element.hasAttribute("disabled")) return fail("That control is outside the active viewport. Scroll it into view, then observe again.", { ref, scrollRequired: true });
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

function scrollableAncestor(element: HTMLElement | null): HTMLElement | null {
  let current = element?.parentElement || null;
  while (current && current !== document.body) {
    const style = window.getComputedStyle(current);
    const scrollable = /(auto|scroll)/.test(`${style.overflowY} ${style.overflow}`) && current.scrollHeight > current.clientHeight;
    if (scrollable) return current;
    current = current.parentElement;
  }
  return null;
}

function scrollScreen(direction: string, ref: string) {
  if (direction === "control") {
    const element = resolveRef(ref);
    if (!element) return fail("That observed control is no longer available. Observe the screen again.", { ref });
    element.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    observationRequiredAfterScroll = true;
    return ok("The observed BOS control was brought into view. Observe the screen again before interacting.", { ref, reobserveRequired: true });
  }

  if (!["up", "down", "top", "bottom"].includes(direction)) return fail("Choose scroll direction up, down, top, bottom, or control.");
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const target = scrollableAncestor(focused) || document.scrollingElement;
  if (!target) return fail("The active BOS content region cannot be scrolled.");
  if (direction === "top") target.scrollTo({ top: 0, behavior: "auto" });
  else if (direction === "bottom") target.scrollTo({ top: target.scrollHeight, behavior: "auto" });
  else target.scrollBy({ top: (direction === "down" ? 1 : -1) * Math.max(1, target.clientHeight) * 0.8, behavior: "auto" });
  observationRequiredAfterScroll = true;
  return ok(`The active BOS content region scrolled ${direction}. Observe the screen again before interacting.`, { direction, reobserveRequired: true });
}

function internalHref(value: unknown) {
  return resolveKnownOrionOperatorHref(value);
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
  if (action === "batch_set") {
    return batchSetControls(params.changes);
  }
  if (action === "click") {
    const ref = typeof params.ref === "string" ? params.ref : "";
    if (!ref) return fail("A visible control reference is required. Observe the screen first.");
    return clickControl(ref);
  }
  if (action === "scroll") {
    const direction = typeof params.direction === "string" ? params.direction.toLowerCase() : "";
    const ref = typeof params.ref === "string" ? params.ref : "";
    return scrollScreen(direction, ref);
  }
  return fail("A valid Orion UI Operator action is required.");
}
