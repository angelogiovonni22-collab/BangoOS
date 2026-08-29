import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";
import {
  buildTradePartnerIntakeLink,
  createTradePartnerInviteToken,
  isValidInviteEmail,
  normalizeInviteEmail,
  normalizeInvitePhone,
  readableInviteError,
  sendTradePartnerEmail,
  sendTradePartnerSms,
  type InviteDeliveryResult,
} from "@/lib/trade-partners/invitations";

type InviteBody = {
  vendorId?: string;
  email?: string;
  phone?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
};

type VendorSummary = {
  id: string;
  vendor_code: string;
  display_name: string;
  company_name: string;
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function pendingTradePartnerName(input: {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}) {
  return input.companyName
    || [input.firstName, input.lastName].filter(Boolean).join(" ")
    || input.email
    || input.phone
    || "Pending Trade Partner";
}

async function nextTradePartnerCode(admin: ReturnType<typeof createAdminClient>, companyId: string) {
  const { data, error } = await admin
    .from("vendors")
    .select("vendor_code")
    .eq("company_id", companyId)
    .like("vendor_code", "TP-%")
    .limit(1000);
  if (error) throw new Error(readableInviteError(error, "Unable to allocate a Trade Partner number."));

  let highest = 0;
  for (const row of data || []) {
    const match = /^TP-(\d+)$/i.exec(row.vendor_code || "");
    if (!match) continue;
    highest = Math.max(highest, Number(match[1]) || 0);
  }
  return `TP-${String(highest + 1).padStart(6, "0")}`;
}

async function createPendingVendor(
  admin: ReturnType<typeof createAdminClient>,
  input: {
    companyId: string;
    userId: string;
    companyName: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  },
) {
  const displayName = pendingTradePartnerName(input);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const vendorCode = await nextTradePartnerCode(admin, input.companyId);
    const { data, error } = await admin
      .from("vendors")
      .insert({
        company_id: input.companyId,
        vendor_code: vendorCode,
        company_name: input.companyName || displayName,
        display_name: displayName,
        status: "probation",
        preferred_vendor: false,
        website: null,
        tax_id: null,
        account_number: null,
        payment_terms: null,
        credit_limit: null,
        billing_address: null,
        shipping_address: null,
        city: null,
        state: null,
        postal_code: null,
        country: "US",
        first_name: input.firstName || null,
        last_name: input.lastName || null,
        title: null,
        email: input.email || null,
        phone: input.phone || null,
        mobile: input.phone || null,
        quality_rating: null,
        delivery_rating: null,
        notes: null,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select("id,vendor_code,display_name,company_name")
      .single();

    if (!error && data) return data as VendorSummary;
    if (error?.code === "23505") continue;
    throw new Error(readableInviteError(error, "Unable to create the pending Trade Partner record."));
  }

  throw new Error("Unable to allocate a unique Trade Partner number. Please try again.");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. authentication is unavailable." }, { status: 503 });

  let membership;
  try {
    membership = await requireCompanyAdmin(supabase);
  } catch {
    return NextResponse.json({ error: "Only a company owner or administrator can invite Trade Partners." }, { status: 403 });
  }

  let body: InviteBody;
  try {
    body = (await request.json()) as InviteBody;
  } catch {
    return NextResponse.json({ error: "Invalid Trade Partner invitation request." }, { status: 400 });
  }

  const vendorId = clean(body.vendorId);
  const email = normalizeInviteEmail(body.email);
  const phoneInput = clean(body.phone);
  const phone = normalizeInvitePhone(phoneInput);
  const firstName = clean(body.firstName);
  const lastName = clean(body.lastName);
  const companyName = clean(body.companyName);

  if (!email && !phoneInput) {
    return NextResponse.json({ error: "Enter an email address, mobile phone number, or both." }, { status: 400 });
  }
  if (email && !isValidInviteEmail(email)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }
  if (phoneInput && !phone) {
    return NextResponse.json({ error: "Enter a valid mobile phone number including area code." }, { status: 400 });
  }

  let admin: ReturnType<typeof createAdminClient>;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Trade Partner invitations are not configured on this B.O.S. environment." }, { status: 503 });
  }

  let vendor: VendorSummary | null = null;
  let createdPendingVendor = false;

  try {
    if (vendorId) {
      const { data, error } = await admin
        .from("vendors")
        .select("id,vendor_code,display_name,company_name")
        .eq("company_id", membership.company_id)
        .eq("id", vendorId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return NextResponse.json({ error: "Trade Partner was not found in this company." }, { status: 404 });
      vendor = data as VendorSummary;

      await admin
        .from("vendors")
        .update({
          email: email || undefined,
          phone: phone || undefined,
          mobile: phone || undefined,
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          updated_by: membership.user_id,
          updated_at: new Date().toISOString(),
        })
        .eq("company_id", membership.company_id)
        .eq("id", vendor.id);
    } else {
      vendor = await createPendingVendor(admin, {
        companyId: membership.company_id,
        userId: membership.user_id,
        companyName,
        firstName,
        lastName,
        email,
        phone,
      });
      createdPendingVendor = true;
    }

    const { token, tokenHash } = createTradePartnerInviteToken();
    const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    const { data: invitation, error: invitationError } = await admin
      .from("trade_partner_invitations" as never)
      .insert({
        company_id: membership.company_id,
        vendor_id: vendor.id,
        token_hash: tokenHash,
        email: email || null,
        phone: phone || null,
        first_name: firstName || null,
        last_name: lastName || null,
        status: "sent",
        delivery_channels: [],
        delivery_metadata: {},
        expires_at: expiresAt,
        created_by: membership.user_id,
      } as never)
      .select("id")
      .single();

    if (invitationError || !invitation) {
      throw new Error(readableInviteError(invitationError, "Unable to create the Trade Partner invitation."));
    }

    const invitationId = String((invitation as { id: string }).id);
    const inviteLink = buildTradePartnerIntakeLink(request, token);
    const recipientName = [firstName, lastName].filter(Boolean).join(" ");
    const delivery: InviteDeliveryResult[] = [];

    if (email) {
      try {
        await sendTradePartnerEmail({
          email,
          link: inviteLink,
          recipientName,
          companyName: "your contractor",
          stage: "intake",
          idempotencyKey: `bos-trade-partner-intake-${invitationId}-email`,
        });
        delivery.push({ channel: "email", status: "sent" });
      } catch (error) {
        delivery.push({ channel: "email", status: "failed", message: readableInviteError(error, "Email delivery failed.") });
      }
    } else {
      delivery.push({ channel: "email", status: "skipped" });
    }

    if (phone) {
      try {
        await sendTradePartnerSms({ phone, link: inviteLink, stage: "intake" });
        delivery.push({ channel: "sms", status: "sent" });
      } catch (error) {
        delivery.push({ channel: "sms", status: "failed", message: readableInviteError(error, "SMS delivery failed.") });
      }
    } else {
      delivery.push({ channel: "sms", status: "skipped" });
    }

    const sentChannels = delivery.filter((item) => item.status === "sent").map((item) => item.channel);
    if (sentChannels.length === 0) {
      await admin.from("trade_partner_invitations" as never).delete().eq("id", invitationId);
      if (createdPendingVendor) await admin.from("vendors").delete().eq("company_id", membership.company_id).eq("id", vendor.id);
      const failed = delivery.find((item) => item.status === "failed");
      return NextResponse.json({ error: failed?.message || "Unable to deliver the Trade Partner invitation." }, { status: 502 });
    }

    await admin
      .from("trade_partner_invitations" as never)
      .update({
        delivery_channels: sentChannels,
        delivery_metadata: { delivery },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", invitationId);

    const failedChannels = delivery.filter((item) => item.status === "failed");
    const warning = failedChannels.length
      ? failedChannels.map((item) => `${item.channel.toUpperCase()}: ${item.message}`).join(" ")
      : null;

    return NextResponse.json({
      ok: true,
      vendorId: vendor.id,
      vendorCode: vendor.vendor_code,
      invitationId,
      delivery,
      warning,
      message: warning
        ? `Trade Partner invitation sent by ${sentChannels.join(" and ")}. One delivery channel needs attention.`
        : `Trade Partner invitation sent by ${sentChannels.join(" and ")}.`,
    });
  } catch (error) {
    if (createdPendingVendor && vendor?.id) {
      try { await admin.from("vendors").delete().eq("company_id", membership.company_id).eq("id", vendor.id); } catch {}
    }
    return NextResponse.json({ error: readableInviteError(error, "Unable to invite the Trade Partner.") }, { status: 500 });
  }
}
