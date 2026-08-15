"use client";

import { applySavedOrionZoom, ensureOrionReminderScheduler } from "./browser";

type RuntimeWindow = Window & { __bosOrionPersonalAssistantRuntime?: boolean };

type DueReminderDetail = {
  title?: string;
  message?: string;
  eventTitle?: string | null;
};

if (typeof window !== "undefined") {
  const runtimeWindow = window as RuntimeWindow;
  if (!runtimeWindow.__bosOrionPersonalAssistantRuntime) {
    runtimeWindow.__bosOrionPersonalAssistantRuntime = true;
    applySavedOrionZoom();
    ensureOrionReminderScheduler();
    window.addEventListener("bos:orion-reminder-due", ((event: CustomEvent<DueReminderDetail>) => {
      const reminder = event.detail || {};
      const title = reminder.title || "Orion reminder";
      const body = reminder.message || reminder.eventTitle || "Your reminder is due.";
      window.alert(`${title}\n\n${body}`);
    }) as EventListener);
  }
}
