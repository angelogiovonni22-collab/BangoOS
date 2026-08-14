export async function sendContractEmail(input: { to: string; subject: string; html: string; idempotencyKey?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOS_CONTRACT_EMAIL_FROM;
  if (!apiKey || !from) return { delivered: false, providerId: null, reason: "email_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey.slice(0, 256) } : {}) },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  const payload = await response.json() as { id?: string; message?: string };
  if (!response.ok) return { delivered: false, providerId: null, reason: payload.message || "email_delivery_failed" };
  return { delivered: true, providerId: payload.id || null, reason: null };
}

export function estimateContractPublicUrl(token: string) {
  const configured = process.env.BOS_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL;
  if (!configured?.trim()) throw new Error("BOS public application URL is not configured for estimate email delivery.");
  const origin = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return new URL(`/contracts/estimate/${encodeURIComponent(token)}`, origin).toString();
}

export function escapeContractEmailText(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] || character);
}
