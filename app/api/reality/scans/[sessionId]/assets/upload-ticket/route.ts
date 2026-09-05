import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

const BUCKET = "bos-reality-captures";
const ALLOWED_KINDS = new Set(["usdz", "mesh", "thumbnail", "depth", "photo", "metadata"]);

// Reality Engine tables are migration-backed until the next generated Supabase type refresh.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedSupabase = SupabaseClient<any>;

type RouteContext = { params: Promise<{ sessionId: string }> };

async function clientForRequest(req: NextRequest): Promise<SupabaseClient<Database> | null> {
  const authorization = req.headers.get("authorization")?.trim();
  if (!authorization?.toLowerCase().startsWith("bearer ")) return createCookieClient();
  const { url, publishableKey } = getSupabaseEnv();
  if (!url || !publishableKey) return null;
  return createSupabaseJsClient<Database>(url, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function safeFileName(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 120 || trimmed.includes("/") || trimmed.includes("\\")) return null;
  const sanitized = trimmed.replace(/[^a-zA-Z0-9._-]/g, "-");
  return sanitized && sanitized !== "." && sanitized !== ".." ? sanitized : null;
}

export async function POST(req: NextRequest, context: RouteContext) {
  const supabase = await clientForRequest(req);
  if (!supabase) return NextResponse.json({ ok: false, error: "Workspace unavailable." }, { status: 503 });

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) {
    return NextResponse.json(
      { ok: false, error: workspace.errorMessage || "Unauthorized." },
      { status: workspace.errorCode === "unauthenticated" ? 401 : 403 },
    );
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Unauthorized." }, { status: 401 });

  const { sessionId } = await context.params;
  const db = supabase as unknown as UntypedSupabase;
  const { data: session, error: sessionError } = await db
    .from("reality_capture_sessions")
    .select("id,company_id,project_id,created_by,status")
    .eq("id", sessionId)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "Reality capture session not found." }, { status: 404 });
  if (session.created_by !== user.id) return NextResponse.json({ ok: false, error: "Only the capture owner can upload its native assets." }, { status: 403 });

  const body = await req.json() as { assetKind?: unknown; fileName?: unknown; mimeType?: unknown };
  const assetKind = typeof body.assetKind === "string" ? body.assetKind.trim() : "";
  const fileName = safeFileName(body.fileName);
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "application/octet-stream";
  if (!ALLOWED_KINDS.has(assetKind)) return NextResponse.json({ ok: false, error: "Unsupported Reality Engine asset kind." }, { status: 400 });
  if (!fileName) return NextResponse.json({ ok: false, error: "A safe asset file name is required." }, { status: 400 });

  const path = `${workspace.context.companyId}/${session.project_id}/${session.id}/${fileName}`;
  const { data: ticket, error: ticketError } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: false });
  if (ticketError || !ticket) {
    return NextResponse.json({ ok: false, error: ticketError?.message || "Unable to create Reality Engine upload ticket." }, { status: 500 });
  }

  await db.from("reality_capture_sessions").update({ status: "uploading" }).eq("id", session.id).eq("created_by", user.id);

  return NextResponse.json({
    ok: true,
    bucket: BUCKET,
    path,
    assetKind,
    mimeType,
    signedUrl: ticket.signedUrl,
    token: ticket.token,
  });
}
