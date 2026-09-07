import type { SupabaseClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function deletionRequests(db: SupabaseClient) {
  return db.from("user_account_deletion_requests");
}

export async function GET() {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. is unavailable." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const { data, error } = await deletionRequests(supabase)
    .select("id,status,requested_at,processed_at")
    .eq("user_id", authData.user.id)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Unable to load deletion request status." }, { status: 500 });
  return NextResponse.json({ request: data ?? null });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: "B.O.S. is unavailable." }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const reason = typeof body?.reason === "string" ? body.reason.trim().slice(0, 1000) : null;
  const email = authData.user.email?.trim().toLowerCase() || null;

  const { data, error } = await deletionRequests(supabase)
    .insert({ user_id: authData.user.id, requested_email: email, reason: reason || null })
    .select("id,status,requested_at")
    .single();

  if (error?.code === "23505") {
    const { data: existing } = await deletionRequests(supabase)
      .select("id,status,requested_at")
      .eq("user_id", authData.user.id)
      .eq("status", "pending")
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return NextResponse.json({ request: existing ?? null, alreadyPending: true });
  }

  if (error) return NextResponse.json({ error: "Unable to submit the account deletion request." }, { status: 500 });
  return NextResponse.json({ request: data, alreadyPending: false }, { status: 201 });
}
