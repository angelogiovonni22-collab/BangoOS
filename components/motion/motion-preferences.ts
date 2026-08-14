export type MotionPreference = "system" | "reduced" | "full";

export const BANGO_MOTION_PREFERENCE_STORAGE_KEY = "bango.motion.preference";

export function isMotionPreference(value: string | null | undefined): value is MotionPreference {
  return value === "system" || value === "reduced" || value === "full";
}

export function readStoredMotionPreference(): MotionPreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const value = window.localStorage.getItem(BANGO_MOTION_PREFERENCE_STORAGE_KEY);
    if (isMotionPreference(value)) {
      return value;
    }
  } catch {
    return "system";
  }

  return "system";
}

export function writeStoredMotionPreference(preference: MotionPreference): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(BANGO_MOTION_PREFERENCE_STORAGE_KEY, preference);
  } catch {
    // Ignore write failures in restricted storage environments.
  }
}

export function resolveReducedMotion(preference: MotionPreference, systemPrefersReduced: boolean): boolean {
  if (preference === "reduced") {
    return true;
  }

  if (preference === "full") {
    return false;
  }

  return systemPrefersReduced;
}
