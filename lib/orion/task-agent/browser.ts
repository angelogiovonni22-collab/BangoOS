"use client";

import type { OrionRealtimeToolExecutionResult } from "@/lib/orion/realtime/types";

export const ORION_TASK_AGENT_TOOL = "orion_task_agent";

export type OrionTaskType = "estimate" | "customer" | "project" | "invoice" | "schedule" | "generic";
export type OrionTaskAction = "start" | "get" | "update" | "inspect_form" | "patch_form" | "add_line_item" | "save_form" | "cancel";

type OrionTaskState = {
  id: string;
  taskType: OrionTaskType;
  goal: string;
  status: "active" | "completed" | "cancelled";
  data: Record<string, unknown>;
  startedAt: number;
  updatedAt: number;
};

type TaskParams = {
  action?: unknown;
  taskType?: unknown;
  goal?: unknown;
  fields?: unknown;
  lineItem?: unknown;
  saveMode?: unknown;
};

const STORAGE_KEY = "bangoos:orion-task-agent:v1";
const ESTIMATE_REQUIRED_FIELDS = ["title", "customer"] as const;
const ESTIMATE_FIELD_SELECTORS: Record<string, string> = {
  title: "#estimate-title",
  estimateNumber: "#estimate-number",
  issueDate: "#estimate-date",
  expirationDate: "#expiration-date",
  preparedBy: "#prepared-by",
  status: "#estimate-status",
  description: "#estimate-description",
  customer: "#estimate-customer",
  project: "#estimate-project",
  discountType: "#estimate-discount-type",
  discountValue: "#estimate-discount-value",
  taxRatePercent: "#estimate-tax-rate",
  additionalFee: "#estimate-additional-fee",
  internalNotes: "#estimate-internal-notes",
  customerNotes: "#estimate-customer-notes",
  scopeInclusions: "#estimate-scope-inclusions",
  scopeExclusions: "#estimate-scope-exclusions",
  terms: "#estimate-terms",
  paymentTerms: "#estimate-payment-terms",
};

function ok(userMessage: string, details?: unknown, href?: string | null): OrionRealtimeToolExecutionResult {
  return {
    ok: true,
    statusCategory: "task_agent_completed",
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
    statusCategory: "task_agent_failed",
    userMessage,
    href: null,
    confirmationRequired: false,
    confirmationToken: null,
    details,
  };
}

function readState(): OrionTaskState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrionTaskState;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function writeState(state: OrionTaskState | null) {
  if (typeof window === "undefined") return;
  try {
    if (!state) window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Session persistence is a resilience aid, not a requirement.
  }
}

function taskSchema(taskType: OrionTaskType) {
  if (taskType !== "estimate") return { taskType, formAvailable: false };
  return {
    taskType,
    formAvailable: true,
    href: "/estimates/new",
    requiredFields: [...ESTIMATE_REQUIRED_FIELDS],
    optionalFields: Object.keys(ESTIMATE_FIELD_SELECTORS).filter((key) => !ESTIMATE_REQUIRED_FIELDS.includes(key as (typeof ESTIMATE_REQUIRED_FIELDS)[number])),
    lineItemFields: ["itemCode", "category", "description", "quantity", "unit", "unitCost", "markupPercent", "notes"],
    categories: ["labor", "materials", "equipment", "subcontractors", "general_conditions", "permits_fees", "other"],
    units: ["each", "hour", "day", "week", "square_foot", "linear_foot", "cubic_yard", "lump_sum"],
    guidance: "Collect actual values conversationally. A phrase naming a field, such as 'customer name', is not itself the field value. Ask for the actual customer name before patching the form.",
  };
}

function normalizeTaskType(value: unknown): OrionTaskType {
  return value === "estimate" || value === "customer" || value === "project" || value === "invoice" || value === "schedule" ? value : "generic";
}

function normalizeAction(value: unknown): OrionTaskAction | null {
  const allowed: OrionTaskAction[] = ["start", "get", "update", "inspect_form", "patch_form", "add_line_item", "save_form", "cancel"];
  return typeof value === "string" && allowed.includes(value as OrionTaskAction) ? value as OrionTaskAction : null;
}

function nativeSetValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string) {
  if (element instanceof HTMLSelectElement) {
    const wanted = value.trim().toLowerCase();
    const byValue = Array.from(element.options).find((option) => option.value.toLowerCase() === wanted);
    const byLabel = Array.from(element.options).find((option) => option.textContent?.trim().toLowerCase() === wanted);
    const partialLabel = Array.from(element.options).find((option) => option.textContent?.trim().toLowerCase().includes(wanted));
    const option = byValue || byLabel || partialLabel;
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
  return true;
}

async function waitForSelector(selector: string, timeoutMs = 5000): Promise<Element | null> {
  if (typeof document === "undefined") return null;
  const immediate = document.querySelector(selector);
  if (immediate) return immediate;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    const found = document.querySelector(selector);
    if (found) return found;
  }
  return null;
}

function plainFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([, item]) => typeof item === "string" || typeof item === "number")
    .map(([key, item]) => [key, String(item)]));
}

async function inspectEstimateForm() {
  const root = await waitForSelector("#estimate-title", 5000);
  if (!root) return fail("The New Estimate form is not mounted yet. Open /estimates/new and try again.", { pathname: window.location.pathname });

  const values: Record<string, string> = {};
  for (const [field, selector] of Object.entries(ESTIMATE_FIELD_SELECTORS)) {
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!element) continue;
    if (element instanceof HTMLSelectElement) {
      values[field] = element.selectedOptions[0]?.textContent?.trim() || element.value;
    } else {
      values[field] = element.value;
    }
  }

  const lineItems = Array.from(document.querySelectorAll<HTMLElement>("[data-orion-line-item-row]")).map((row) => {
    const item: Record<string, string> = {};
    for (const control of Array.from(row.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-orion-line-item-field]"))) {
      const key = control.dataset.orionLineItemField;
      if (!key) continue;
      item[key] = control instanceof HTMLSelectElement ? (control.selectedOptions[0]?.textContent?.trim() || control.value) : control.value;
    }
    return item;
  });

  const missingRequired = ESTIMATE_REQUIRED_FIELDS.filter((field) => !values[field] || /select customer/i.test(values[field]));
  return ok("Estimate form inspected.", { values, lineItems, missingRequired, schema: taskSchema("estimate") });
}

async function patchEstimateForm(fields: Record<string, string>) {
  const root = await waitForSelector("#estimate-title", 5000);
  if (!root) return fail("The New Estimate form is not mounted yet. Open /estimates/new before filling it.", { pathname: window.location.pathname });

  const applied: Record<string, string> = {};
  const rejected: Record<string, string> = {};
  for (const [field, value] of Object.entries(fields)) {
    const selector = ESTIMATE_FIELD_SELECTORS[field];
    if (!selector) {
      rejected[field] = "unsupported field";
      continue;
    }
    const element = document.querySelector(selector) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null;
    if (!element) {
      rejected[field] = "field not mounted";
      continue;
    }
    if (field === "customer" && /^(customer|customer name|name)$/i.test(value.trim())) {
      rejected[field] = "field label is not a customer value; ask for the actual customer name";
      continue;
    }
    const didApply = nativeSetValue(element, value);
    if (didApply) applied[field] = value;
    else rejected[field] = "no matching option/value";
  }

  const current = readState();
  if (current) {
    const next = { ...current, data: { ...current.data, ...applied }, updatedAt: Date.now() };
    writeState(next);
  }

  return ok("Estimate fields updated visually.", { applied, rejected });
}

async function addEstimateLineItem(lineItem: Record<string, string>) {
  const addButton = await waitForSelector('[data-orion-action="add-line-item"]', 5000) as HTMLButtonElement | null;
  if (!addButton) return fail("The estimate line-item builder is not mounted yet.");

  const rowsBefore = document.querySelectorAll("[data-orion-line-item-row]").length;
  let row = document.querySelector<HTMLElement>(`[data-orion-line-item-row="${Math.max(0, rowsBefore - 1)}"]`);
  const existingIsBlank = row && !((row.querySelector('[data-orion-line-item-field="description"]') as HTMLInputElement | null)?.value || "").trim();
  if (!existingIsBlank) {
    addButton.click();
    row = await waitForSelector(`[data-orion-line-item-row="${rowsBefore}"]`, 2000) as HTMLElement | null;
  }
  if (!row) return fail("Orion could not create a line-item row.");

  const applied: Record<string, string> = {};
  const rejected: Record<string, string> = {};
  for (const [field, value] of Object.entries(lineItem)) {
    const element = row.querySelector(`[data-orion-line-item-field="${field}"]`) as HTMLInputElement | HTMLSelectElement | null;
    if (!element) {
      rejected[field] = "unsupported line-item field";
      continue;
    }
    if (nativeSetValue(element, value)) applied[field] = value;
    else rejected[field] = "no matching option/value";
  }
  return ok("Estimate line item added visually.", { applied, rejected });
}

async function saveEstimateForm(saveMode: string) {
  const form = await waitForSelector("form", 5000) as HTMLFormElement | null;
  if (!form || !document.querySelector("#estimate-title")) return fail("The estimate form is not mounted yet.");
  const buttons = Array.from(form.querySelectorAll<HTMLButtonElement>("button"));
  const wanted = saveMode === "draft" ? /save draft/i : /save and continue editing|save changes/i;
  const button = buttons.find((item) => wanted.test(item.textContent || ""));
  if (!button) return fail("The requested estimate save action is unavailable.");
  button.click();
  const current = readState();
  if (current) writeState({ ...current, status: "completed", updatedAt: Date.now() });
  return ok(saveMode === "draft" ? "Estimate draft save requested." : "Estimate save requested.", { saveMode });
}

export async function executeOrionTaskAgent(params: TaskParams): Promise<OrionRealtimeToolExecutionResult> {
  if (typeof window === "undefined") return fail("Orion task-agent UI control requires the BOS browser.");
  const action = normalizeAction(params.action);
  if (!action) return fail("A valid Orion task-agent action is required.");

  if (action === "start") {
    const taskType = normalizeTaskType(params.taskType);
    const goal = typeof params.goal === "string" && params.goal.trim() ? params.goal.trim() : `Complete ${taskType} task`;
    const now = Date.now();
    const state: OrionTaskState = { id: `orion-task-${now}`, taskType, goal, status: "active", data: {}, startedAt: now, updatedAt: now };
    writeState(state);
    const schema = taskSchema(taskType);
    const href = taskType === "estimate" ? "/estimates/new" : null;
    return ok(`Started ${taskType} task.`, { task: state, schema }, href);
  }

  if (action === "get") {
    const state = readState();
    return state ? ok("Active Orion task loaded.", { task: state, schema: taskSchema(state.taskType) }) : ok("There is no active Orion task.", { task: null });
  }

  if (action === "cancel") {
    const current = readState();
    if (current) writeState({ ...current, status: "cancelled", updatedAt: Date.now() });
    return ok("The active Orion task was cancelled.", { task: current });
  }

  const current = readState();
  const taskType = current?.taskType || normalizeTaskType(params.taskType);
  if (action === "update") {
    const fields = plainFields(params.fields);
    if (!current) return fail("There is no active Orion task to update. Start the task first.");
    const next = { ...current, data: { ...current.data, ...fields }, updatedAt: Date.now() };
    writeState(next);
    return ok("Orion task memory updated.", { task: next });
  }

  if (taskType !== "estimate") return fail(`Live form control is not registered for task type ${taskType} yet.`, { schema: taskSchema(taskType) });
  if (action === "inspect_form") return inspectEstimateForm();
  if (action === "patch_form") return patchEstimateForm(plainFields(params.fields));
  if (action === "add_line_item") return addEstimateLineItem(plainFields(params.lineItem));
  if (action === "save_form") return saveEstimateForm(typeof params.saveMode === "string" ? params.saveMode : "continue");
  return fail("Unsupported Orion task-agent operation.");
}
