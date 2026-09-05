import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { OrionAutonomyPlanRequestStep } from "./plan-request";
import type { OrionStepReferenceOutput } from "./step-references";

const CONTINUATION_TTL_MS = 120_000;

type OrionSafeReadContinuationPayload = {
  companyId: string;
  userId: string;
  executionId: string;
  steps: OrionAutonomyPlanRequestStep[];
  outputs: OrionStepReferenceOutput[];
  nextZeroIndex: number;
  expiresAt: number;
};

function continuationSecret() {
  return process.env.ORION_CONFIRMATION_SECRET?.trim() || process.env.OPENAI_API_KEY?.trim() || null;
}

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret, "utf8").digest();
}

export function encodeOrionSafeReadContinuation(payload: Omit<OrionSafeReadContinuationPayload, "expiresAt">) {
  const secret = continuationSecret();
  if (!secret) return null;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const plaintext = Buffer.from(JSON.stringify({ ...payload, expiresAt: Date.now() + CONTINUATION_TTL_MS }), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), ciphertext.toString("base64url"), tag.toString("base64url")].join(".");
}

export function decodeOrionSafeReadContinuation(token: string): OrionSafeReadContinuationPayload | null {
  const secret = continuationSecret();
  if (!secret) return null;
  const [version, ivText, ciphertextText, tagText] = token.split(".");
  if (version !== "v1" || !ivText || !ciphertextText || !tagText) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", keyFromSecret(secret), Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextText, "base64url")),
      decipher.final(),
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as OrionSafeReadContinuationPayload;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.companyId !== "string" || typeof parsed.userId !== "string" || typeof parsed.executionId !== "string") return null;
    if (!Array.isArray(parsed.steps) || !Array.isArray(parsed.outputs)) return null;
    if (!Number.isInteger(parsed.nextZeroIndex) || parsed.nextZeroIndex < 0 || parsed.nextZeroIndex > parsed.steps.length) return null;
    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}
