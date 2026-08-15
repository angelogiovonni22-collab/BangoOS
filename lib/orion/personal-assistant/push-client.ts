"use client";

export type OrionPushStatus = "unsupported" | "not_installed" | "default" | "denied" | "enabled" | "error";

function urlBase64ToUint8Array(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function isStandaloneBosApp() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)")?.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export async function getOrionPushStatus(): Promise<OrionPushStatus> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") return "unsupported";
  if (!isStandaloneBosApp() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) return "not_installed";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "default";
  try {
    const registration = await navigator.serviceWorker.getRegistration("/");
    const subscription = await registration?.pushManager.getSubscription();
    return subscription ? "enabled" : "default";
  } catch {
    return "error";
  }
}

export async function enableOrionBackgroundPush() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || typeof Notification === "undefined") {
    throw new Error("This device does not support background web notifications.");
  }
  if (!isStandaloneBosApp() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    throw new Error("On iPhone, add B.O.S. to the Home Screen and open it from the B.O.S. icon before enabling notifications.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const configResponse = await fetch("/api/orion/push/config", { cache: "no-store" });
  const config = await configResponse.json() as { ok?: boolean; publicKey?: string; error?: string };
  if (!configResponse.ok || !config.ok || !config.publicKey) throw new Error(config.error || "Orion push is not configured yet.");

  const registration = await navigator.serviceWorker.register("/orion-sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.publicKey),
  });

  const serialized = subscription.toJSON();
  const response = await fetch("/api/orion/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: serialized.endpoint,
      keys: serialized.keys,
      userAgent: navigator.userAgent,
    }),
  });
  const payload = await response.json() as { ok?: boolean; error?: string };
  if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to save Orion notification subscription.");
  return true;
}
