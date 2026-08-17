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

  if (vendorError) return NextResponse.json({ error: vendorError.message }, { status: 500 });
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

  if (existingLinkError) return NextResponse.json({ error: existingLinkError.message }, { status: 500 });
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
    const message = inviteError?.message || "Unable to create the Trade Partner invitation.";
    return NextResponse.json({ error: message.includes("already") ? "That email already has a B.O.S. account. Use Access Control to link an existing account." : message }, { status: 400 });
  }

  try {
    const displayName = [firstName, lastName].filter(Boolean).join(" ") || null;

    const { error: profileError } = await admin.from("profiles").upsert({
      id: invitedUser.id,
      company_id: membership.company_id,
      role: "subcontractor",
      first_name: firstName || null,
      last_name: lastName || null,
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { error: userProfileError } = await admin.from("user_profiles").upsert({
      id: invitedUser.id,
      user_id: invitedUser.id,
      first_name: firstName || null,
      last_name: lastName || null,
      display_name: displayName,
    }, { onConflict: "id" });
    if (userProfileError) throw userProfileError;

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
    if (membershipError) throw membershipError;
  } catch (error) {
    await admin.auth.admin.deleteUser(invitedUser.id).catch(() => undefined);
    const message = error instanceof Error ? error.message : "Unable to link the invited account to this Trade Partner.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: `Invitation sent to ${email}.`,
    vendorId,
    userId: invitedUser.id,
  });
}