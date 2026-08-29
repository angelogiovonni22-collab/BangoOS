import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "subcontractor-compliance";

type TradePartnerMembership = {
  company_id: string;
  vendor_id: string | null;
  role: string;
  status: string;
};

type CompletedVendor = {
  id: string;
  vendor_code: string | null;
  display_name: string | null;
  company_name: string | null;
  status: string;
  onboarding_completed_at: string | null;
};

async function getPartnerContext() {
  const supabase = await createClient();
  if (!supabase) throw new Error("B.O.S. authentication is unavailable.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to continue.");

  const admin = createAdminClient();
  const { data: membershipRow, error: membershipError } = await admin
    .from("company_memberships" as never)
    .select("company_id,vendor_id,role,status")
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("role", "subcontractor")
    .not("vendor_id", "is", null)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) throw new Error(membershipError.message);
  const membership = membershipRow as unknown as TradePartnerMembership | null;
  if (!membership?.vendor_id) throw new Error("This Trade Partner login is not linked to a company profile yet.");
  return { admin, user, companyId: membership.company_id, vendorId: membership.vendor_id };
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function cleanInteger(value: unknown, minimum = 0) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum) throw new Error("Enter a valid whole number.");
  return parsed;
}

async function completeInvitationAndNotify(input: {
  admin: ReturnType<typeof createAdminClient>;
  companyId: string;
  vendorId: string;
  actorUserId: string;
  partnerName: string;
}) {
  const now = new Date().toISOString();
  await input.admin
    .from("trade_partner_invitations" as never)
    .update({ status: "completed", completed_at: now, updated_at: now } as never)
    .eq("company_id", input.companyId)
    .eq("vendor_id", input.vendorId)
    .in("status", ["sent", "opened", "claimed"]);

  const { data: memberships, error: membershipError } = await input.admin
    .from("company_memberships")
    .select("user_id,role,status")
    .eq("company_id", input.companyId)
    .eq("status", "active");
  if (membershipError) return;

  const recipients = (memberships || []).filter((membership) => ["owner", "administrator"].includes((membership.role || "").toLowerCase()));
  const sourceKey = `trade-partner-onboarding-complete:${input.vendorId}`;

  for (const recipient of recipients) {
    const { data: existingRow } = await input.admin
      .from("bos_notifications" as never)
      .select("id")
      .eq("company_id", input.companyId)
      .eq("recipient_user_id", recipient.user_id)
      .eq("source_key", sourceKey)
      .maybeSingle();
    const existing = existingRow as unknown as { id: string } | null;
    if (existing?.id) continue;

    await input.admin.from("bos_notifications" as never).insert({
      company_id: input.companyId,
      recipient_user_id: recipient.user_id,
      actor_user_id: input.actorUserId,
      category: "operations",
      severity: "success",
      title: "New Trade Partner Added",
      message: `${input.partnerName} completed Trade Partner onboarding and is ready for review.`,
      entity_type: "vendor",
      entity_id: input.vendorId,
      linked_href: `/vendors/${input.vendorId}`,
      source_module: "trade_partners",
      source_key: sourceKey,
      requested_channels: ["in_app"],
      delivery_state: "ready",
      in_app_status: "ready",
      push_status: "not_requested",
      email_status: "not_requested",
      delivery_metadata: { event: "trade_partner_onboarding_completed" },
    } as never);
  }
}

export async function GET() {
  try {
    const { admin, companyId, vendorId } = await getPartnerContext();
    const [{ data: vendor, error: vendorError }, { data: documents, error: documentError }] = await Promise.all([
      admin.from("vendors" as never).select("id,vendor_code,company_name,display_name,email,phone,mobile,website,billing_address,city,state,postal_code,first_name,last_name,primary_trade,market_type,years_in_business,crew_size,service_area,contractor_license,insurance_provider,insurance_expires_at,onboarding_completed_at,status").eq("company_id", companyId).eq("id", vendorId).single(),
      admin.from("trade_partner_onboarding_documents" as never).select("id,requirement_type,original_filename,mime_type,file_size_bytes,expires_at,status,storage_path,created_at").eq("company_id", companyId).eq("vendor_id", vendorId).eq("status", "active").order("created_at", { ascending: false }),
    ]);
    if (vendorError || !vendor) throw new Error(vendorError?.message || "Trade Partner profile not found.");
    if (documentError) throw new Error(documentError.message);

    const signedDocuments = await Promise.all(((documents || []) as Array<Record<string, unknown>>).map(async (row) => {
      const { data: signed } = await admin.storage.from(BUCKET).createSignedUrl(String(row.storage_path), 60 * 10);
      return {
        id: row.id,
        requirementType: row.requirement_type,
        originalFilename: row.original_filename,
        mimeType: row.mime_type,
        fileSizeBytes: row.file_size_bytes,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        viewUrl: signed?.signedUrl || null,
      };
    }));

    return NextResponse.json({ vendor, documents: signedDocuments });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Trade Partner onboarding." }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const { admin, user, companyId, vendorId } = await getPartnerContext();
    const body = await request.json() as Record<string, unknown>;
    const marketType = cleanString(body.marketType);
    if (marketType && !["residential", "commercial", "both"].includes(marketType)) throw new Error("Choose a valid work type.");

    const firstName = cleanString(body.firstName);
    const lastName = cleanString(body.lastName);
    const companyName = cleanString(body.companyName);
    const displayName = cleanString(body.displayName) || companyName;
    const email = cleanString(body.email)?.toLowerCase() || null;
    const phone = cleanString(body.phone);
    const primaryTrade = cleanString(body.primaryTrade);
    const complete = body.complete === true;
    if (!companyName) throw new Error("Company name is required.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid business email.");
    if (!primaryTrade) throw new Error("Primary trade is required.");

    const completedAt = complete ? new Date().toISOString() : null;
    const payload = {
      company_name: companyName,
      display_name: displayName || companyName,
      email,
      phone,
      mobile: cleanString(body.mobile),
      website: cleanString(body.website),
      billing_address: cleanString(body.streetAddress),
      city: cleanString(body.city),
      state: cleanString(body.state),
      postal_code: cleanString(body.postalCode),
      first_name: firstName,
      last_name: lastName,
      primary_trade: primaryTrade,
      market_type: marketType,
      years_in_business: cleanInteger(body.yearsInBusiness, 0),
      crew_size: cleanInteger(body.crewSize, 1),
      service_area: cleanString(body.serviceArea),
      contractor_license: cleanString(body.contractorLicense),
      insurance_provider: cleanString(body.insuranceProvider),
      insurance_expires_at: cleanString(body.insuranceExpiresAt),
      onboarding_completed_at: completedAt,
      ...(complete ? { status: "active" } : {}),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: vendorRow, error } = await admin
      .from("vendors" as never)
      .update(payload as never)
      .eq("company_id", companyId)
      .eq("id", vendorId)
      .select("id,vendor_code,display_name,company_name,status,onboarding_completed_at")
      .single();
    const vendor = vendorRow as unknown as CompletedVendor | null;
    if (error || !vendor) throw new Error(error?.message || "Unable to update Trade Partner profile.");

    const display = [firstName, lastName].filter(Boolean).join(" ") || null;
    await admin.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", user.id).eq("company_id", companyId);
    await admin.from("user_profiles").update({ first_name: firstName, last_name: lastName, display_name: display, phone }).eq("id", user.id);

    if (complete) {
      await completeInvitationAndNotify({
        admin,
        companyId,
        vendorId,
        actorUserId: user.id,
        partnerName: vendor.display_name || vendor.company_name || "A Trade Partner",
      });
    }

    return NextResponse.json({ ok: true, vendor });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Trade Partner onboarding." }, { status: 400 });
  }
}
