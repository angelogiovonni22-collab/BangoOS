import { NextResponse } from "next/server";
import { COMPANY_ROLES, isOrionConfigurableRole, type BosPermission } from "@/lib/access-control/permissions";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";
import { createClient } from "@/lib/supabase/server";

type PermissionOverrides = Partial<Record<BosPermission, boolean>>;

type UpdateBody = {
  membershipId?: string;
  role?: string;
  department?: string | null;
  vendorId?: string | null;
  customerId?: string | null;
  permissionOverrides?: PermissionOverrides;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const membership = await requireCompanyAdmin(supabase);
    if (!supabase) throw new Error("B.O.S. database is unavailable.");

    const [membersResponse, profilesResponse, vendorsResponse, customersResponse] = await Promise.all([
      supabase
        .from("company_memberships")
        .select("id,user_id,role,status,is_primary,department,vendor_id,customer_id,permission_overrides")
        .eq("company_id", membership.company_id)
        .order("created_at", { ascending: true }),
      supabase
        .from("profiles")
        .select("id,first_name,last_name")
        .eq("company_id", membership.company_id),
      supabase
        .from("vendors")
        .select("id,name")
        .eq("company_id", membership.company_id)
        .order("name"),
      supabase
        .from("customers")
        .select("id,first_name,last_name,company_name,customer_type")
        .eq("company_id", membership.company_id)
        .order("created_at", { ascending: false }),
    ]);

    const error = membersResponse.error || profilesResponse.error || vendorsResponse.error || customersResponse.error;
    if (error) throw new Error(error.message);

    return NextResponse.json({
      memberships: membersResponse.data ?? [],
      profiles: profilesResponse.data ?? [],
      vendors: vendorsResponse.data ?? [],
      customers: customersResponse.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load access control." }, { status: 403 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const adminMembership = await requireCompanyAdmin(supabase);
    if (!supabase) throw new Error("B.O.S. database is unavailable.");

    const body = await request.json() as UpdateBody;
    const membershipId = body.membershipId?.trim();
    if (!membershipId) return NextResponse.json({ error: "Membership is required." }, { status: 400 });
    if (!body.role || !COMPANY_ROLES.includes(body.role as (typeof COMPANY_ROLES)[number])) {
      return NextResponse.json({ error: "Select a valid B.O.S. role." }, { status: 400 });
    }

    const overrides = { ...(body.permissionOverrides ?? {}) };
    if (Object.values(overrides).some((value) => typeof value !== "boolean")) {
      return NextResponse.json({ error: "Permission overrides must be true or false." }, { status: 400 });
    }

    // Orion is never grantable to field, employee, Trade Partner, or customer roles.
    // Owner/Administrator access is automatic, so no per-user Orion override is stored for them either.
    if (!isOrionConfigurableRole(body.role)) {
      delete overrides["orion.use"];
    }

    const { data: target, error: targetError } = await supabase
      .from("company_memberships")
      .select("id,user_id,role")
      .eq("id", membershipId)
      .eq("company_id", adminMembership.company_id)
      .maybeSingle();
    if (targetError || !target) throw new Error("Membership not found.");

    if (target.user_id === adminMembership.user_id && target.role === "owner" && body.role !== "owner") {
      return NextResponse.json({ error: "The company owner cannot remove their own owner role." }, { status: 409 });
    }

    const update = {
      role: body.role,
      department: body.department?.trim() || null,
      vendor_id: body.role === "subcontractor" ? body.vendorId || null : null,
      customer_id: body.role === "customer" ? body.customerId || null : null,
      permission_overrides: overrides,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("company_memberships")
      .update(update as never)
      .eq("id", membershipId)
      .eq("company_id", adminMembership.company_id);
    if (error) throw new Error(error.message);

    return NextResponse.json({ updated: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update access control." }, { status: 403 });
  }
}
