import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

 type TradePartnerJob = {
  assignment_id: string;
  project_id: string;
  project_name: string;
  project_status: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  trade_name: string;
  scope_of_work: string | null;
  start_date: string | null;
  target_completion_date: string | null;
  assignment_status: string;
  contract_status: string;
};

type RpcClient = {
  rpc: (name: string) => Promise<{ data: TradePartnerJob[] | null; error: { message: string } | null }>;
};

export default async function TradePartnerPortalPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/login");
  if ((workspace.context.role || "").toLowerCase() !== "subcontractor") redirect("/app-entry");

  const { data, error } = await (supabase as unknown as RpcClient).rpc("get_my_trade_partner_jobs");
  const jobs = data ?? [];

  return (
    <div className="container-content space-y-6">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ec3ff]">B.O.S. Trade Partner</p>
        <h1 className="mt-2 text-2xl font-semibold text-[var(--bos-text-primary)]">My Assigned Jobs</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--bos-text-secondary)]">Your workspace contains only the operational information assigned to your company. B.O.S. company financials, profit, markup, customer billing, payroll, internal job costing, and other private records are not available here.</p>
      </section>

      {error ? (
        <section className="rounded-2xl border border-amber-300/40 bg-amber-50 p-5 text-sm text-amber-900">Your trade partner profile needs to be linked by a B.O.S. administrator before assigned jobs can be displayed.</section>
      ) : jobs.length === 0 ? (
        <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 text-sm text-[var(--bos-text-secondary)]">No active job assignments are linked to this account yet.</section>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {jobs.map((job) => (
            <article key={job.assignment_id} className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-[#8ec3ff]">{job.trade_name}</p><h2 className="mt-1 text-lg font-semibold">{job.project_name}</h2></div>
                <span className="rounded-full border border-[var(--bos-border-default)] px-3 py-1 text-xs font-semibold text-[var(--bos-text-secondary)]">{formatLabel(job.project_status)}</span>
              </div>
              <p className="mt-3 text-sm text-[var(--bos-text-secondary)]">{formatAddress(job)}</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <Info label="Start" value={formatDate(job.start_date)} />
                <Info label="Target completion" value={formatDate(job.target_completion_date)} />
                <Info label="Assignment" value={formatLabel(job.assignment_status)} />
                <Info label="Agreement" value={formatLabel(job.contract_status)} />
              </div>
              <div className="mt-5 rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--bos-text-muted)]">Scope of Work</p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--bos-text-primary)]">{job.scope_of_work || "Scope has not been published yet."}</p>
              </div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                <div className="rounded-lg border border-[var(--bos-border-subtle)] p-3">Photos</div>
                <div className="rounded-lg border border-[var(--bos-border-subtle)] p-3">Plans</div>
                <div className="rounded-lg border border-[var(--bos-border-subtle)] p-3">Messages</div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function formatDate(value: string | null) { if (!value) return "Not scheduled"; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function formatLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatAddress(job: TradePartnerJob) { return [job.address_line_1, job.city, job.state, job.postal_code].filter(Boolean).join(", ") || "Jobsite address not published"; }
