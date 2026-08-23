import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { NotificationCategory, NotificationSeverity } from "@/lib/notifications/types";

const CATEGORIES = new Set<NotificationCategory>(["operations", "project", "schedule", "finance", "workforce", "compliance", "communication", "system"]);
const SEVERITIES = new Set<NotificationSeverity>(["info", "success", "warning", "critical"]);

async function getContext() {
  const supabase = await createClient();
  const workspace = await resolveWorkspaceContext(supabase);
  return { supabase, workspace };
}

export async function GET(request: NextRequest) {
  const { supabase, workspace } = await getContext();
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, notifications: [], unreadCount: 0, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 30)));
  const status = request.nextUrl.searchParams.get("status") || "active";
  const category = request.nextUrl.searchParams.get("category");
  let query = supabase
    .from("bos_notifications" as never)
    .select("id,company_id,recipient_user_id,actor_user_id,category,severity,title,message,entity_type,entity_id,linked_href,source_module,requested_channels,delivery_state,in_app_status,push_status,email_status,read_at,archived_at,created_at,updated_at")
    .eq("company_id", workspace.context.companyId)
    .eq("recipient_user_id", workspace.context.userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status === "unread") query = query.is("read_at", null).is("archived_at", null);
  else if (status === "archived") query = query.not("archived_at", "is", null);
  else query = query.is("archived_at", null);
  if (category && CATEGORIES.has(category as NotificationCategory)) query = query.eq("category", category);

  const [itemsResult, unreadResult] = await Promise.all([
    query,
    supabase.from("bos_notifications" as never).select("id", { count: "exact", head: true })
      .eq("company_id", workspace.context.companyId)
      .eq("recipient_user_id", workspace.context.userId)
      .is("read_at", null)
      .is("archived_at", null),
  ]);

  if (itemsResult.error || unreadResult.error) {
    return NextResponse.json({ ok: false, notifications: [], unreadCount: 0, error: "Unable to load notifications." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    userId: workspace.context.userId,
    notifications: itemsResult.data || [],
    unreadCount: unreadResult.count || 0,
  });
}

export async function PATCH(request: NextRequest) {
  const { supabase, workspace } = await getContext();
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const body = await request.json().catch(() => ({})) as { id?: unknown; action?: unknown };
  const id = typeof body.id === "string" ? body.id : "";
  const action = typeof body.action === "string" ? body.action : "";
  const now = new Date().toISOString();
  let update: Record<string, string | null>;
  if (action === "read") update = { read_at: now };
  else if (action === "unread") update = { read_at: null, archived_at: null };
  else if (action === "archive") update = { archived_at: now, read_at: now };
  else if (action === "mark_all_read") update = { read_at: now };
  else return NextResponse.json({ ok: false, error: "Unsupported notification action." }, { status: 400 });

  let query = supabase.from("bos_notifications" as never).update(update as never)
    .eq("company_id", workspace.context.companyId)
    .eq("recipient_user_id", workspace.context.userId);
  if (action === "mark_all_read") query = query.is("read_at", null).is("archived_at", null);
  else {
    if (!id) return NextResponse.json({ ok: false, error: "Notification id is required." }, { status: 400 });
    query = query.eq("id", id);
  }

  const result = await query.select("id");
  if (result.error) return NextResponse.json({ ok: false, error: "Unable to update notification." }, { status: 500 });
  return NextResponse.json({ ok: true, updated: result.data?.length || 0 });
}

export async function POST(request: NextRequest) {
  const { supabase, workspace } = await getContext();
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const recipientUserId = typeof body.recipientUserId === "string" ? body.recipientUserId : workspace.context.userId;
  const category = CATEGORIES.has(body.category as NotificationCategory) ? body.category as NotificationCategory : "system";
  const severity = SEVERITIES.has(body.severity as NotificationSeverity) ? body.severity as NotificationSeverity : "info";
  const linkedHref = typeof body.linkedHref === "string" && body.linkedHref.startsWith("/") ? body.linkedHref : null;
  const requestedChannels = Array.isArray(body.requestedChannels)
    ? body.requestedChannels.filter((item): item is string => ["in_app", "push", "email"].includes(String(item)))
    : ["in_app"];
  if (!title || title.length > 160 || message.length > 2000) {
    return NextResponse.json({ ok: false, error: "A valid notification title and message are required." }, { status: 400 });
  }

  const insert = await supabase.from("bos_notifications" as never).insert({
    company_id: workspace.context.companyId,
    recipient_user_id: recipientUserId,
    actor_user_id: workspace.context.userId,
    category,
    severity,
    title,
    message,
    linked_href: linkedHref,
    source_module: typeof body.sourceModule === "string" ? body.sourceModule.slice(0, 120) : "bos",
    source_key: typeof body.sourceKey === "string" ? body.sourceKey.slice(0, 240) : null,
    requested_channels: requestedChannels.length ? requestedChannels : ["in_app"],
    delivery_state: "ready",
    push_status: requestedChannels.includes("push") ? "pending" : "not_requested",
    email_status: requestedChannels.includes("email") ? "pending" : "not_requested",
  } as never).select("id").single();

  if (insert.error) return NextResponse.json({ ok: false, error: "Unable to create notification." }, { status: 403 });
  return NextResponse.json({ ok: true, id: (insert.data as { id: string }).id });
}
