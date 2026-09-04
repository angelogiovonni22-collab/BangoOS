import { createHash } from "node:crypto";

const MIN_PASSWORD_LENGTH = 12;
const HIBP_TIMEOUT_MS = 5_000;

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; reason: "length" | "complexity" | "leaked" | "unavailable" };

function hasRequiredCharacterClasses(password: string) {
  return /[a-z]/.test(password)
    && /[A-Z]/.test(password)
    && /\d/.test(password)
    && /[^A-Za-z0-9]/.test(password);
}

export function validatePasswordStrength(password: string): PasswordPolicyResult {
  if (password.length < MIN_PASSWORD_LENGTH) return { ok: false, reason: "length" };
  if (!hasRequiredCharacterClasses(password)) return { ok: false, reason: "complexity" };
  return { ok: true };
}

export async function checkPasswordAgainstPwnedPasswords(password: string): Promise<PasswordPolicyResult> {
  const strength = validatePasswordStrength(password);
  if (!strength.ok) return strength;

  const digest = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: "GET",
      headers: {
        "Add-Padding": "true",
        "User-Agent": "BOS-Password-Breach-Check/1.0",
      },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) return { ok: false, reason: "unavailable" };
    const body = await response.text();
    const leaked = body.split(/\r?\n/).some((line) => line.split(":", 1)[0]?.trim().toUpperCase() === suffix);
    return leaked ? { ok: false, reason: "leaked" } : { ok: true };
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timeout);
  }
}
