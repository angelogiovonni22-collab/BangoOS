import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

export type InviteDeliveryResult = {
  channel: "email" | "sms";
  status: "sent" | "skipped" | "failed";
  message?: string;
};

export function readableInviteError(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized && normalized !== "{}" && normalized !== "[object Object]") return normalized;
    return fallback;
  }
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "msg", "detail", "details", "description", "code", "name"]) {
      const nested = readableInviteError(record[key], "");
      if (nested) return nested;
    }
  }
  return fallback;
}

export function normalizeInviteEmail(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function isValidInviteEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeInvitePhone(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return "";
}

export function createTradePartnerInviteToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashTradePartnerInviteToken(token) };
}

export function hashTradePartnerInviteToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function publicAppUrl(request: NextRequest) {
  const configured = process.env.BOS_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || "";
  return (configured || request.nextUrl.origin).replace(/\/$/, "");
}

export function buildTradePartnerIntakeLink(request: NextRequest, token: string) {
  const url = new URL("/trade-partner-invite", publicAppUrl(request));
  url.searchParams.set("token", token);
  return url.toString();
}

export function buildTradePartnerActivationLink(
  request: NextRequest,
  tokenHash: string,
  type: "invite" | "recovery",
) {
  const url = new URL("/auth/activate", publicAppUrl(request));
  url.searchParams.set("token_hash", tokenHash);
  url.searchParams.set("type", type);
  url.searchParams.set("next", "/partner/welcome");
  return url.toString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export async function sendTradePartnerEmail(input: {
  email: string;
  link: string;
  recipientName?: string;
  companyName?: string;
  stage: "intake" | "activation";
  idempotencyKey: string;
}) {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const from = process.env.BOS_AUTH_FROM_EMAIL?.trim() || "";
  if (!apiKey || !from) {
    throw new Error("Trade Partner email delivery is not configured in this B.O.S. environment.");
  }

  const greeting = input.recipientName?.trim() ? `Hi ${escapeHtml(input.recipientName.trim())},` : "Hello,";
  const companyName = escapeHtml(input.companyName?.trim() || "your company");
  const actionLink = escapeHtml(input.link);
  const isActivation = input.stage === "activation";
  const subject = isActivation ? "Finish your B.O.S. Trade Partner account" : "Complete your B.O.S. Trade Partner profile";
  const heading = isActivation ? "Your secure B.O.S. account setup is ready" : "You have a B.O.S. Trade Partner invitation";
  const bodyCopy = isActivation
    ? "Use the secure button below to create your password. After that, B.O.S. will take you directly to your Trade Partner onboarding profile."
    : `You have been invited to join ${companyName} as a Trade Partner. B.O.S. will collect your company, trade, and compliance information directly from you so the contractor does not have to enter it manually.`;
  const buttonLabel = isActivation ? "Finish My Secure Account" : "Start Trade Partner Setup";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": input.idempotencyKey,
      "User-Agent": "BangoOS/1.0",
    },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject,
      html: `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce4ee;border-radius:16px;overflow:hidden;"><tr><td style="background:#07131f;padding:28px 32px;color:#ffffff;"><div style="font-size:25px;font-weight:800;letter-spacing:.04em;">B.O.S.</div><div style="margin-top:5px;font-size:11px;letter-spacing:.16em;color:#8ec3ff;font-weight:700;">BANGO OPERATING SYSTEM</div></td></tr><tr><td style="padding:34px 32px;"><p style="margin:0 0 18px;font-size:16px;line-height:1.6;">${greeting}</p><h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#101827;">${heading}</h1><p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#445166;">${bodyCopy}</p><p style="margin:0 0 28px;"><a href="${actionLink}" style="display:inline-block;background:#1479e8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:9px;">${buttonLabel}</a></p><div style="border-top:1px solid #e3e9f1;padding-top:20px;font-size:12px;line-height:1.6;color:#738096;">For security, do not forward this invitation. If you were not expecting access to B.O.S., you can ignore this message.</div></td></tr></table></td></tr></table></body></html>`,
    }),
    cache: "no-store",
  });

  if (response.ok) return;
  const raw = await response.text();
  let providerError: unknown = raw;
  try { providerError = raw ? JSON.parse(raw) : null; } catch {}
  throw new Error(`Resend rejected the Trade Partner message: ${readableInviteError(providerError, `HTTP ${response.status}`)}`);
}

export async function sendTradePartnerSms(input: {
  phone: string;
  link: string;
  stage: "intake" | "activation";
}) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() || "";
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID?.trim() || "";
  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim() || "";
  if (!accountSid || !authToken || (!messagingServiceSid && !fromNumber)) {
    throw new Error("Trade Partner SMS delivery is not configured. Add the Twilio account credentials and a Messaging Service SID or From number to B.O.S. Production.");
  }

  const params = new URLSearchParams();
  params.set("To", input.phone);
  params.set(
    "Body",
    input.stage === "activation"
      ? `B.O.S.: Your secure Trade Partner account setup is ready. Open ${input.link}`
      : `B.O.S.: You have a Trade Partner invitation. Complete your setup here: ${input.link}`,
  );
  if (messagingServiceSid) params.set("MessagingServiceSid", messagingServiceSid);
  else params.set("From", fromNumber);

  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "BangoOS/1.0",
    },
    body: params.toString(),
    cache: "no-store",
  });

  if (response.ok) return;
  const raw = await response.text();
  let providerError: unknown = raw;
  try { providerError = raw ? JSON.parse(raw) : null; } catch {}
  throw new Error(`Twilio rejected the Trade Partner SMS: ${readableInviteError(providerError, `HTTP ${response.status}`)}`);
}
