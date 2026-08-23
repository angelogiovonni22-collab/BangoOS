"use client";

import Link from "next/link";
import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { BosNotification, NotificationsPayload } from "@/lib/notifications/types";

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<BosNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications?limit=8&status=active", { cache: "no-store" });
    const payload = await response.json() as NotificationsPayload;
    if (!response.ok || !payload.ok) return;
    setItems(payload.notifications);
    setUnreadCount(payload.unreadCount);
    setUserId(payload.userId || null);
  }, []);

  useEffect(() => {
    const initialTimer = window.setTimeout(() => { void load(); }, 0);
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") void load(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { window.clearTimeout(initialTimer); window.clearInterval(timer); document.removeEventListener("visibilitychange", onVisible); };
  }, [load]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase.channel(`user:${userId}:notifications`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bos_notifications", filter: `recipient_user_id=eq.${userId}` }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load, userId]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => { document.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("keydown", onKeyDown); };
  }, [open]);

  const update = async (action: "read" | "mark_all_read", id?: string) => {
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
    await load();
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex h-10 w-10 items-center justify-center rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] text-[var(--bos-text-primary)] transition hover:bg-[var(--bos-bg-hover)]"
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full border-2 border-[var(--bos-bg-panel)] bg-rose-500 px-1 text-center text-[10px] font-extrabold leading-4 text-white">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <section className="absolute right-0 top-[calc(100%+0.6rem)] z-[var(--z-overlay)] w-[min(23rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[0_24px_50px_-20px_rgba(2,6,17,0.55)]" aria-label="Recent notifications">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--bos-border-subtle)] px-4 py-3">
            <div><p className="text-sm font-bold">Notifications</p><p className="text-[11px] text-[var(--bos-text-muted)]">{unreadCount} unread</p></div>
            {unreadCount ? <button type="button" onClick={() => void update("mark_all_read")} className="inline-flex items-center gap-1 text-xs font-bold text-blue-500"><CheckCheck size={14} />Mark all read</button> : null}
          </header>
          <div className="max-h-[25rem] overflow-y-auto p-2">
            {items.length ? items.map((item) => <NotificationRow key={item.id} item={item} onRead={() => void update("read", item.id)} />) : <p className="p-5 text-center text-sm text-[var(--bos-text-secondary)]">You are all caught up.</p>}
          </div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="flex items-center justify-center gap-1.5 border-t border-[var(--bos-border-subtle)] px-4 py-3 text-xs font-bold text-blue-500 hover:bg-[var(--bos-bg-hover)]">Open notification inbox<ExternalLink size={13} /></Link>
        </section>
      ) : null}
    </div>
  );
}

function NotificationRow({ item, onRead }: { item: BosNotification; onRead: () => void }) {
  const content = <><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.read_at ? "bg-transparent" : severityDot(item.severity)}`} /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[var(--bos-text-primary)]">{item.title}</span><span className="mt-0.5 line-clamp-2 block text-xs text-[var(--bos-text-secondary)]">{item.message}</span><span className="mt-1 block text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--bos-text-muted)]">{item.category} · {formatRelative(item.created_at)}</span></span></>;
  const className = `flex w-full gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-[var(--bos-bg-hover)] ${item.read_at ? "opacity-75" : "bg-blue-500/5"}`;
  return item.linked_href ? <Link href={item.linked_href} onClick={onRead} className={className}>{content}</Link> : <button type="button" onClick={onRead} className={className}>{content}</button>;
}

function severityDot(severity: string) {
  if (severity === "critical") return "bg-rose-500";
  if (severity === "warning") return "bg-amber-400";
  if (severity === "success") return "bg-emerald-500";
  return "bg-blue-500";
}

function formatRelative(value: string) {
  const deltaMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (deltaMinutes < 1) return "now";
  if (deltaMinutes < 60) return `${deltaMinutes}m ago`;
  if (deltaMinutes < 1440) return `${Math.floor(deltaMinutes / 60)}h ago`;
  return `${Math.floor(deltaMinutes / 1440)}d ago`;
}
