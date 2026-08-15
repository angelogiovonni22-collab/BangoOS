import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { hasBosPermission } from "@/lib/access-control/permissions";

type Thread = {
  assignment_id: string;
  project_id: string;
  project_name: string;
  vendor_id: string;
  trade_name: string;
  assignment_status: string;
  last_message_at: string | null;
  message_count: number;
};

type Message = {
  id: string;
  project_id: string;
  vendor_id: string;
  body: string;
  sender_type: "internal" | "trade_partner";
  sender_user_id: string;
  created_at: string;
  is_mine: boolean;
};

type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type MessagingRpcClient = {
  rpc: {
    (name: "get_trade_partner_message_threads"): RpcResult<Thread[]>;
    (name: "get_trade_partner_messages_for_assignment", args: { p_assignment_id: string }): RpcResult<Message[]>;
    (name: "send_trade_partner_message_for_assignment", args: { p_assignment_id: string; p_body: string }): RpcResult<string>;
  };
};

type PageProps = { searchParams: Promise<{ assignment?: string; notice?: string; error?: string }> };

export default async function TradePartnerMessagesPage({ searchParams }: PageProps) {
  const query = await searchParams;
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/login");
  if (!hasBosPermission(workspace.context.role, "communications.view") || ["subcontractor", "customer"].includes((workspace.context.role || "").toLowerCase())) redirect("/app-entry");

  const client = supabase as unknown as MessagingRpcClient;
  const threadResult = await client.rpc("get_trade_partner_message_threads");
  const threads = threadResult.data ?? [];
  const selected = threads.find((thread) => thread.assignment_id === query.assignment) ?? threads[0] ?? null;
  const messageResult = selected
    ? await client.rpc("get_trade_partner_messages_for_assignment", { p_assignment_id: selected.assignment_id })
    : { data: [] as Message[], error: null };
  const messages = messageResult.data ?? [];

  async function sendMessage(formData: FormData) {
    "use server";
    const serverClient = await createClient();
    if (!serverClient) redirect("/login");
    const context = await resolveWorkspaceContext(serverClient);
    if (!context.context || !hasBosPermission(context.context.role, "communications.manage")) redirect("/app-entry");
    const assignmentId = String(formData.get("assignmentId") || "");
    const body = String(formData.get("body") || "").trim();
    if (!assignmentId || !body) redirect(`/trade-partner-messages?assignment=${encodeURIComponent(assignmentId)}&error=${encodeURIComponent("Enter a message first.")}`);
    const result = await (serverClient as unknown as MessagingRpcClient).rpc("send_trade_partner_message_for_assignment", { p_assignment_id: assignmentId, p_body: body });
    if (result.error) redirect(`/trade-partner-messages?assignment=${encodeURIComponent(assignmentId)}&error=${encodeURIComponent(result.error.message)}`);
    revalidatePath("/trade-partner-messages");
    redirect(`/trade-partner-messages?assignment=${encodeURIComponent(assignmentId)}&notice=${encodeURIComponent("Message sent to trade partner.")}`);
  }

  return (
    <div className="container-content space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Communications</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--bos-text-primary)]">Trade Partner Messages</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--bos-text-secondary)]">Two-way project communication with assigned subcontractors. Each conversation is isolated to the assigned project and vendor.</p>
      </section>

      {query.notice ? <div className="rounded-xl border border-emerald-300/40 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">{query.notice}</div> : null}
      {query.error ? <div className="rounded-xl border border-rose-300/40 bg-rose-50 p-3 text-sm font-semibold text-rose-900">{query.error}</div> : null}
      {threadResult.error ? <div className="rounded-xl border border-amber-300/40 bg-amber-50 p-3 text-sm text-amber-900">Unable to load trade partner conversations. Confirm the latest B.O.S. database migration is applied.</div> : null}

      <div className="grid min-h-[34rem] gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <aside className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-3 shadow-[var(--shadow-small)]">
          <p className="px-2 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">Active Assignments</p>
          <div className="space-y-2">
            {threads.length ? threads.map((thread) => {
              const active = selected?.assignment_id === thread.assignment_id;
              return <Link key={thread.assignment_id} href={`/trade-partner-messages?assignment=${thread.assignment_id}`} className={`block rounded-xl border p-3 transition ${active ? "border-blue-400 bg-blue-50 text-slate-950" : "border-[var(--bos-border-subtle)] hover:bg-[var(--bos-bg-hover)]"}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-bold">{thread.project_name}</p><p className={`mt-1 truncate text-xs ${active ? "text-slate-600" : "text-[var(--bos-text-secondary)]"}`}>{thread.trade_name}</p></div><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${active ? "bg-blue-100 text-blue-800" : "bg-[var(--bos-bg-root)] text-[var(--bos-text-muted)]"}`}>{thread.message_count}</span></div>{thread.last_message_at ? <p className={`mt-2 text-[10px] ${active ? "text-slate-500" : "text-[var(--bos-text-muted)]"}`}>{formatDateTime(thread.last_message_at)}</p> : null}</Link>;
            }) : <p className="rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-4 text-sm text-[var(--bos-text-secondary)]">No active trade partner assignments are available.</p>}
          </div>
        </aside>

        <section className="flex min-h-[34rem] flex-col rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-small)]">
          {selected ? <>
            <header className="border-b border-[var(--bos-border-subtle)] p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-[#4f7eaf]">{selected.trade_name}</p><h2 className="mt-1 text-lg font-semibold">{selected.project_name}</h2></div><Link href={`/projects/${selected.project_id}`} className="rounded-lg border border-[var(--bos-border-default)] px-3 py-2 text-xs font-semibold hover:bg-[var(--bos-bg-hover)]">Open Project</Link></div></header>
            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messageResult.error ? <p className="rounded-xl border border-rose-300/40 bg-rose-50 p-3 text-sm text-rose-900">{messageResult.error.message}</p> : null}
              {messages.length ? messages.map((message) => <div key={message.id} className={`max-w-[82%] rounded-xl px-3 py-2.5 ${message.sender_type === "internal" ? "ml-auto bg-blue-600 text-white" : "bg-[var(--bos-bg-root)] text-[var(--bos-text-primary)]"}`}><p className="whitespace-pre-wrap text-sm leading-5">{message.body}</p><p className={`mt-1 text-[10px] ${message.sender_type === "internal" ? "text-blue-100" : "text-[var(--bos-text-muted)]"}`}>{message.sender_type === "internal" ? (message.is_mine ? "You" : "B.O.S. Team") : "Trade Partner"} · {formatDateTime(message.created_at)}</p></div>) : <p className="rounded-xl border border-dashed border-[var(--bos-border-subtle)] p-4 text-sm text-[var(--bos-text-secondary)]">No messages yet. Start the conversation below.</p>}
            </div>
            {hasBosPermission(workspace.context.role, "communications.manage") ? <form action={sendMessage} className="border-t border-[var(--bos-border-subtle)] p-4"><input type="hidden" name="assignmentId" value={selected.assignment_id} /><textarea name="body" required maxLength={4000} rows={3} placeholder="Message this trade partner…" className="w-full rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] p-3 text-sm text-[var(--bos-text-primary)] placeholder:text-[var(--bos-text-muted)]" /><button type="submit" className="mt-2 h-10 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-500">Send Message</button></form> : <p className="border-t border-[var(--bos-border-subtle)] p-4 text-xs text-[var(--bos-text-muted)]">You have read-only access to this conversation.</p>}
          </> : <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-[var(--bos-text-secondary)]">Assign a subcontractor to a project to start a trade partner conversation.</div>}
        </section>
      </div>
    </div>
  );
}

function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
