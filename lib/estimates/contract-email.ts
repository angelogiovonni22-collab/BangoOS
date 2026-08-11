export async function sendContractEmail(input: { to: string; subject: string; html: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BOS_CONTRACT_EMAIL_FROM;
  if (!apiKey || !from) return { delivered: false, providerId: null, reason: "email_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
  });
  const payload = await response.json() as { id?: string; message?: string };
  if (!response.ok) return { delivered: false, providerId: null, reason: payload.message || "email_delivery_failed" };
  return { delivered: true, providerId: payload.id || null, reason: null };
}
