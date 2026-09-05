import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseJsClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient as createCookieClient } from "@/lib/supabase/server";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

const BUCKET = "bos-reality-captures";
const ALLOWED_KINDS = new Set(["usdz", "mesh", "thumbnail", "depth", "photo", "metadata"]);
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
    .select("id,company_id,project_id,created_by")
    .eq("id", sessionId)
    .eq("company_id", workspace.context.companyId)
    .maybeSingle();
  if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "Reality capture session not found." }, { status: 404 });
  if (session.created_by !== user.id) return NextResponse.json({ ok: false, error: "Only the capture owner can finalize its native assets." }, { status: 403 });

  const body = await req.json() as {
    assetKind?: unknown;
    path?: unknown;
    mimeType?: unknown;
    byteSize?: unknown;
    sha256?: unknown;
  };
  const assetKind = typeof body.assetKind === "string" ? body.assetKind.trim() : "";
  const storagePath = typeof body.path === "string" ? body.path.trim() : "";
  const mimeType = typeof body.mimeType === "string" && body.mimeType.trim() ? body.mimeType.trim() : null;
  const byteSize = typeof body.byteSize === "number" && Number.isSafeInteger(body.byteSize) && body.byteSize >= 0 ? body.byteSize : null;
  const sha256 = typeof body.sha256 === "string" && /^[a-f0-9]{64}$/i.test(body.sha256.trim()) ? body.sha256.trim().toLowerCase() : null;
  if (!ALLOWED_KINDS.has(assetKind)) return NextResponse.json({ ok: false, error: "Unsupported Reality Engine asset kind." }, { status: 400 });

  const prefix = `${workspace.context.companyId}/${session.project_id}/${session.id}/`;
  if (!storagePath.startsWith(prefix) || storagePath.slice(prefix.length).includes("/")) {
    return NextResponse.json({ ok: false, error: "Reality Engine asset path is outside this capture session." }, { status: 400 });
  }
  const fileName = storagePath.slice(prefix.length);
  if (!fileName) return NextResponse.json({ ok: false, error: "Reality Engine asset file name is missing." }, { status: 400 });

  const folder = prefix.slice(0, -1);
  const { data: objects, error: listError } = await supabase.storage.from(BUCKET).list(folder, { search: fileName, limit: 20 });
  if (listError) return NextResponse.json({ ok: false, error: listError.message }, { status: 500 });
  const storedObject = (objects || []).find((item) => item.name === fileName);
  if (!storedObject) return NextResponse.json({ ok: false, error: "Uploaded Reality Engine asset was not found in private storage." }, { status: 409 });

  const storedSize = typeof storedObject.metadata?.size === "number" ? storedObject.metadata.size : byteSize;
  if (byteSize !== null && storedSize !== null && storedSize !== byteSize) {
    return NextResponse.json({ ok: false, error: "Uploaded Reality Engine asset size does not match the reported file." }, { status: 409 });
  }

  const { data: asset, error: assetError } = await db.from("reality_capture_assets").upsert({
    session_id: session.id,
    company_id: workspace.context.companyId,
    project_id: session.project_id,
    asset_kind: assetKind,
    storage_path: storagePath,
    mime_type: mimeType,
    byte_size: byteSize ?? storedSize ?? null,
    sha256,
    created_by: user.id,
  }, { onConflict: "session_id,asset_kind,storage_path" }).select("id,asset_kind,storage_path,byte_size").single();
  if (assetError) return NextResponse.json({ ok: false, error: assetError.message }, { status: 500 });

  if (assetKind === "usdz") {
    await db.from("reality_capture_sessions").update({ status: "ready", error_message: null }).eq("id", session.id).eq("created_by", user.id);
  }

  return NextResponse.json({ ok: true, asset });
}
