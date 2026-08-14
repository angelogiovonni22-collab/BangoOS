import { escapeContractEmailText } from "@/lib/estimates/contract-email";

type BrandedEstimateEmailInput = {
  companyName: string;
  companyLogoUrl?: string | null;
  customerFirstName?: string | null;
  estimateTitle: string;
  estimateNumber?: string | null;
  totalAmount: number;
  reviewUrl: string;
  termsUrl: string;
  expiresAt: string;
};

const money = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

function safeLogoUrl(value?: string | null) {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? escapeContractEmailText(parsed.toString()) : null;
  } catch {
    return null;
  }
}

export function renderBrandedEstimateEmail(input: BrandedEstimateEmailInput) {
  const company = escapeContractEmailText(input.companyName);
  const customer = escapeContractEmailText(input.customerFirstName?.trim() || "there");
  const title = escapeContractEmailText(input.estimateTitle);
  const number = escapeContractEmailText(input.estimateNumber || "Estimate");
  const reviewUrl = escapeContractEmailText(input.reviewUrl);
  const termsUrl = escapeContractEmailText(input.termsUrl);
  const logoUrl = safeLogoUrl(input.companyLogoUrl);
  const expiration = escapeContractEmailText(
    new Date(input.expiresAt).toLocaleString("en-US", {
      dateStyle: "long",
      timeStyle: "short",
    }),
  );

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width">
    <title>${company} estimate</title>
  </head>
  <body style="margin:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#10233f;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your ${company} estimate is ready for review and electronic signature.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:32px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #d8e2ee;border-radius:20px;overflow:hidden;">
          <tr>
            <td style="background:#07172f;padding:28px 34px;color:#ffffff;">
              ${logoUrl ? `<img src="${logoUrl}" alt="${company}" width="180" style="display:block;max-width:180px;height:auto;margin:0 0 16px;">` : `<div style="font-size:21px;font-weight:800;letter-spacing:.04em;">${company}</div>`}
              <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#9fb7d2;">Estimate ready for review</div>
            </td>
          </tr>
          <tr>
            <td style="padding:34px;">
              <p style="margin:0 0 14px;font-size:16px;line-height:1.6;">Hello ${customer},</p>
              <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#07172f;">Review your estimate</h1>
              <p style="margin:0 0 26px;font-size:16px;line-height:1.6;color:#40536a;">${company} has prepared the following estimate for your review and electronic signature.</p>

              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 28px;border:1px solid #d8e2ee;border-radius:14px;background:#f7f9fc;">
                <tr><td style="padding:20px 22px;">
                  <div style="font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:#64748b;">${number}</div>
                  <div style="margin-top:7px;font-size:20px;font-weight:700;color:#10233f;">${title}</div>
                  <div style="margin-top:12px;font-size:24px;font-weight:800;color:#0c6b4f;">${escapeContractEmailText(money(input.totalAmount))}</div>
                </td></tr>
              </table>

              <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 24px;">
                <tr><td style="border-radius:12px;background:#0d315f;">
                  <a href="${reviewUrl}" style="display:inline-block;padding:15px 28px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:700;">Review &amp; Sign Estimate</a>
                </td></tr>
              </table>

              <p style="margin:0 0 12px;text-align:center;font-size:13px;line-height:1.5;color:#64748b;">This private link expires ${expiration}. Do not forward it.</p>
              <p style="margin:0;text-align:center;font-size:13px;line-height:1.5;color:#64748b;">By signing, you agree to the estimate, the incorporated Construction Agreement, and the <a href="${termsUrl}" style="color:#0d315f;font-weight:600;">B.O.S. Electronic Signature &amp; Platform Terms</a>.</p>
            </td>
          </tr>
          <tr>
            <td style="border-top:1px solid #d8e2ee;background:#f7f9fc;padding:22px 34px;text-align:center;font-size:12px;line-height:1.6;color:#64748b;">
              Sent securely by ${company} through B.O.S.<br>
              If you were not expecting this estimate, contact ${company} directly.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}
