"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { MessageCircle, Send } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Select, SkeletonLoader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

type MessageAssignment = { assignment_id: string; project_id: string; trade_name: string; project_name: string };
type TradePartnerMessage = { id: string; body: string; sender_type: "internal" | "trade_partner"; sender_user_id: string; created_at: string; is_mine: boolean };
type RpcResult<T> = Promise<{ data: T | null; error: { message: string } | null }>;
type MessagingClient = { rpc: {
  (name: "get_trade_partner_message_threads"): RpcResult<MessageAssignment[]>;
  (name: "get_trade_partner_messages_for_assignment", args: { p_assignment_id: string }): RpcResult<TradePartnerMessage[]>;
  (name: "send_trade_partner_message_for_assignment", args: { p_assignment_id: string; p_body: string }): RpcResult<string>;
} };

export function ProjectTradePartnerMessages({ projectId, canManage }: { projectId: string; canManage: boolean }) {
  const client = useMemo(() => createClient() as unknown as MessagingClient | null, []);
  const [assignments, setAssignments] = useState<MessageAssignment[]>([]);
  const [assignmentId, setAssignmentId] = useState("");
  const [messages, setMessages] = useState<TradePartnerMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = assignments.find((assignment) => assignment.assignment_id === assignmentId) || assignments[0];

  useEffect(() => {
    if (!client) return;
    void client.rpc("get_trade_partner_message_threads").then((result) => {
      if (result.error) { setError(result.error.message); return; }
      const projectAssignments = (result.data || []).filter((assignment) => assignment.project_id === projectId);
      setAssignments(projectAssignments);
      setAssignmentId((current) => projectAssignments.some((assignment) => assignment.assignment_id === current) ? current : projectAssignments[0]?.assignment_id || "");
    });
  }, [client, projectId]);

  const loadMessages = useCallback(async () => {
    if (!client || !assignmentId) return;
    setIsLoading(true); setError(null);
    const result = await client.rpc("get_trade_partner_messages_for_assignment", { p_assignment_id: assignmentId });
    if (result.error) setError(result.error.message); else setMessages(result.data || []);
    setIsLoading(false);
  }, [assignmentId, client]);

  useEffect(() => { void loadMessages(); }, [loadMessages]);

  const sendMessage = async () => {
    const body = draft.trim();
    if (!client || !assignmentId || !body || isSending) return;
    setIsSending(true); setError(null);
    const result = await client.rpc("send_trade_partner_message_for_assignment", { p_assignment_id: assignmentId, p_body: body });
    if (result.error) setError(result.error.message); else { setDraft(""); await loadMessages(); }
    setIsSending(false);
  };

  if (!assignments.length) return null;

  return (
    <Card className="overflow-hidden border-[var(--bos-border-light)] bg-[linear-gradient(180deg,var(--bos-bg-workspace-card),var(--color-neutral-50))] shadow-[var(--bos-shadow-workspace-card)]" data-project-trade-partner-messages>
      <CardHeader className="border-b border-[var(--bos-border-light)] bg-[linear-gradient(180deg,#f8fbff,#f3f7fd)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><CardTitle className="flex items-center gap-2 text-section-title font-bold text-[var(--bos-text-strong-on-light)]"><MessageCircle size={19} aria-hidden="true" />Trade Partner Messages</CardTitle><p className="mt-1 text-sm font-medium text-[var(--bos-text-medium-on-light)]">Keep project communication beside the customer, scope, schedule, and subcontractor records.</p></div>
          {assignments.length > 1 ? <Select aria-label="Trade partner conversation" value={assignmentId} onChange={(event) => setAssignmentId(event.currentTarget.value)} className="w-full sm:w-72">{assignments.map((assignment) => <option key={assignment.assignment_id} value={assignment.assignment_id}>{assignment.trade_name}</option>)}</Select> : null}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="border-b border-[var(--bos-border-light)] px-4 py-3 text-xs font-bold uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">Conversation with {selected?.trade_name}</div>
        <div className="max-h-80 min-h-32 space-y-3 overflow-y-auto bg-[var(--bos-bg-workspace-card)] p-4" aria-live="polite">
          {isLoading ? <SkeletonLoader className="h-28 w-full" /> : messages.length ? messages.map((message) => <article key={message.id} className={`w-fit max-w-[78%] rounded-2xl px-4 py-2.5 shadow-sm ${message.sender_type === "internal" ? "ml-auto bg-[var(--color-brand-700)] text-white" : "border border-[var(--bos-border-light)] bg-white text-[var(--bos-text-strong-on-light)]"}`}><p className="whitespace-pre-wrap text-sm font-medium leading-6">{message.body}</p><p className={`mt-1 text-[10px] font-semibold ${message.sender_type === "internal" ? "text-blue-100" : "text-[var(--bos-text-medium-on-light)]"}`}>{message.sender_type === "trade_partner" ? "Trade Partner" : message.is_mine ? "You" : "B.O.S. Team"} · {formatDateTime(message.created_at)}</p></article>) : <div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed border-[var(--bos-border-light)] bg-white p-5 text-center text-sm font-medium text-[var(--bos-text-medium-on-light)]">No messages yet. Start the project conversation below.</div>}
        </div>
        {error ? <p role="alert" className="border-t border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">{error}</p> : null}
        {canManage ? <div className="border-t border-[var(--bos-border-light)] bg-white p-4"><label htmlFor="project-trade-partner-message" className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">Message {selected?.trade_name}</label><textarea id="project-trade-partner-message" value={draft} onChange={(event) => setDraft(event.currentTarget.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void sendMessage(); } }} maxLength={4000} rows={2} placeholder="Type a project message…" className="mt-2 w-full rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] p-3 text-sm font-medium text-[var(--bos-text-primary)] placeholder:text-[var(--bos-text-muted)]" /><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><p className="text-xs font-medium text-[var(--bos-text-medium-on-light)]">The assigned project manager is notified when the trade partner replies.</p><Button type="button" disabled={!draft.trim() || isSending} onClick={() => void sendMessage()}>{isSending ? "Sending…" : <><Send size={15} aria-hidden="true" />Send Message</>}</Button></div></div> : <p className="border-t border-[var(--bos-border-light)] bg-white p-4 text-sm font-medium text-[var(--bos-text-medium-on-light)]">You have read-only access to this conversation.</p>}
      </CardContent>
    </Card>
  );
}

function formatDateTime(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
