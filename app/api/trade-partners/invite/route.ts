import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireCompanyAdmin } from "@/lib/supabase/authorization";

type InviteBody = {
  vendorId?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
};

function readableError(value: unknown, fallback: string): string {
  if (typeof value === "string") {
    const normalized = value.trim();
    if (normalized && normalized !== "{}" && normalized !== "[object Object]") return normalized;
    return fallback;
  }
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const key of ["message", "error_description", "error", "msg", "detail", "details", "description", "code"]) {
      const nested = readableError(record[key], "");
      if (nested) return nested;
    }
  }
  return fallback;
}

async function rollbackInvitedUser(admin: ReturnType<typeof createAdminClient>, userId: string) {
  await admin.auth.admin.deleteUser(userId).catch(() => undefined);
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
    return NextResponse.json({ error: "Invalid invite request." }, { status: 400 });
  }

  const vendorId = body.vendorId?.trim() || "";
  const email = body.email?.trim().toLowerCase() || "";
  const firstName = body.firstName?.trim() || "";
  const lastName = body.lastName?.trim() || "";

  if (!vendorId) return NextResponse.json({ error: "Select a Trade Partner." }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const { data: vendor, error: vendorError } = await supabase
    .from("vendors")
    .select("id,display_name,company_name")
    .eq("company_id", membership.company_id)
    .eq("id", vendorId)
    .maybeSingle();

  if (vendorError) return NextResponse.json({ error: readableError(vendorError, "Unable to load the selected Trade Partner.") }, { status: 500 });
  if (!vendor) return NextResponse.json({ error: "Trade Partner was not found in this company." }, { status: 404 });

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return NextResponse.json({ error: "Trade Partner invitations are not configured on this B.O.S. environment." }, { status: 503 });
  }

  const { data: existingLinks, error: existingLinkError } = await admin
    .from("company_memberships")
    .select("id,user_id,status")
    .eq("company_id", membership.company_id)
    .eq("vendor_id" as never, vendorId as never)
    .eq("role", "subcontractor")
    .eq("status", "active")
    .limit(1);

  if (existingLinkError) return NextResponse.json({ error: readableError(existingLinkError, "Unable to verify existing Trade Partner access.") }, { status: 500 });
  if ((existingLinks ?? []).length > 0) {
    return NextResponse.json({ error: "This Trade Partner already has an active B.O.S. login. Manage it from Access Control." }, { status: 409 });
  }

  const redirectTo = new URL("/partner/welcome", request.url).toString();
  const vendorName = vendor.display_name || vendor.company_name || "Trade Partner";
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo,
    data: {
      first_name: firstName || null,
      last_name: lastName || null,
      bos_role: "subcontractor",
      bos_vendor_id: vendorId,
      bos_company_id: membership.company_id,
      bos_vendor_name: vendorName,
    },
  });

  const invitedUser = inviteData.user;
  if (inviteError || !invitedUser) {
    const message = readableError(inviteError, "The authentication email provider rejected the Trade Partner invitation. Verify the custom SMTP sender and Resend configuration, then try again.");
    return NextResponse.json({ error: /already/i.test(message) ? "That email already has a B.O.S. account. Use Access Control to link an existing account." : message }, { status: 400 });
  }

  const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;

  const { error: profileError } = await admin.from("profiles").upsert({
    id: invitedUser.id,
    company_id: membership.company_id,
    role: "subcontractor",
    first_name: firstName || null,
    last_name: lastName || null,
  }, { onConflict: "id" });

  if (profileError) {
    await rollbackInvitedUser(admin, invitedUser.id);
    return NextResponse.json({ error: `Unable to create the Trade Partner profile: ${readableError(profileError, "database write failed")}` }, { status: 500 });
  }

  const { error: userProfileError } = await admin.from("user_profiles").upsert({
    id: invitedUser.id,
    user_id: invitedUser.id,
    company_id: membership.company_id,
    role: "subcontractor",
    first_name: firstName || null,
    last_name: lastName || null,
    display_name: displayName,
  }, { onConflict: "id" });

  if (userProfileError) {
    await rollbackInvitedUser(admin, invitedUser.id);
    return NextResponse.json({ error: `Unable to create the Trade Partner user profile: ${readableError(userProfileError, "database write failed")}` }, { status: 500 });
  }

  const { error: membershipError } = await admin.from("company_memberships").upsert({
    company_id: membership.company_id,
    user_id: invitedUser.id,
    role: "subcontractor",
    status: "active",
    is_primary: true,
    vendor_id: vendorId,
    department: "Trade Partner",
    joined_at: new Date().toISOString(),
  } as never, { onConflict: "company_id,user_id" });

  if (membershipError) {
    await rollbackInvitedUser(admin, invitedUser.id);
    return NextResponse.json({ error: `Unable to link the Trade Partner membership: ${readableError(membershipError, "database write failed")}` }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Invitation sent to ${email}.`,
    vendorId,
    userId: invitedUser.id,
  });
}
