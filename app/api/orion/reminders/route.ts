import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

async function context() {
  const supabase = await createClient();
  const workspace = await resolveWorkspaceContext(supabase);
  return { supabase, workspace };
}

export async function GET() {
  const { supabase, workspace } = await context();
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const { data, error } = await (supabase as any)
    .from("orion_reminders")
    .select("id,title,message,due_at,event_title,event_starts_at,linked_href,created_at,cancelled_at,delivered_at")
    .eq("company_id", workspace.context.companyId)
    .eq("user_id", workspace.context.userId)
    .is("cancelled_at", null)
    .order("due_at", { ascending: true });

  if (error) return NextResponse.json({ ok: false, error: "Unable to load Orion reminders." }, { status: 500 });
  return NextResponse.json({ ok: true, reminders: data || [] });
}

export async function POST(req: NextRequest) {
  const { supabase, workspace } = await context();
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const body = await req.json() as Record<string, unknown>;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const dueAt = typeof body.dueAt === "string" ? new Date(body.dueAt) : null;
  if (!title || !dueAt || !Number.isFinite(dueAt.getTime()) || dueAt.getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, error: "A title and future reminder time are required." }, { status: 400 });
  }

  const linkedHref = typeof body.linkedHref === "string" && body.linkedHref.startsWith("/") ? body.linkedHref : null;
  const eventStartsAt = typeof body.eventStartsAt === "string" && Number.isFinite(new Date(body.eventStartsAt).getTime()) ? new Date(body.eventStartsAt).toISOString() : null;
  const { data, error } = await (supabase as any).from("orion_reminders").insert({
    company_id: workspace.context.companyId,
    user_id: workspace.context.userId,
    title,
    message,
    due_at: dueAt.toISOString(),
    event_title: typeof body.eventTitle === "string" && body.eventTitle.trim() ? body.eventTitle.trim() : null,
    event_starts_at: eventStartsAt,
    linked_href: linkedHref,
  }).select("id,title,message,due_at,event_title,event_starts_at,linked_href,created_at,cancelled_at,delivered_at").single();

  if (error || !data) return NextResponse.json({ ok: false, error: "Unable to save Orion reminder." }, { status: 500 });
  return NextResponse.json({ ok: true, reminder: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, workspace } = await context();
  if (!supabase || !workspace.context) {
    return NextResponse.json({ ok: false, error: workspace.errorMessage || "Authentication required." }, { status: workspace.errorCode === "unauthenticated" ? 401 : 403 });
  }

  const body = await req.json() as { reminderId?: unknown };
  const reminderId = typeof body.reminderId === "string" ? body.reminderId.trim() : "";
  if (!reminderId) return NextResponse.json({ ok: false, error: "Reminder id is required." }, { status: 400 });

  const { error } = await (supabase as any).from("orion_reminders").update({ cancelled_at: new Date().toISOString() })
    .eq("id", reminderId)
    .eq("company_id", workspace.context.companyId)
    .eq("user_id", workspace.context.userId);
  if (error) return NextResponse.json({ ok: false, error: "Unable to cancel Orion reminder." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
