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

export async function GET() {
  try {
    const { admin, companyId, vendorId } = await getPartnerContext();
    const [{ data: vendor, error: vendorError }, { data: documents, error: documentError }] = await Promise.all([
      admin.from("vendors").select("id,company_name,display_name,email,phone,mobile,website,billing_address,city,state,postal_code,first_name,last_name,primary_trade,market_type,years_in_business,crew_size,service_area,contractor_license,insurance_provider,insurance_expires_at,onboarding_completed_at").eq("company_id", companyId).eq("id", vendorId).single(),
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
    if (!companyName) throw new Error("Company name is required.");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid business email.");
    if (!primaryTrade) throw new Error("Primary trade is required.");

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
      onboarding_completed_at: body.complete === true ? new Date().toISOString() : null,
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: vendor, error } = await admin.from("vendors").update(payload as never).eq("company_id", companyId).eq("id", vendorId).select("id,display_name,onboarding_completed_at").single();
    if (error || !vendor) throw new Error(error?.message || "Unable to update Trade Partner profile.");

    const display = [firstName, lastName].filter(Boolean).join(" ") || null;
    await admin.from("profiles").update({ first_name: firstName, last_name: lastName }).eq("id", user.id).eq("company_id", companyId);
    await admin.from("user_profiles").update({ first_name: firstName, last_name: lastName, display_name: display, phone }).eq("id", user.id);

    return NextResponse.json({ ok: true, vendor });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save Trade Partner onboarding." }, { status: 400 });
  }
}
