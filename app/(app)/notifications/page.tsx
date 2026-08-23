"use client";

import Link from "next/link";
import { Archive, Bell, CheckCheck, CircleAlert, ExternalLink, MailOpen } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { BosNotification, NotificationCategory, NotificationsPayload } from "@/lib/notifications/types";

const FILTERS: Array<{ key: "active" | "unread" | "archived"; label: string }> = [
  { key: "active", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "archived", label: "Archived" },
];
const CATEGORIES: Array<NotificationCategory | "all"> = ["all", "operations", "project", "schedule", "finance", "workforce", "compliance", "communication", "system"];

export default function NotificationsPage() {
  const [status, setStatus] = useState<"active" | "unread" | "archived">("active");
  const [category, setCategory] = useState<NotificationCategory | "all">("all");
  const [items, setItems] = useState<BosNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: "100", status });
    if (category !== "all") params.set("category", category);
    try {
      const response = await fetch(`/api/notifications?${params}`, { cache: "no-store" });
      const payload = await response.json() as NotificationsPayload;
      if (!response.ok || !payload.ok) throw new Error(payload.error || "Unable to load notification inbox.");
      setItems(payload.notifications);
      setUnreadCount(payload.unreadCount);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load notification inbox.");
    } finally {
      setLoading(false);
    }
  }, [category, status]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const update = async (action: "read" | "unread" | "archive" | "mark_all_read", id?: string) => {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id }) });
    if (!response.ok) { setError("Unable to update notification."); return; }
    await load();
  };

  return (
    <div className="container-content space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Notification Center</p><h1 className="mt-2 text-2xl font-semibold text-[var(--bos-text-primary)]">Notification Inbox</h1><p className="mt-2 max-w-3xl text-sm text-[var(--bos-text-secondary)]">One place for project, schedule, finance, workforce, compliance, communication, and system alerts.</p></div>
          <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 px-4 py-3 text-center"><p className="text-2xl font-extrabold text-blue-400">{unreadCount}</p><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">Unread</p></div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-card)]">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--bos-border-subtle)] p-4">
          <div className="flex flex-wrap gap-2">{FILTERS.map((filter) => <button key={filter.key} type="button" onClick={() => setStatus(filter.key)} className={`rounded-full px-3 py-1.5 text-xs font-bold ${status === filter.key ? "bg-blue-600 text-white" : "bg-[var(--bos-bg-control)] text-[var(--bos-text-secondary)]"}`}>{filter.label}</button>)}</div>
          <div className="flex items-center gap-2">
            <select aria-label="Notification category" value={category} onChange={(event) => setCategory(event.target.value as NotificationCategory | "all")} className="h-9 rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-xs font-semibold text-[var(--bos-text-primary)]">{CATEGORIES.map((item) => <option key={item} value={item}>{item === "all" ? "All categories" : item.replaceAll("_", " ")}</option>)}</select>
            {unreadCount ? <button type="button" onClick={() => void update("mark_all_read")} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white"><CheckCheck size={14} />Mark all read</button> : null}
          </div>
        </header>

        {error ? <p className="m-4 rounded-xl border border-rose-300/40 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{error}</p> : null}
        {loading ? <div className="space-y-3 p-4">{[1,2,3].map((item) => <div key={item} className="h-24 animate-pulse rounded-xl bg-[var(--bos-bg-control)]" />)}</div> : null}
        {!loading && !items.length ? <div className="flex min-h-64 flex-col items-center justify-center p-8 text-center"><Bell size={30} className="text-blue-400" /><h2 className="mt-3 text-lg font-bold">No notifications here</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">You are caught up. New B.O.S. activity will appear automatically.</p></div> : null}
        {!loading && items.length ? <div className="divide-y divide-[var(--bos-border-subtle)]">{items.map((item) => <InboxRow key={item.id} item={item} onUpdate={update} />)}</div> : null}
      </section>
    </div>
  );
}

function InboxRow({ item, onUpdate }: { item: BosNotification; onUpdate: (action: "read" | "unread" | "archive", id: string) => Promise<void> }) {
  return <article className={`flex flex-col gap-3 p-4 sm:flex-row sm:items-start ${item.read_at ? "opacity-75" : "bg-blue-500/5"}`}>
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.severity === "critical" ? "bg-rose-100 text-rose-700" : item.severity === "warning" ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>{item.severity === "critical" ? <CircleAlert size={18} /> : <Bell size={18} />}</span>
    <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-sm font-extrabold text-[var(--bos-text-primary)]">{item.title}</h2>{!item.read_at ? <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[9px] font-extrabold uppercase text-white">New</span> : null}</div><p className="mt-1 text-sm leading-6 text-[var(--bos-text-secondary)]">{item.message}</p><p className="mt-2 text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--bos-text-muted)]">{item.category} · {formatDateTime(item.created_at)} · {item.delivery_state.replaceAll("_", " ")}</p></div>
    <div className="flex shrink-0 flex-wrap gap-2">{item.linked_href ? <Link href={item.linked_href} onClick={() => { if (!item.read_at) void onUpdate("read", item.id); }} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--bos-border-default)] px-3 text-xs font-bold hover:bg-[var(--bos-bg-hover)]">Open<ExternalLink size={13} /></Link> : null}<button type="button" onClick={() => void onUpdate(item.read_at ? "unread" : "read", item.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--bos-border-default)] px-3 text-xs font-bold hover:bg-[var(--bos-bg-hover)]"><MailOpen size={13} />{item.read_at ? "Unread" : "Read"}</button>{!item.archived_at ? <button type="button" onClick={() => void onUpdate("archive", item.id)} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--bos-border-default)] px-3 text-xs font-bold hover:bg-[var(--bos-bg-hover)]"><Archive size={13} />Archive</button> : null}</div>
  </article>;
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
