import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";

type InviteBody = { vendorId?: string; email?: string; firstName?: string; lastName?: string };

function readableError(value: unknown, fallback: string): string {
  if (typeof value === "string") { const normalized = value.trim(); if (normalized && normalized !== "{}" && normalized !== "[object Object]") return normalized; return fallback; }
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === "object") { const record = value as Record<string, unknown>; for (const key of ["message", "error_description", "error", "msg", "detail", "details", "description", "code", "name"]) { const nested = readableError(record[key], ""); if (nested) return nested; } }
  return fallback;
}
function escapeHtml(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function publicAppUrl(request: NextRequest) { const configured = process.env.BOS_PUBLIC_APP_URL?.trim() || process.env.NEXT_PUBLIC_SITE_URL?.trim() || ""; return (configured || request.nextUrl.origin).replace(/\/$/, ""); }
function buildConfirmationLink(request: NextRequest, tokenHash: string, type: "invite" | "recovery") {
  // Important: this GET endpoint must never consume the one-time Supabase token.
  // Corporate email security scanners commonly pre-open links. The activation page
  // requires an explicit user POST before verifyOtp runs.
  const url = new URL("/auth/activate", publicAppUrl(request));
  url.searchParams.set("token_hash", tokenHash); url.searchParams.set("type", type); url.searchParams.set("next", "/partner/welcome"); return url.toString();
}
async function rollbackInvitedUser(admin: ReturnType<typeof createAdminClient>, companyId: string, userId: string) {
  try { await admin.from("company_memberships").delete().eq("company_id", companyId).eq("user_id", userId); } catch {}
  try { await admin.from("user_profiles").delete().eq("id", userId); } catch {}
  try { await admin.from("profiles").delete().eq("id", userId); } catch {}
  try { await admin.auth.admin.deleteUser(userId); } catch {}
}
async function sendTradePartnerInviteEmail(input: { actionLink: string; email: string; firstName: string; vendorName: string; userId: string; deliveryId: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim() || ""; const from = process.env.BOS_AUTH_FROM_EMAIL?.trim() || "";
  if (!apiKey || !from) throw new Error("Production Trade Partner email is not configured. Add RESEND_API_KEY and BOS_AUTH_FROM_EMAIL to the B.O.S. Production environment.");
  const greeting = input.firstName ? `Hi ${escapeHtml(input.firstName)},` : "Hello,"; const vendorName = escapeHtml(input.vendorName); const actionLink = escapeHtml(input.actionLink);
  const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `bos-trade-partner-invite-${input.userId}-${input.deliveryId}`, "User-Agent": "BangoOS/1.0" }, body: JSON.stringify({ from, to: [input.email], subject: `You're invited to B.O.S. — ${input.vendorName}`, html: `<!doctype html><html><body style="margin:0;background:#f4f7fb;font-family:Arial,Helvetica,sans-serif;color:#172033;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #dce4ee;border-radius:16px;overflow:hidden;"><tr><td style="background:#07131f;padding:28px 32px;color:#ffffff;"><div style="font-size:25px;font-weight:800;letter-spacing:.04em;">B.O.S.</div><div style="margin-top:5px;font-size:11px;letter-spacing:.16em;color:#8ec3ff;font-weight:700;">BANGO OPERATING SYSTEM</div></td></tr><tr><td style="padding:34px 32px;"><p style="margin:0 0 18px;font-size:16px;line-height:1.6;">${greeting}</p><h1 style="margin:0 0 14px;font-size:24px;line-height:1.25;color:#101827;">Your secure Trade Partner access is ready</h1><p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#445166;">You have been invited to B.O.S. as an authorized Trade Partner for <strong>${vendorName}</strong>.</p><p style="margin:0 0 26px;font-size:15px;line-height:1.7;color:#445166;">Use the secure button below to finish your account, create your password, and access only the projects assigned to your Trade Partner company.</p><p style="margin:0 0 28px;"><a href="${actionLink}" style="display:inline-block;background:#1479e8;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;padding:13px 22px;border-radius:9px;">Finish My B.O.S. Account</a></p><div style="border-top:1px solid #e3e9f1;padding-top:20px;font-size:12px;line-height:1.6;color:#738096;">For security, do not forward this invitation. If you were not expecting access to B.O.S., you can ignore this email.</div></td></tr></table></td></tr></table></body></html>` }), cache: "no-store" });
  if (response.ok) return; const raw = await response.text(); let providerError: unknown = raw; try { providerError = raw ? JSON.parse(raw) : null; } catch {} throw new Error(`Resend rejected the Trade Partner invitation: ${readableError(providerError, `HTTP ${response.status}`)}`);
}
export async function POST(request: NextRequest) {
  const supabase = await createClient(); if (!supabase) return NextResponse.json({ error: "B.O.S. authentication is unavailable." }, { status: 503 });
  let membership; try { membership = await requireCompanyAdmin(supabase); } catch { return NextResponse.json({ error: "Only a company owner or administrator can invite Trade Partners." }, { status: 403 }); }
  let body: InviteBody; try { body = (await request.json()) as InviteBody; } catch { return NextResponse.json({ error: "Invalid invite request." }, { status: 400 }); }
  const vendorId = body.vendorId?.trim() || ""; const email = body.email?.trim().toLowerCase() || ""; const firstName = body.firstName?.trim() || ""; const lastName = body.lastName?.trim() || "";
  if (!vendorId) return NextResponse.json({ error: "Select a Trade Partner." }, { status: 400 }); if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  const { data: vendor, error: vendorError } = await supabase.from("vendors").select("id,display_name,company_name").eq("company_id", membership.company_id).eq("id", vendorId).maybeSingle();
  if (vendorError) return NextResponse.json({ error: readableError(vendorError, "Unable to load the selected Trade Partner.") }, { status: 500 }); if (!vendor) return NextResponse.json({ error: "Trade Partner was not found in this company." }, { status: 404 });
  let admin; try { admin = createAdminClient(); } catch { return NextResponse.json({ error: "Trade Partner invitations are not configured on this B.O.S. environment." }, { status: 503 }); }
  const vendorName = vendor.display_name || vendor.company_name || "Trade Partner";
  const { data: existingLinks, error: existingLinkError } = await admin.from("company_memberships").select("id,user_id,status").eq("company_id", membership.company_id).eq("vendor_id" as never, vendorId as never).eq("role", "subcontractor").eq("status", "active").limit(1);
  if (existingLinkError) return NextResponse.json({ error: readableError(existingLinkError, "Unable to verify existing Trade Partner access.") }, { status: 500 });
  const existingLink = existingLinks?.[0];
  if (existingLink) {
    const { data: existingUserData, error: existingUserError } = await admin.auth.admin.getUserById(existingLink.user_id); const existingUser = existingUserData?.user;
    if (existingUserError || !existingUser) return NextResponse.json({ error: "The linked Trade Partner login could not be loaded. Manage it from Access Control." }, { status: 409 });
    if ((existingUser.email || "").toLowerCase() !== email) return NextResponse.json({ error: "This Trade Partner is already linked to a different B.O.S. login. Manage it from Access Control." }, { status: 409 });
    const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({ type: "recovery", email }); const tokenHash = recoveryData.properties?.hashed_token;
    if (recoveryError || !tokenHash) return NextResponse.json({ error: readableError(recoveryError, "Unable to create a fresh Trade Partner setup link.") }, { status: 400 });
    try { await sendTradePartnerInviteEmail({ actionLink: buildConfirmationLink(request, tokenHash, "recovery"), email, firstName, vendorName, userId: existingUser.id, deliveryId: Date.now().toString(36) }); } catch (error) { return NextResponse.json({ error: readableError(error, "Unable to deliver the Trade Partner invitation email.") }, { status: 502 }); }
    return NextResponse.json({ ok: true, message: `A fresh setup link was sent to ${email}.`, vendorId, userId: existingUser.id, resent: true });
  }
  const metadata = { first_name: firstName || null, last_name: lastName || null, bos_role: "subcontractor", bos_vendor_id: vendorId, bos_company_id: membership.company_id, bos_vendor_name: vendorName };
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: metadata } }); const invitedUser = linkData.user; const tokenHash = linkData.properties?.hashed_token;
  if (linkError || !invitedUser || !tokenHash) { const message = readableError(linkError, "Unable to generate a secure Trade Partner invitation link."); return NextResponse.json({ error: /already|registered|exists/i.test(message) ? "That email already has a B.O.S. account. Use Access Control to link an existing account." : message }, { status: 400 }); }
  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const { error: profileError } = await admin.from("profiles").upsert({ id: invitedUser.id, company_id: membership.company_id, role: "subcontractor", first_name: firstName || null, last_name: lastName || null }, { onConflict: "id" }); if (profileError) { await rollbackInvitedUser(admin, membership.company_id, invitedUser.id); return NextResponse.json({ error: `Unable to create the Trade Partner profile: ${readableError(profileError, "database write failed")}` }, { status: 500 }); }
  const { error: userProfileError } = await admin.from("user_profiles").upsert({ id: invitedUser.id, user_id: invitedUser.id, company_id: membership.company_id, role: "subcontractor", first_name: firstName || null, last_name: lastName || null, display_name: displayName }, { onConflict: "id" }); if (userProfileError) { await rollbackInvitedUser(admin, membership.company_id, invitedUser.id); return NextResponse.json({ error: `Unable to create the Trade Partner user profile: ${readableError(userProfileError, "database write failed")}` }, { status: 500 }); }
  const { error: membershipError } = await admin.from("company_memberships").upsert({ company_id: membership.company_id, user_id: invitedUser.id, role: "subcontractor", status: "active", is_primary: true, vendor_id: vendorId, department: "Trade Partner", joined_at: new Date().toISOString() } as never, { onConflict: "company_id,user_id" }); if (membershipError) { await rollbackInvitedUser(admin, membership.company_id, invitedUser.id); return NextResponse.json({ error: `Unable to link the Trade Partner membership: ${readableError(membershipError, "database write failed")}` }, { status: 500 }); }
  try { await sendTradePartnerInviteEmail({ actionLink: buildConfirmationLink(request, tokenHash, "invite"), email, firstName, vendorName, userId: invitedUser.id, deliveryId: Date.now().toString(36) }); } catch (error) { await rollbackInvitedUser(admin, membership.company_id, invitedUser.id); return NextResponse.json({ error: readableError(error, "Unable to deliver the Trade Partner invitation email.") }, { status: 502 }); }
  return NextResponse.json({ ok: true, message: `Invitation sent to ${email}.`, vendorId, userId: invitedUser.id });
}
