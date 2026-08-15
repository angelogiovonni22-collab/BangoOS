import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const workspace = await resolveWorkspaceContext(supabase);
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const body = await req.json() as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown }; userAgent?: unknown };
  const endpoint = typeof body.endpoint === "string" ? body.endpoint.trim() : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh.trim() : "";
  const authKey = typeof body.keys?.auth === "string" ? body.keys.auth.trim() : "";
  if (!endpoint || !p256dh || !authKey) {
    return NextResponse.json({ ok: false, error: "Invalid push subscription." }, { status: 400 });
  }

  const { error } = await supabase.from("orion_push_subscriptions").upsert({
    company_id: workspace.context.companyId,
    user_id: workspace.context.userId,
    endpoint,
    p256dh,
    auth_key: authKey,
    user_agent: typeof body.userAgent === "string" ? body.userAgent.slice(0, 1000) : null,
    updated_at: new Date().toISOString(),
  }, { onConflict: "endpoint" });

  if (error) return NextResponse.json({ ok: false, error: "Unable to save notification subscription." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
