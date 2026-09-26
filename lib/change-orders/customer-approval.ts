import { createHash, randomBytes } from "node:crypto";
import { escapeContractEmailText } from "@/lib/estimates/contract-email";

export function createChangeOrderApprovalToken() {
  const token = `${randomBytes(24).toString("hex")}.${randomBytes(24).toString("base64url")}`;
  return { token, tokenHash: hashChangeOrderApprovalToken(token) };
}

export function hashChangeOrderApprovalToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function changeOrderApprovalPublicUrl(token: string) {
  const configured = process.env.BOS_PUBLIC_APP_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || process.env.VERCEL_PROJECT_PRODUCTION_URL
    || process.env.VERCEL_URL;
  if (!configured?.trim()) throw new Error("BOS public application URL is not configured for change-order approval.");
  const origin = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
  return new URL(`/change-orders/approval/${encodeURIComponent(token)}`, origin).toString();
}

export function renderChangeOrderApprovalEmail(input: {
  companyName: string;
  customerFirstName: string | null;
  changeOrderNumber: string;
  title: string;
  totalAmount: number;
  reviewUrl: string;
  expiresAt: string;
}) {
  const name = input.customerFirstName?.trim() || "Customer";
  const money = Number(input.totalAmount || 0).toLocaleString("en-US", { style: "currency", currency: "USD" });
  const expires = new Date(input.expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return `
  <div style="font-family:Arial,sans-serif;background:#f3f6fa;padding:32px;color:#102033">
    <div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #d7e0ea;border-radius:18px;overflow:hidden">
      <div style="background:#071a2b;color:#fff;padding:26px 30px">
        <div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#87bff2;font-weight:700">${escapeContractEmailText(input.companyName)}</div>
        <h1 style="margin:8px 0 0;font-size:26px">Change Order Ready for Approval</h1>
      </div>
      <div style="padding:30px">
        <p>Hi ${escapeContractEmailText(name)},</p>
        <p>${escapeContractEmailText(input.companyName)} has sent change order <strong>${escapeContractEmailText(input.changeOrderNumber)}</strong> for your review.</p>
        <div style="margin:24px 0;padding:18px;border:1px solid #d7e0ea;border-radius:12px;background:#f8fbfe">
          <div style="font-size:13px;color:#60758a">Change order</div>
          <div style="font-size:18px;font-weight:700;margin-top:4px">${escapeContractEmailText(input.title)}</div>
          <div style="font-size:13px;color:#60758a;margin-top:16px">Total</div>
          <div style="font-size:28px;font-weight:800;margin-top:4px">${money}</div>
        </div>
        <a href="${input.reviewUrl}" style="display:inline-block;background:#1677e8;color:#fff;text-decoration:none;padding:13px 20px;border-radius:10px;font-weight:700">Review Change Order</a>
        <p style="margin-top:24px;font-size:12px;color:#74869a">Secure link expires ${escapeContractEmailText(expires)}.</p>
      </div>
    </div>
  </div>`;
}
