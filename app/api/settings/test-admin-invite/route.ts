import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";
import { createClient } from "@/lib/supabase/server";

type InviteBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

function normalizeEmail(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

function cleanName(value: string | undefined) {
  return (value || "").trim().slice(0, 120);
}

function testCompanyName(firstName: string, lastName: string) {
  const displayName = `${firstName} ${lastName}`.trim();
  return displayName ? `B.O.S. Test Company — ${displayName}` : "B.O.S. Test Company";
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const companyAdmin = await requireCompanyAdmin(supabase);
    const body = await request.json() as InviteBody;
    const email = normalizeEmail(body.email);
    const firstName = cleanName(body.firstName);
    const lastName = cleanName(body.lastName);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid test administrator email address." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;

    let user = existingUsers.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    let invitationSent = false;

    if (!user) {
      const origin = new URL(request.url).origin;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/dashboard`,
        data: {
          first_name: firstName || undefined,
          last_name: lastName || undefined,
          bos_access_purpose: "test_administrator",
        },
      });
      if (error) throw error;
      user = data.user;
      invitationSent = true;
    }

    if (!user) throw new Error("Unable to resolve the test administrator account.");

    const { data: currentMemberships, error: membershipLookupError } = await admin
      .from("company_memberships")
      .select("id,company_id,role,status,is_primary")
      .eq("user_id", user.id)
      .eq("status", "active");
    if (membershipLookupError) throw membershipLookupError;

    if ((currentMemberships || []).length > 0) {
      return NextResponse.json(
        { error: "That email already belongs to an active B.O.S. company account. Test setup will not move or replace an existing workspace." },
        { status: 409 },
      );
    }

    const companySlug = `bos-test-${user.id.replace(/-/g, "").slice(0, 12)}`;
    const companyName = testCompanyName(firstName, lastName);
    const now = new Date().toISOString();

    const { data: existingCompany, error: companyLookupError } = await admin
      .from("companies")
      .select("id,name,slug")
      .eq("slug", companySlug)
      .maybeSingle();
    if (companyLookupError) throw companyLookupError;

    let testCompanyId = existingCompany?.id || null;
    if (!testCompanyId) {
      const { data: createdCompany, error: createCompanyError } = await admin
        .from("companies")
        .insert({
          name: companyName,
          display_name: companyName,
          legal_name: companyName,
          email,
          owner_id: user.id,
          created_by: companyAdmin.user_id,
          updated_by: companyAdmin.user_id,
          business_type: "both",
          timezone: "America/New_York",
          onboarding_completed: true,
          onboarding_completed_at: now,
          status: "active",
          slug: companySlug,
        } as never)
        .select("id")
        .single<{ id: string }>();
      if (createCompanyError) throw createCompanyError;
      testCompanyId = createdCompany.id;
    } else {
      const { error: updateCompanyError } = await admin
        .from("companies")
        .update({
          name: companyName,
          display_name: companyName,
          email,
          owner_id: user.id,
          updated_by: companyAdmin.user_id,
          business_type: "both",
          onboarding_completed: true,
          onboarding_completed_at: now,
          status: "active",
        } as never)
        .eq("id", testCompanyId);
      if (updateCompanyError) throw updateCompanyError;
    }

    const { error: tenantError } = await admin
      .from("bos_tenant_accounts")
      .upsert({
        company_id: testCompanyId,
        plan_key: "starter",
        lifecycle_status: "active",
        seat_limit: 5,
        orion_text_allowance: 200,
        orion_voice_minutes: 30,
        support_tier: "standard",
        internal_notes: "Isolated B.O.S. test workspace. No billing customer or subscription should be attached.",
        updated_at: now,
      } as never, { onConflict: "company_id" });
    if (tenantError) throw tenantError;

    const { error: membershipError } = await admin
      .from("company_memberships")
      .upsert({
        company_id: testCompanyId,
        user_id: user.id,
        role: "administrator",
        status: "active",
        is_primary: true,
        department: "Test Administration",
        vendor_id: null,
        customer_id: null,
        permission_overrides: {},
        updated_at: now,
      } as never, { onConflict: "company_id,user_id" });
    if (membershipError) throw membershipError;

    const { data: existingProfile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileLookupError) throw profileLookupError;

    const profilePayload = {
      company_id: testCompanyId,
      first_name: firstName || null,
      last_name: lastName || null,
      role: "administrator",
      updated_at: now,
    };

    const profileResult = existingProfile
      ? await admin.from("profiles").update(profilePayload as never).eq("id", user.id)
      : await admin.from("profiles").insert({ id: user.id, ...profilePayload } as never);
    if (profileResult.error) throw profileResult.error;

    return NextResponse.json({
      invited: invitationSent,
      existingUser: !invitationSent,
      email,
      companyId: testCompanyId,
      companyName,
      role: "administrator",
      message: invitationSent
        ? "Test administrator invitation sent. The account is isolated in its own B.O.S. test company."
        : "Test administrator access is ready in an isolated B.O.S. test company.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create test administrator access." },
      { status: 403 },
    );
  }
}
