"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ProjectFinancialReport } from "@/lib/financial-reporting";

type OverviewTask = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  planned_start: string | null;
  planned_finish: string | null;
  completion_percentage: number | null;
};

type OverviewAssignment = {
  id: string;
  title: string;
  status: string;
  starts_at: string;
  ends_at: string;
  crew_id: string | null;
  employee_id: string | null;
};

type OverviewInspection = {
  id: string;
  inspection_type: string;
  status: string;
  scheduled_at: string | null;
  completed_at: string | null;
  created_at: string;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  timestamp: string;
  tone: string;
};

type TradePartnerSummary = {
  id: string;
  trade_name: string | null;
  crew_size: number | null;
  assignment_status: string;
  mobilization_status: string | null;
  mobilization_blockers: unknown;
  start_date: string | null;
};

type Props = {
  projectId: string;
  companyId: string;
  projectName: string;
  customerName: string;
  projectType: string | null;
  address: string;
  statusLabel: string;
  startDate: string;
  targetDate: string;
  contractValue: number | null;
  projectManager: string;
  tasks: OverviewTask[];
  assignments: OverviewAssignment[];
  inspections: OverviewInspection[];
  financialReport: ProjectFinancialReport | null;
  photoCount: number;
  heroImageUrl: string | null;
  activityItems: ActivityItem[];
  permitsOpen: number;
  pendingInspections: number;
  openPunchItems: number;
  localeTag: string;
};

export function ProjectOverviewCommandCenter(props: Props) {
  const supabase = useMemo(() => createClient(), []);
  const [tradePartners, setTradePartners] = useState<TradePartnerSummary[]>([]);

  useEffect(() => {
    let active = true;
    if (!supabase) return;

    void supabase
      .from("trade_partner_assignments")
      .select("id,trade_name,crew_size,assignment_status,mobilization_status,mobilization_blockers,start_date")
      .eq("company_id", props.companyId)
      .eq("project_id", props.projectId)
      .neq("assignment_status", "archived")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (active) setTradePartners((data || []) as TradePartnerSummary[]);
      });

    return () => { active = false; };
  }, [props.companyId, props.projectId, supabase]);

  const completedTasks = props.tasks.filter((task) => normalizeStatus(task.status) === "completed").length;
  const progressPercent = props.tasks.length ? Math.round((completedTasks / props.tasks.length) * 100) : 0;
  const openTasks = props.tasks.filter((task) => normalizeStatus(task.status) !== "completed");
  const nextTask = [...openTasks].sort((a, b) => (a.planned_start || "9999").localeCompare(b.planned_start || "9999"))[0] || null;
  const nextInspection = [...props.inspections]
    .filter((item) => !["passed", "completed", "closed"].includes(item.status.toLowerCase()))
    .sort((a, b) => (a.scheduled_at || a.created_at).localeCompare(b.scheduled_at || b.created_at))[0] || null;

  const bosCrewAssignments = props.assignments.filter((row) => Boolean(row.crew_id) && !["completed", "cancelled"].includes(row.status));
  const today = new Date();
  const todayKey = today.toISOString().slice(0, 10);
  const onsiteToday = props.assignments.filter((row) => row.starts_at.slice(0, 10) <= todayKey && row.ends_at.slice(0, 10) >= todayKey && !["completed", "cancelled"].includes(row.status)).length;
  const activeTradePartners = tradePartners.length;
  const tradePartnerCrewSize = tradePartners.reduce((sum, row) => sum + Math.max(0, Number(row.crew_size || 0)), 0);
  const blockedTradePartners = tradePartners.filter((row) => row.mobilization_status !== "cleared");
  const mobilizationBlockers = blockedTradePartners.reduce((sum, row) => sum + blockerCount(row.mobilization_blockers), 0);
  const nextMobilization = tradePartners.map((row) => row.start_date).filter(Boolean).sort()[0] || null;

  const summary = props.financialReport?.summary;
  const originalContract = summary?.originalEstimate || props.contractValue || 0;
  const approvedChangeOrders = summary?.approvedChangeOrders || 0;
  const revisedContract = summary?.revisedContractValue || props.contractValue || 0;
  const invoiced = summary?.amountInvoiced || 0;
  const paid = summary?.paymentsReceived || 0;
  const outstanding = summary?.outstandingReceivables || 0;
  const committed = summary?.committedCost || 0;
  const remainingCost = summary?.remainingCostToComplete || 0;
  const grossProfit = summary?.grossProfit || 0;
  const margin = summary?.grossMarginPercent;

  const daysRemaining = computeDaysRemaining(props.targetDate);
  const scheduleHealth = props.pendingInspections > 0 || props.openPunchItems > 0 ? "Needs Attention" : "On Track";
  const latestActivity = props.activityItems.slice(0, 4);

  const riskRows = [
    mobilizationBlockers > 0 ? { label: "Trade Partner mobilization hold", detail: `${mobilizationBlockers} requirement${mobilizationBlockers === 1 ? "" : "s"} must be cleared before work starts.`, badge: `${mobilizationBlockers} Open`, tone: "danger" } : null,
    bosCrewAssignments.length === 0 ? { label: "No B.O.S. crew assigned", detail: "No internal crew is currently assigned to this project.", badge: "Action Needed", tone: "warning" } : null,
    props.assignments.length === 0 ? { label: "No internal schedule established", detail: "Create workforce assignments to establish the active job schedule.", badge: "Not Scheduled", tone: "warning" } : null,
    props.permitsOpen > 0 ? { label: "Open permit items", detail: `${props.permitsOpen} permit item${props.permitsOpen === 1 ? "" : "s"} still require attention.`, badge: `${props.permitsOpen} Open`, tone: "warning" } : null,
    props.pendingInspections > 0 ? { label: "Pending inspections", detail: `${props.pendingInspections} inspection${props.pendingInspections === 1 ? "" : "s"} are pending or require follow-up.`, badge: `${props.pendingInspections} Pending`, tone: "warning" } : null,
  ].filter(Boolean) as Array<{ label: string; detail: string; badge: string; tone: string }>;

  return (
    <div className="space-y-4" data-project-overview-command-center>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.1fr_1fr_1fr]">
        <Panel title="Project Snapshot" action={<Link href={`/projects/${props.projectId}/edit`} className={smallAction}>Edit</Link>}>
          <div className="grid gap-5 sm:grid-cols-[150px_1fr]">
            <div className="flex items-center justify-center">
              <div className="relative grid h-32 w-32 place-items-center rounded-full" style={{ background: `conic-gradient(#42a5ff ${progressPercent}%, #0b2039 0)` }}>
                <div className="grid h-24 w-24 place-items-center rounded-full border border-[#21476b] bg-[#071626] text-center">
                  <div><div className="text-3xl font-black text-white">{progressPercent}%</div><div className="text-[11px] font-bold uppercase tracking-[.08em] text-[#9bb4ca]">Complete</div></div>
                </div>
              </div>
            </div>
            <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
              <Detail label="Customer" value={props.customerName} />
              <Detail label="Project Type" value={props.projectType || "Not provided"} />
              <Detail label="Address" value={props.address} />
              <Detail label="Start Date" value={props.startDate} />
              <Detail label="Target Completion" value={props.targetDate} />
              <Detail label="Status" value={props.statusLabel} />
              <Detail label="Project Manager" value={props.projectManager || "Not Assigned"} />
              <Detail label="Superintendent" value="Not Assigned" />
              <Detail label="Contract Value" value={money(props.contractValue || 0, props.localeTag)} />
            </div>
          </div>
        </Panel>

        <Panel title="Schedule & Milestones" action={<Link href={`/projects/${props.projectId}?tab=tasks`} className={smallAction}>View Schedule →</Link>}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Current Status" value={props.statusLabel} sub={`${progressPercent}% complete`} />
            <Metric label="Next Milestone" value={nextTask?.title || "No milestone scheduled"} sub={nextTask?.planned_finish ? formatDate(nextTask.planned_finish, props.localeTag) : "Not Scheduled"} />
          </div>
          <div className="mt-5">
            <div className="flex items-center gap-2">
              {["Planning", "Permits", "Construction", "Final Inspections", "Closeout"].map((label, index) => {
                const filled = index === 0 || (progressPercent >= 25 && index === 1) || (progressPercent >= 50 && index === 2) || (progressPercent >= 80 && index === 3) || progressPercent === 100;
                return <div key={label} className="flex min-w-0 flex-1 items-center gap-2"><span className={`h-4 w-4 shrink-0 rounded-full border ${filled ? "border-[#52b7ff] bg-[#2389ef]" : "border-[#668099] bg-[#0a1c2e]"}`} />{index < 4 ? <span className="h-px flex-1 bg-[#355370]" /> : null}</div>;
              })}
            </div>
            <div className="mt-2 grid grid-cols-5 gap-2 text-center text-[10px] font-bold text-[#a8bfd3]">
              <span>Planning</span><span>Permits</span><span>Construction</span><span>Final Inspections</span><span>Closeout</span>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <Metric label="Days Remaining" value={daysRemaining === null ? "—" : String(daysRemaining)} sub="to target" />
            <Metric label="Schedule Health" value={scheduleHealth} sub={scheduleHealth === "On Track" ? "No current schedule alerts" : "Review open items"} tone={scheduleHealth === "On Track" ? "success" : "warning"} />
            <Metric label="Target Completion" value={props.targetDate} sub={daysRemaining === null ? "Not calculated" : `${daysRemaining} days remaining`} />
          </div>
        </Panel>

        <Panel title="Financial Health" action={<Link href={`/projects/${props.projectId}?tab=financials`} className={smallAction}>View Financials →</Link>}>
          <div className="space-y-2">
            <MoneyRow label="Original Contract" value={originalContract} localeTag={props.localeTag} />
            <MoneyRow label="Approved Change Orders" value={approvedChangeOrders} localeTag={props.localeTag} />
            <MoneyRow label="Revised Contract" value={revisedContract} localeTag={props.localeTag} strong />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1 2xl:grid-cols-3">
            <Metric label="Invoiced" value={money(invoiced, props.localeTag)} sub={revisedContract > 0 ? pct(invoiced / revisedContract) : "0%"} />
            <Metric label="Paid" value={money(paid, props.localeTag)} sub={invoiced > 0 ? pct(paid / invoiced) : "0%"} tone="success" />
            <Metric label="Outstanding" value={money(outstanding, props.localeTag)} sub={invoiced > 0 ? pct(outstanding / invoiced) : "0%"} tone={outstanding > 0 ? "warning" : "default"} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Metric label="Committed Cost" value={money(committed, props.localeTag)} />
            <Metric label="Est. Cost to Complete" value={money(remainingCost, props.localeTag)} />
          </div>
          <div className="mt-3 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-emerald-300">Projected Margin</p>
            <div className="mt-1 flex items-end justify-between gap-3"><span className="text-xl font-black text-emerald-300">{money(grossProfit, props.localeTag)}</span><span className="text-sm font-bold text-emerald-200">{margin === null || margin === undefined ? "—" : `${margin.toFixed(1)}%`}</span></div>
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <Panel title="Today on Site / Workforce" action={<Link href={`/projects/${props.projectId}?tab=crew`} className={smallAction}>Manage Crew</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Metric label="Assigned B.O.S. Crew" value={bosCrewAssignments.length ? String(bosCrewAssignments.length) : "None Assigned"} />
            <Metric label="Trade Partners" value={`${activeTradePartners} Assigned`} sub="View Subcontractors" />
            <Metric label="Trade Partner Crew Size" value={String(tradePartnerCrewSize)} sub="Workers" />
            <Metric label="Workers Expected Onsite" value={String(onsiteToday)} sub="Today" />
            <Metric label="Next Scheduled Mobilization" value={nextMobilization ? formatDate(nextMobilization, props.localeTag) : "Not Scheduled"} />
          </div>
        </Panel>

        <Panel title="Current Work / Next Up" action={<Link href={`/projects/${props.projectId}?tab=tasks`} className={smallAction}>View Tasks →</Link>}>
          <div className="space-y-2">
            <WorkRow kicker="Next Up" title={nextTask?.title || "No active task scheduled"} detail={nextTask?.planned_finish ? `Target ${formatDate(nextTask.planned_finish, props.localeTag)}` : "Create or schedule the next project task."} badge={nextTask ? prettyStatus(nextTask.status) : "Not Scheduled"} />
            <WorkRow kicker="Upcoming Inspection" title={nextInspection?.inspection_type || "No inspection scheduled"} detail={nextInspection?.scheduled_at ? formatDate(nextInspection.scheduled_at, props.localeTag) : "No upcoming inspection date."} badge={nextInspection ? prettyStatus(nextInspection.status) : "Not Scheduled"} />
            <WorkRow kicker="Open Work" title={openTasks[1]?.title || "No additional open task"} detail={openTasks[1]?.planned_finish ? `Target ${formatDate(openTasks[1].planned_finish!, props.localeTag)}` : "Project work will appear here as it is scheduled."} badge={openTasks[1] ? prettyStatus(openTasks[1].status) : "Clear"} />
            <WorkRow kicker="Recent Activity" title={latestActivity[0]?.title || "No recent activity"} detail={latestActivity[0]?.detail || "Updates will appear here as the project changes."} badge={latestActivity[0]?.timestamp || "—"} />
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1fr_.8fr]">
        <Panel title="Risks & Decisions" action={<Link href={`/projects/${props.projectId}?tab=activity`} className={smallAction}>View All →</Link>}>
          <div className="space-y-2">
            {riskRows.length ? riskRows.slice(0, 5).map((risk) => <RiskRow key={risk.label} {...risk} />) : <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4 text-sm font-semibold text-emerald-200">No immediate project risks detected.</div>}
          </div>
        </Panel>

        <Panel title="Project Team" action={<Link href={`/projects/${props.projectId}?tab=crew`} className={smallAction}>Manage Team</Link>}>
          <div className="space-y-2">
            <TeamRow initials={initials(props.customerName)} name={props.customerName} role="Customer" />
            <TeamRow initials={initials(props.projectManager)} name={props.projectManager || "Not Assigned"} role="Project Manager" />
            <TeamRow initials="—" name="Not Assigned" role="Superintendent" />
            {tradePartners.slice(0, 2).map((row) => <TeamRow key={row.id} initials="TP" name={row.trade_name || "Trade Partner"} role="Trade Partner" />)}
          </div>
        </Panel>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[.9fr_1.1fr]">
        <Panel title="Recent Activity" action={<Link href={`/projects/${props.projectId}?tab=activity`} className={smallAction}>View All →</Link>}>
          <div className="space-y-3">
            {latestActivity.length ? latestActivity.map((item) => <div key={item.id} className="grid grid-cols-[10px_1fr_auto] items-start gap-3 border-b border-[#18344e] pb-3 last:border-b-0 last:pb-0"><span className="mt-1.5 h-2.5 w-2.5 rounded-full bg-[#39a7ff]" /><div><p className="text-sm font-bold text-white">{item.title}</p><p className="mt-0.5 text-xs text-[#9fb6c9]">{item.detail}</p></div><span className="text-right text-[11px] font-semibold text-[#7896ad]">{item.timestamp}</span></div>) : <p className="text-sm text-[#9fb6c9]">No recent project activity.</p>}
          </div>
        </Panel>

        <Panel title="Recent Photos" action={<Link href={`/projects/${props.projectId}?tab=photos`} className={smallAction}>View All →</Link>}>
          {props.heroImageUrl ? <div className="grid gap-3 sm:grid-cols-[1.4fr_.6fr]"><img src={props.heroImageUrl} alt={`${props.projectName} latest project photo`} className="h-44 w-full rounded-xl border border-[#21405c] object-cover" /><div className="grid place-items-center rounded-xl border border-[#21405c] bg-[#071827] p-4 text-center"><div><p className="text-3xl font-black text-white">{props.photoCount}</p><p className="mt-1 text-xs font-bold uppercase tracking-[.08em] text-[#8daac0]">Project Photos</p></div></div></div> : <div className="grid min-h-44 place-items-center rounded-xl border border-dashed border-[#31516c] bg-[#071827] p-6 text-center"><div><p className="text-base font-bold text-white">No project photos yet</p><p className="mt-1 text-sm text-[#91aabd]">Field photos will appear here automatically.</p></div></div>}
        </Panel>
      </div>
    </div>
  );
}

const panelClass = "rounded-[18px] border border-[#1d4261] bg-[linear-gradient(180deg,#071827,#061320)] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,.035),0_10px_30px_rgba(0,0,0,.12)] sm:p-5";
const smallAction = "inline-flex min-h-8 items-center justify-center rounded-lg border border-[#28577c] bg-[#0a2035] px-3 text-xs font-bold text-[#cfe9ff] transition hover:border-[#3c83b9] hover:bg-[#0d2b47]";

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className={panelClass}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-base font-extrabold tracking-[-.01em] text-white">{title}</h2>{action}</div>{children}</section>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#7898b0]">{label}</p><p className="mt-1 break-words text-sm font-bold leading-5 text-[#eef8ff]">{value}</p></div>;
}

function Metric({ label, value, sub, tone = "default" }: { label: string; value: string; sub?: string; tone?: "default" | "success" | "warning" }) {
  const valueClass = tone === "success" ? "text-emerald-300" : tone === "warning" ? "text-amber-300" : "text-white";
  return <div className="rounded-xl border border-[#1c3e5b] bg-[#081b2d] p-3"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#7f9eb5]">{label}</p><p className={`mt-1 text-sm font-black leading-5 ${valueClass}`}>{value}</p>{sub ? <p className="mt-1 text-[11px] font-semibold text-[#8fa8bc]">{sub}</p> : null}</div>;
}

function MoneyRow({ label, value, localeTag, strong = false }: { label: string; value: number; localeTag: string; strong?: boolean }) {
  return <div className={`flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 ${strong ? "border-t border-[#23455f] pt-3" : ""}`}><span className="text-xs font-semibold text-[#9fb6c9]">{label}</span><span className="text-sm font-black text-white">{money(value, localeTag)}</span></div>;
}

function WorkRow({ kicker, title, detail, badge }: { kicker: string; title: string; detail: string; badge: string }) {
  return <div className="flex items-start justify-between gap-3 rounded-xl border border-[#193b57] bg-[#081a2b] p-3"><div className="min-w-0"><p className="text-[10px] font-extrabold uppercase tracking-[.08em] text-[#48b8ff]">{kicker}</p><p className="mt-0.5 text-sm font-extrabold text-white">{title}</p><p className="mt-0.5 text-xs leading-5 text-[#90a9bd]">{detail}</p></div><span className="shrink-0 rounded-full border border-[#385a73] bg-[#0b2237] px-2 py-1 text-[10px] font-extrabold text-[#d9ecf9]">{badge}</span></div>;
}

function RiskRow({ label, detail, badge, tone }: { label: string; detail: string; badge: string; tone: string }) {
  const badgeClass = tone === "danger" ? "border-red-400/35 bg-red-400/10 text-red-200" : "border-amber-400/35 bg-amber-400/10 text-amber-200";
  return <div className="flex items-start justify-between gap-3 rounded-xl border border-[#193b57] bg-[#081a2b] p-3"><div className="min-w-0"><p className="text-sm font-extrabold text-white">{label}</p><p className="mt-0.5 text-xs leading-5 text-[#90a9bd]">{detail}</p></div><span className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-extrabold ${badgeClass}`}>{badge}</span></div>;
}

function TeamRow({ initials: avatar, name, role }: { initials: string; name: string; role: string }) {
  return <div className="grid grid-cols-[38px_1fr] items-center gap-3 rounded-xl border border-[#193b57] bg-[#081a2b] p-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-[#1678d2] text-xs font-black text-white">{avatar}</span><div><p className="text-sm font-extrabold text-white">{name}</p><p className="text-xs font-semibold text-[#8fa8bc]">{role}</p></div></div>;
}

function normalizeStatus(status: string) { return status.trim().toLowerCase().replace(/\s+/g, "_"); }
function prettyStatus(status: string) { return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function money(value: number, localeTag: string) { return new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0)); }
function pct(value: number) { return `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`; }
function formatDate(value: string, localeTag: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : new Intl.DateTimeFormat(localeTag, { month: "short", day: "numeric", year: "numeric" }).format(d); }
function initials(value: string) { return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("") || "—"; }
function blockerCount(value: unknown) { return Array.isArray(value) ? value.length : 0; }
function computeDaysRemaining(targetLabel: string) {
  const target = new Date(targetLabel);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86400000));
}
