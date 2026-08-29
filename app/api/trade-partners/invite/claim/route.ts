import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTradePartnerActivationLink,
  hashTradePartnerInviteToken,
  isValidInviteEmail,
  normalizeInviteEmail,
  readableInviteError,
  sendTradePartnerEmail,
  sendTradePartnerSms,
  type InviteDeliveryResult,
} from "@/lib/trade-partners/invitations";

type InvitationRow = {
  id: string;
  company_id: string;
  vendor_id: string;
  user_id: string | null;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  status: string;
  expires_at: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

async function loadInvitation(admin: ReturnType<typeof createAdminClient>, token: string) {
  if (!token || token.length < 20) return null;
  const tokenHash = hashTradePartnerInviteToken(token);
  const { data, error } = await admin
    .from("trade_partner_invitations" as never)
    .select("id,company_id,vendor_id,user_id,email,phone,first_name,last_name,status,expires_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (error) throw new Error(readableInviteError(error, "Unable to verify the Trade Partner invitation."));
  return data as unknown as InvitationRow | null;
}

function isExpired(invitation: InvitationRow) {
  return new Date(invitation.expires_at).getTime() <= Date.now();
}

async function rollbackInvitedUser(admin: ReturnType<typeof createAdminClient>, companyId: string, userId: string) {
  try { await admin.from("company_memberships").delete().eq("company_id", companyId).eq("user_id", userId); } catch {}
  try { await admin.from("user_profiles").delete().eq("id", userId); } catch {}
  try { await admin.from("profiles").delete().eq("id", userId); } catch {}
  try { await admin.auth.admin.deleteUser(userId); } catch {}
}

export async function GET(request: NextRequest) {
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch {
    return NextResponse.json({ error: "Trade Partner invitations are unavailable." }, { status: 503 });
  }

  try {
    const token = request.nextUrl.searchParams.get("token")?.trim() || "";
    const invitation = await loadInvitation(admin, token);
    if (!invitation) return NextResponse.json({ error: "This Trade Partner invitation is invalid." }, { status: 404 });
    if (["cancelled", "completed"].includes(invitation.status)) {
      return NextResponse.json({ error: invitation.status === "completed" ? "This Trade Partner onboarding is already complete." : "This invitation is no longer active." }, { status: 410 });
    }
    if (isExpired(invitation)) {
      await admin.from("trade_partner_invitations" as never).update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("id", invitation.id);
      return NextResponse.json({ error: "This Trade Partner invitation has expired. Ask the contractor to send a new invitation." }, { status: 410 });
    }

    const { data: vendor } = await admin
      .from("vendors")
      .select("display_name,company_name,vendor_code")
      .eq("company_id", invitation.company_id)
      .eq("id", invitation.vendor_id)
      .maybeSingle();

    if (invitation.status === "sent") {
      await admin.from("trade_partner_invitations" as never).update({ status: "opened", opened_at: new Date().toISOString(), updated_at: new Date().toISOString() } as never).eq("id", invitation.id);
    }

    return NextResponse.json({
      ok: true,
      invitation: {
        email: invitation.email,
        phone: invitation.phone,
        firstName: invitation.first_name,
        lastName: invitation.last_name,
        expiresAt: invitation.expires_at,
      },
      tradePartner: {
        displayName: vendor?.display_name || vendor?.company_name || "Trade Partner",
        vendorCode: vendor?.vendor_code || null,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: readableInviteError(error, "Unable to verify the Trade Partner invitation.") }, { status: 400 });
  }
}

export async function POST(request: NextRequest) {
  let admin: ReturnType<typeof createAdminClient>;
  try { admin = createAdminClient(); } catch {
    return NextResponse.json({ error: "Trade Partner invitations are unavailable." }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; } catch {
    return NextResponse.json({ error: "Invalid invitation request." }, { status: 400 });
  }

  const token = clean(body.token);
  const email = normalizeInviteEmail(body.email);
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  if (!email || !isValidInviteEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address to create your secure B.O.S. account." }, { status: 400 });
  }

  try {
    const invitation = await loadInvitation(admin, token);
    if (!invitation) return NextResponse.json({ error: "This Trade Partner invitation is invalid." }, { status: 404 });
    if (["cancelled", "completed"].includes(invitation.status)) {
      return NextResponse.json({ error: invitation.status === "completed" ? "This Trade Partner onboarding is already complete." : "This invitation is no longer active." }, { status: 410 });
    }
    if (isExpired(invitation)) {
      await admin.from("trade_partner_invitations" as never).update({ status: "expired", updated_at: new Date().toISOString() } as never).eq("id", invitation.id);
      return NextResponse.json({ error: "This Trade Partner invitation has expired. Ask the contractor to send a new invitation." }, { status: 410 });
    }

    const resolvedFirstName = firstName || invitation.first_name || "";
    const resolvedLastName = lastName || invitation.last_name || "";
    const { data: vendor, error: vendorError } = await admin
      .from("vendors")
      .update({
        email,
        first_name: resolvedFirstName || null,
        last_name: resolvedLastName || null,
        updated_at: new Date().toISOString(),
      })
      .eq("company_id", invitation.company_id)
      .eq("id", invitation.vendor_id)
      .select("id,display_name,company_name")
      .single();
    if (vendorError || !vendor) throw new Error(readableInviteError(vendorError, "Unable to update the Trade Partner record."));

    const vendorName = vendor.display_name || vendor.company_name || "Trade Partner";
    const recipientName = [resolvedFirstName, resolvedLastName].filter(Boolean).join(" ");
    const { data: existingLinks, error: existingLinkError } = await admin
      .from("company_memberships")
      .select("id,user_id,status")
      .eq("company_id", invitation.company_id)
      .eq("vendor_id" as never, invitation.vendor_id as never)
      .eq("role", "subcontractor")
      .eq("status", "active")
      .limit(1);
    if (existingLinkError) throw new Error(readableInviteError(existingLinkError, "Unable to verify existing Trade Partner access."));

    let userId = "";
    let activationLink = "";
    let activationType: "invite" | "recovery" = "invite";
    let createdUser = false;
    const existingLink = existingLinks?.[0];

    if (existingLink) {
      const { data: existingUserData, error: existingUserError } = await admin.auth.admin.getUserById(existingLink.user_id);
      const existingUser = existingUserData?.user;
      if (existingUserError || !existingUser) throw new Error("The linked Trade Partner login could not be loaded. Ask the contractor to manage it from Access Control.");
      if ((existingUser.email || "").toLowerCase() !== email) {
        return NextResponse.json({ error: "This Trade Partner is already linked to a different B.O.S. login. Ask the contractor to manage it from Access Control." }, { status: 409 });
      }
      const { data: recoveryData, error: recoveryError } = await admin.auth.admin.generateLink({ type: "recovery", email });
      const tokenHash = recoveryData.properties?.hashed_token;
      if (recoveryError || !tokenHash) throw new Error(readableInviteError(recoveryError, "Unable to create a fresh B.O.S. account setup link."));
      userId = existingUser.id;
      activationType = "recovery";
      activationLink = buildTradePartnerActivationLink(request, tokenHash, activationType);
    } else {
      const metadata = {
        first_name: resolvedFirstName || null,
        last_name: resolvedLastName || null,
        bos_role: "subcontractor",
        bos_vendor_id: invitation.vendor_id,
        bos_company_id: invitation.company_id,
        bos_vendor_name: vendorName,
      };
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: metadata } });
      const invitedUser = linkData.user;
      const tokenHash = linkData.properties?.hashed_token;
      if (linkError || !invitedUser || !tokenHash) {
        const message = readableInviteError(linkError, "Unable to generate a secure B.O.S. account invitation.");
        return NextResponse.json({ error: /already|registered|exists/i.test(message) ? "That email already has a B.O.S. account. Ask the contractor to link the existing account from Access Control." : message }, { status: 400 });
      }
      userId = invitedUser.id;
      createdUser = true;
      activationLink = buildTradePartnerActivationLink(request, tokenHash, "invite");

      const displayName = recipientName || null;
      const { error: profileError } = await admin.from("profiles").upsert({
        id: userId,
        company_id: invitation.company_id,
        role: "subcontractor",
        first_name: resolvedFirstName || null,
        last_name: resolvedLastName || null,
      }, { onConflict: "id" });
      if (profileError) {
        await rollbackInvitedUser(admin, invitation.company_id, userId);
        throw new Error(`Unable to create the Trade Partner profile: ${readableInviteError(profileError, "database write failed")}`);
      }

      const { error: userProfileError } = await admin.from("user_profiles").upsert({
        id: userId,
        user_id: userId,
        company_id: invitation.company_id,
        role: "subcontractor",
        first_name: resolvedFirstName || null,
        last_name: resolvedLastName || null,
        display_name: displayName,
        phone: invitation.phone || null,
      }, { onConflict: "id" });
      if (userProfileError) {
        await rollbackInvitedUser(admin, invitation.company_id, userId);
        throw new Error(`Unable to create the Trade Partner user profile: ${readableInviteError(userProfileError, "database write failed")}`);
      }

      const { error: membershipError } = await admin.from("company_memberships").upsert({
        company_id: invitation.company_id,
        user_id: userId,
        role: "subcontractor",
        status: "active",
        is_primary: true,
        vendor_id: invitation.vendor_id,
        department: "Trade Partner",
        joined_at: new Date().toISOString(),
      } as never, { onConflict: "company_id,user_id" });
      if (membershipError) {
        await rollbackInvitedUser(admin, invitation.company_id, userId);
        throw new Error(`Unable to link the Trade Partner membership: ${readableInviteError(membershipError, "database write failed")}`);
      }
    }

    const delivery: InviteDeliveryResult[] = [];
    try {
      await sendTradePartnerEmail({
        email,
        link: activationLink,
        recipientName,
        companyName: vendorName,
        stage: "activation",
        idempotencyKey: `bos-trade-partner-activation-${invitation.id}-${userId}-${activationType}`,
      });
      delivery.push({ channel: "email", status: "sent" });
    } catch (error) {
      delivery.push({ channel: "email", status: "failed", message: readableInviteError(error, "Email delivery failed.") });
    }

    if (invitation.phone) {
      try {
        await sendTradePartnerSms({ phone: invitation.phone, link: activationLink, stage: "activation" });
        delivery.push({ channel: "sms", status: "sent" });
      } catch (error) {
        delivery.push({ channel: "sms", status: "failed", message: readableInviteError(error, "SMS delivery failed.") });
      }
    } else {
      delivery.push({ channel: "sms", status: "skipped" });
    }

    if (!delivery.some((item) => item.status === "sent")) {
      if (createdUser) await rollbackInvitedUser(admin, invitation.company_id, userId);
      const failure = delivery.find((item) => item.status === "failed");
      throw new Error(failure?.message || "Unable to deliver the secure B.O.S. account setup link.");
    }

    await admin
      .from("trade_partner_invitations" as never)
      .update({
        user_id: userId,
        email,
        first_name: resolvedFirstName || null,
        last_name: resolvedLastName || null,
        status: "claimed",
        claimed_at: new Date().toISOString(),
        delivery_metadata: { activationDelivery: delivery },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", invitation.id);

    const failed = delivery.filter((item) => item.status === "failed");
    return NextResponse.json({
      ok: true,
      delivery,
      warning: failed.length ? failed.map((item) => `${item.channel.toUpperCase()}: ${item.message}`).join(" ") : null,
      message: "Your secure B.O.S. account setup link has been sent. Open the newest message and continue to Trade Partner onboarding.",
    });
  } catch (error) {
    return NextResponse.json({ error: readableInviteError(error, "Unable to claim the Trade Partner invitation.") }, { status: 400 });
  }
}
