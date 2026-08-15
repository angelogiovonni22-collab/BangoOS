"use client";

import type { OrionRealtimeToolExecutionResult } from "@/lib/orion/realtime/types";

export const ORION_PERSONAL_ASSISTANT_TOOL = "orion_personal_assistant";
export const ORION_VIEWPORT_CONTROL_TOOL = "orion_viewport_control";

const REMINDER_STORAGE_KEY = "bangoos:orion-reminders:v1";
const ZOOM_STORAGE_KEY = "bangoos:orion-zoom:v1";
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 1.5;
const ZOOM_STEP = 0.1;

type ReminderRecord = {
  id: string;
  title: string;
  message: string;
  dueAt: string;
  eventTitle: string | null;
  eventStartsAt: string | null;
  linkedHref: string | null;
  createdAt: string;
  firedAt: string | null;
  cancelledAt: string | null;
};

type PersonalAssistantParams = {
  action?: unknown;
  title?: unknown;
  message?: unknown;
  dueAt?: unknown;
  eventTitle?: unknown;
  eventStartsAt?: unknown;
  linkedHref?: unknown;
  reminderId?: unknown;
};

type ViewportParams = {
  action?: unknown;
  percent?: unknown;
};

let reminderTimer: number | null = null;

function ok(userMessage: string, details?: unknown): OrionRealtimeToolExecutionResult {
  return { ok: true, statusCategory: "personal_assistant_completed", userMessage, href: null, confirmationRequired: false, confirmationToken: null, details };
}

function fail(userMessage: string, details?: unknown): OrionRealtimeToolExecutionResult {
  return { ok: false, statusCategory: "personal_assistant_failed", userMessage, href: null, confirmationRequired: false, confirmationToken: null, details };
}

function readReminders(): ReminderRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(REMINDER_STORAGE_KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is ReminderRecord => Boolean(item && typeof item === "object" && typeof (item as ReminderRecord).id === "string")) : [];
  } catch {
    return [];
  }
}

function writeReminders(reminders: ReminderRecord[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REMINDER_STORAGE_KEY, JSON.stringify(reminders));
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

function displayLocal(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function notifyReminder(reminder: ReminderRecord) {
  const body = reminder.message || reminder.eventTitle || "Orion reminder";
  if (typeof Notification !== "undefined" && Notification.permission === "granted") {
    try {
      new Notification(reminder.title || "Orion reminder", { body, tag: `orion-reminder-${reminder.id}` });
      return;
    } catch {
      // Fall through to an in-app alert.
    }
  }

  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("bos:orion-reminder-due", { detail: reminder }));
  }
}

function processDueReminders() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const reminders = readReminders();
  let changed = false;
  const next = reminders.map((reminder) => {
    if (reminder.firedAt || reminder.cancelledAt) return reminder;
    const due = new Date(reminder.dueAt).getTime();
    if (!Number.isFinite(due) || due > now) return reminder;
    changed = true;
    notifyReminder(reminder);
    return { ...reminder, firedAt: new Date().toISOString() };
  });
  if (changed) writeReminders(next);
}

export function ensureOrionReminderScheduler() {
  if (typeof window === "undefined" || reminderTimer !== null) return;
  processDueReminders();
  reminderTimer = window.setInterval(processDueReminders, 15_000);
}

export function stopOrionReminderScheduler() {
  if (typeof window === "undefined" || reminderTimer === null) return;
  window.clearInterval(reminderTimer);
  reminderTimer = null;
}

async function requestNotificationPermission() {
  if (typeof Notification === "undefined") return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export async function executeOrionPersonalAssistant(params: PersonalAssistantParams): Promise<OrionRealtimeToolExecutionResult> {
  if (typeof window === "undefined") return fail("Orion reminders require the B.O.S. browser or installed app.");
  ensureOrionReminderScheduler();
  const action = typeof params.action === "string" ? params.action : "";

  if (action === "now") {
    const now = new Date();
    return ok("Current device time resolved.", {
      localIso: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`,
      utcIso: now.toISOString(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      timezoneOffsetMinutes: now.getTimezoneOffset(),
    });
  }

  if (action === "list") {
    const active = readReminders().filter((item) => !item.cancelledAt && !item.firedAt).sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    return ok(active.length ? `You have ${active.length} active Orion reminder${active.length === 1 ? "" : "s"}.` : "You have no active Orion reminders.", { reminders: active });
  }

  if (action === "cancel") {
    const reminderId = typeof params.reminderId === "string" ? params.reminderId.trim() : "";
    if (!reminderId) return fail("A reminder id is required to cancel a reminder.");
    const reminders = readReminders();
    const target = reminders.find((item) => item.id === reminderId);
    if (!target) return fail("I could not find that reminder.");
    writeReminders(reminders.map((item) => item.id === reminderId ? { ...item, cancelledAt: new Date().toISOString() } : item));
    return ok(`Cancelled reminder: ${target.title}.`, { reminder: target });
  }

  if (action !== "set_reminder" && action !== "set_event_alert") return fail("A valid Orion reminder action is required.");

  const due = validDate(params.dueAt);
  if (!due) return fail("I need a valid reminder date and time before I can set that alert.");
  if (due.getTime() <= Date.now()) return fail("That reminder time has already passed. Please choose a future time.");

  const eventTitle = typeof params.eventTitle === "string" && params.eventTitle.trim() ? params.eventTitle.trim() : null;
  const title = typeof params.title === "string" && params.title.trim() ? params.title.trim() : eventTitle ? `Upcoming: ${eventTitle}` : "Orion reminder";
  const message = typeof params.message === "string" && params.message.trim() ? params.message.trim() : eventTitle ? `Reminder for ${eventTitle}.` : title;
  const reminder: ReminderRecord = {
    id: `orion-reminder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    message,
    dueAt: due.toISOString(),
    eventTitle,
    eventStartsAt: validDate(params.eventStartsAt)?.toISOString() || null,
    linkedHref: typeof params.linkedHref === "string" && params.linkedHref.startsWith("/") ? params.linkedHref : null,
    createdAt: new Date().toISOString(),
    firedAt: null,
    cancelledAt: null,
  };
  writeReminders([...readReminders(), reminder]);
  const notificationPermission = await requestNotificationPermission();
  return ok(`${action === "set_event_alert" ? "Calendar alert" : "Reminder"} set for ${displayLocal(reminder.dueAt)}.`, { reminder, notificationPermission });
}

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

function readZoom() {
  if (typeof window === "undefined") return 1;
  const raw = Number(window.localStorage.getItem(ZOOM_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= MIN_ZOOM && raw <= MAX_ZOOM ? raw : 1;
}

export function applySavedOrionZoom() {
  if (typeof document === "undefined") return;
  const zoom = readZoom();
  document.documentElement.style.zoom = String(zoom);
}

function writeZoom(zoom: number) {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  window.localStorage.setItem(ZOOM_STORAGE_KEY, String(zoom));
  document.documentElement.style.zoom = String(zoom);
}

export async function executeOrionViewportControl(params: ViewportParams): Promise<OrionRealtimeToolExecutionResult> {
  if (typeof window === "undefined" || typeof document === "undefined") return fail("Orion zoom control requires the B.O.S. browser or installed app.");
  const action = typeof params.action === "string" ? params.action : "";
  const current = readZoom();
  let next = current;

  if (action === "zoom_in") next = clampZoom(current + ZOOM_STEP);
  else if (action === "zoom_out") next = clampZoom(current - ZOOM_STEP);
  else if (action === "reset") next = 1;
  else if (action === "set") {
    const percent = typeof params.percent === "number" ? params.percent : Number(params.percent);
    if (!Number.isFinite(percent)) return fail("Tell me the zoom percentage you want, from 75 to 150 percent.");
    next = clampZoom(percent / 100);
  } else if (action === "get") {
    return ok(`B.O.S. zoom is ${Math.round(current * 100)} percent.`, { zoom: current, percent: Math.round(current * 100) });
  } else {
    return fail("A valid Orion zoom action is required.");
  }

  writeZoom(next);
  return ok(`B.O.S. zoom set to ${Math.round(next * 100)} percent.`, { zoom: next, percent: Math.round(next * 100) });
}
