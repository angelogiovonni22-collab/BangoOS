import { NextResponse } from "next/server";
import type { BosPermission } from "@/lib/access-control/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";
import { createClient } from "@/lib/supabase/server";

const REVIEWER_PERMISSION_OVERRIDES: Partial<Record<BosPermission, boolean>> = {
  "dashboard.view": false,
  "operations.view": false,
  "field_operations.view": false,
  "projects.view": true,
  "projects.manage": false,
  "project_financials.view": false,
  "schedule.view": true,
  "schedule.manage": false,
  "daily_reports.view": true,
  "daily_reports.manage": false,
  "blueprints.view": true,
  "blueprints.manage": false,
  "photos.view": true,
  "photos.manage": false,
  "communications.view": false,
  "communications.manage": false,
  "scope.view": true,
  "customers.view": false,
  "customers.manage": false,
  "estimates.view": false,
  "estimates.manage": false,
  "invoices.view": false,
  "invoices.manage": false,
  "change_orders.view": false,
  "change_orders.manage": false,
  "labor_rates.view": false,
  "labor_rates.manage": false,
  "workforce.view": false,
  "workforce.manage": false,
  "equipment.view": true,
  "equipment.manage": false,
  "materials.view": false,
  "materials.manage": false,
  "vendors.view": false,
  "vendors.manage": false,
  "settings.view": false,
  "settings.manage": false,
  "access_control.manage": false,
  "orion.use": false,
  "subcontractor_portal.view": false,
  "customer_portal.view": false,
};

const REVIEWER_SAFE_EXISTING_ROLES = new Set(["employee"]);

type InviteBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
};

function normalizeEmail(value: string | undefined) {
  return (value || "").trim().toLowerCase();
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const companyAdmin = await requireCompanyAdmin(supabase);
    const body = await request.json() as InviteBody;
    const email = normalizeEmail(body.email);
    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid reviewer email address." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: existingUsers, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listError) throw listError;

    let user = existingUsers.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    let invitationSent = false;

    if (!user) {
      const origin = new URL(request.url).origin;
      const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${origin}/auth/callback?next=/projects`,
        data: {
          first_name: body.firstName?.trim() || undefined,
          last_name: body.lastName?.trim() || undefined,
          bos_access_purpose: "reviewer",
        },
      });
      if (error) throw error;
      user = data.user;
      invitationSent = true;
    }

    if (!user) throw new Error("Unable to resolve the reviewer account.");

    const { data: existingMembership, error: membershipLookupError } = await admin
      .from("company_memberships")
      .select("id,role,status")
      .eq("company_id", companyAdmin.company_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipLookupError) throw membershipLookupError;

    if (existingMembership && !REVIEWER_SAFE_EXISTING_ROLES.has(existingMembership.role)) {
      return NextResponse.json(
        { error: "That email already belongs to a B.O.S. company member with a different role. Reviewer setup will not downgrade existing access." },
        { status: 409 },
      );
    }

    const membershipPayload = {
      company_id: companyAdmin.company_id,
      user_id: user.id,
      role: "employee",
      status: "active",
      is_primary: false,
      department: "Reviewer",
      vendor_id: null,
      customer_id: null,
      permission_overrides: REVIEWER_PERMISSION_OVERRIDES,
      updated_at: new Date().toISOString(),
    };

    const membershipResult = existingMembership
      ? await admin.from("company_memberships").update(membershipPayload as never).eq("id", existingMembership.id)
      : await admin.from("company_memberships").insert(membershipPayload as never);
    if (membershipResult.error) throw membershipResult.error;

    return NextResponse.json({
      invited: invitationSent,
      existingUser: !invitationSent,
      email,
      message: invitationSent
        ? "Reviewer invitation sent. Access is read-only and excludes sensitive company areas."
        : "Reviewer access was attached to the existing B.O.S. account. No duplicate invitation was sent.",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create reviewer access." },
      { status: 403 },
    );
  }
}
