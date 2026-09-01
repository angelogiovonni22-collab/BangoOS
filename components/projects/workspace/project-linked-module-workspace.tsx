"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileText, HardHat, MessageSquareText, Plus, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

export type ProjectLinkedModuleTab = "daily_logs" | "documents" | "crew" | "change_orders" | "rfis" | "submittals";

type ProjectLinkedModuleWorkspaceProps = {
  projectId: string;
  projectName?: string;
  tab: ProjectLinkedModuleTab;
  localeTag: string;
};

type ModuleRecord = {
  id: string;
  title: string;
  detail: string;
  status?: string;
  timestamp?: string | null;
  href?: string | null;
};

type ModuleState = {
  loading: boolean;
  error: string | null;
  records: ModuleRecord[];
  counts?: Array<{ label: string; value: number; href: string }>;
};

const INITIAL_STATE: ModuleState = { loading: true, error: null, records: [] };

const moduleMeta: Record<ProjectLinkedModuleTab, { title: string; description: string; empty: string }> = {
  daily_logs: {
    title: "Daily Logs",
    description: "Project-specific field reports and daily operating history.",
    empty: "No daily reports have been logged for this project yet.",
  },
  documents: {
    title: "Documents",
    description: "One project document center across the records already managed by BangoOS.",
    empty: "No linked project records are available yet.",
  },
  crew: {
    title: "Crew",
    description: "Live workforce assignments connected to this project.",
    empty: "No crew or employee assignments are connected to this project yet.",
  },
  change_orders: {
    title: "Change Orders",
    description: "Project change orders, status, value, and direct access to the full change-order workflow.",
    empty: "No change orders exist for this project yet.",
  },
  rfis: {
    title: "RFIs",
    description: "Project requests for information captured through the project communications record.",
    empty: "No RFIs have been recorded for this project yet.",
  },
  submittals: { title: "Submittals", description: "Project submittal register with review status and due dates.", empty: "No submittals have been recorded for this project yet." },
};

export function ProjectLinkedModuleWorkspace({ projectId, projectName, tab, localeTag }: ProjectLinkedModuleWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [reloadToken, setReloadToken] = useState(0);
  const [state, setState] = useState<ModuleState>(INITIAL_STATE);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDiscipline, setNewDiscipline] = useState("General");
  const [newDueDate, setNewDueDate] = useState("");
  const meta = moduleMeta[tab];

  const canCreateRegisterRecord = tab === "rfis" || tab === "submittals";

  const handleCreateRegisterRecord = async () => {
    const title = newTitle.trim();
    if (!title || isCreating || !supabase || !canCreateRegisterRecord) return;

    setIsCreating(true);
    setCreateError(null);
    const workspace = await resolveWorkspaceContext(supabase);

    if (!workspace.context) {
      setCreateError(workspace.errorMessage || "Unable to create this project record.");
      setIsCreating(false);
      return;
    }

    const db = supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message?: string } | null }>;
    };
    const response = tab === "rfis"
      ? await db.rpc("create_project_rfi", {
          p_company_id: workspace.context.companyId,
          p_project_id: projectId,
          p_title: title,
          p_message: newDescription.trim() || title,
        })
      : await db.rpc("create_project_submittal", {
          p_company_id: workspace.context.companyId,
          p_project_id: projectId,
          p_title: title,
          p_description: newDescription.trim() || null,
          p_discipline: newDiscipline.trim() || "General",
          p_due_date: newDueDate || null,
        });

    setIsCreating(false);
    if (response.error) {
      setCreateError(response.error.message || "Unable to create this project record.");
      return;
    }

    setNewTitle("");
    setNewDescription("");
    setNewDiscipline("General");
    setNewDueDate("");
    setIsCreateOpen(false);
    setReloadToken((value) => value + 1);
  };

  useEffect(() => {
    let subscribed = true;

    const load = async () => {
      setState(INITIAL_STATE);
      const workspace = await resolveWorkspaceContext(supabase);

      if (!supabase || !workspace.context) {
        if (subscribed) {
          setState({ loading: false, error: workspace.errorMessage || "Unable to load this project module.", records: [] });
        }
        return;
      }

      const db = supabase as unknown as {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        from: (table: string) => any;
      };
      const companyId = workspace.context.companyId;

      try {
        let nextState: ModuleState;

        if (tab === "daily_logs") {
          const response = await db
            .from("workflow_events")
            .select("id, occurred_at, created_at, payload")
            .eq("company_id", companyId)
            .eq("reference_entity", "daily_report")
            .eq("event_type", "daily_report.created")
            .eq("payload->>project_id", projectId)
            .order("occurred_at", { ascending: false })
            .limit(100);

          if (response.error) throw response.error;
          const records = (response.data ?? []).map((row: Record<string, unknown>) => {
            const payload = isObject(row.payload) ? row.payload : {};
            const reportId = stringValue(payload.report_id) || stringValue(row.id);
            const reportDate = stringValue(payload.report_date) || stringValue(row.occurred_at) || stringValue(row.created_at);
            const author = stringValue(payload.employee_name) || stringValue(payload.author_name) || "Field report";
            return {
              id: stringValue(row.id),
              title: reportDate ? `Daily report · ${formatDate(reportDate, localeTag)}` : "Daily report",
              detail: author,
              timestamp: reportDate,
              href: reportId ? `/daily-reports/${reportId}` : "/daily-reports",
            } satisfies ModuleRecord;
          });
          nextState = { loading: false, error: null, records };
        } else if (tab === "crew") {
          const assignmentResponse = await db
            .from("workforce_assignments")
            .select("id, title, status, starts_at, ends_at, crew_id, employee_id")
            .eq("company_id", companyId)
            .eq("project_id", projectId)
            .order("starts_at", { ascending: false })
            .limit(100);

          if (assignmentResponse.error) throw assignmentResponse.error;
          const assignments = assignmentResponse.data ?? [];
          const crewIds = [...new Set(assignments.map((row: Record<string, unknown>) => stringValue(row.crew_id)).filter(Boolean))];
          const crewNames = new Map<string, string>();

          if (crewIds.length) {
            const crewResponse = await db.from("crews").select("id, name").eq("company_id", companyId).in("id", crewIds);
            if (!crewResponse.error) {
              for (const row of crewResponse.data ?? []) {
                crewNames.set(stringValue(row.id), stringValue(row.name) || "Crew");
              }
            }
          }

          const records = assignments.map((row: Record<string, unknown>) => {
            const crewId = stringValue(row.crew_id);
            const title = stringValue(row.title) || (crewId ? crewNames.get(crewId) : "Assigned employee") || "Workforce assignment";
            const status = stringValue(row.status) || "assigned";
            const startsAt = stringValue(row.starts_at);
            const endsAt = stringValue(row.ends_at);
            const detail = [crewId ? crewNames.get(crewId) : null, startsAt ? `Starts ${formatDate(startsAt, localeTag)}` : null, endsAt ? `Ends ${formatDate(endsAt, localeTag)}` : null]
              .filter(Boolean)
              .join(" · ");
            return {
              id: stringValue(row.id),
              title,
              detail: detail || "Project workforce assignment",
              status,
              timestamp: startsAt,
              href: crewId ? `/crews/${crewId}` : "/employees",
            } satisfies ModuleRecord;
          });
          nextState = { loading: false, error: null, records };
        } else if (tab === "change_orders") {
          const response = await db
            .from("change_orders")
            .select("id, change_order_number, title, status, total_amount, requested_date, created_at")
            .eq("company_id", companyId)
            .eq("project_id", projectId)
            .order("created_at", { ascending: false })
            .limit(100);

          if (response.error) throw response.error;
          const records = (response.data ?? []).map((row: Record<string, unknown>) => {
            const id = stringValue(row.id);
            const number = stringValue(row.change_order_number);
            const title = stringValue(row.title) || "Change order";
            const amount = numberValue(row.total_amount);
            return {
              id,
              title: number ? `${number} · ${title}` : title,
              detail: formatCurrency(amount, localeTag),
              status: stringValue(row.status) || "draft",
              timestamp: stringValue(row.requested_date) || stringValue(row.created_at),
              href: `/change-orders/${id}`,
            } satisfies ModuleRecord;
          });
          nextState = { loading: false, error: null, records };
        } else if (tab === "submittals") {
          const response = await db.from("project_submittals").select("id, submittal_number, title, discipline, status, due_date, created_at").eq("company_id", companyId).eq("project_id", projectId).order("submittal_number", { ascending: false }).limit(100);
          if (response.error) throw response.error;
          const records = (response.data ?? []).map((row: Record<string, unknown>) => ({ id: stringValue(row.id), title: `SUB-${String(row.submittal_number).padStart(4, "0")} · ${stringValue(row.title) || "Submittal"}`, detail: [stringValue(row.discipline), row.due_date ? `Due ${formatDate(stringValue(row.due_date), localeTag)}` : ""].filter(Boolean).join(" · "), status: stringValue(row.status) || "draft", timestamp: stringValue(row.created_at), href: null } satisfies ModuleRecord));
          nextState = { loading: false, error: null, records };
        } else if (tab === "rfis") {
          const response = await db
            .from("project_communications")
            .select("id, subject, status, channel, created_at")
            .eq("company_id", companyId)
            .eq("project_id", projectId)
            .eq("channel", "rfi")
            .order("created_at", { ascending: false })
            .limit(100);

          if (response.error) throw response.error;
          const records = (response.data ?? []).map((row: Record<string, unknown>) => ({
            id: stringValue(row.id),
            title: stringValue(row.subject) || "Request for information",
            detail: "Project RFI communication",
            status: stringValue(row.status) || "open",
            timestamp: stringValue(row.created_at),
            href: null,
          } satisfies ModuleRecord));
          nextState = { loading: false, error: null, records };
        } else {
          const queries = await Promise.all([
            db.from("workflow_events").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("reference_entity", "daily_report").eq("event_type", "daily_report.created").eq("payload->>project_id", projectId),
            db.from("project_photos").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("project_id", projectId),
            db.from("change_orders").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("project_id", projectId),
            db.from("project_permits").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("project_id", projectId),
            db.from("project_inspections").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("project_id", projectId),
            db.from("estimates").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("project_id", projectId),
          ]);
          const labels = [
            ["Daily Reports", "/daily-reports"],
            ["Photos", `/projects/${projectId}?tab=photos`],
            ["Change Orders", `/projects/${projectId}?tab=change_orders`],
            ["Permits", `/projects/${projectId}?tab=inspections`],
            ["Inspections", `/projects/${projectId}?tab=inspections`],
            ["Estimates", "/estimates"],
          ] as const;
          const counts = labels.map(([label, href], index) => ({ label, href, value: queries[index]?.count || 0 }));
          nextState = { loading: false, error: null, records: [], counts };
        }

        if (subscribed) setState(nextState);
      } catch (error) {
        console.error(`Project ${tab} workspace load error:`, error);
        if (subscribed) setState({ loading: false, error: `Unable to load ${meta.title.toLowerCase()} right now.`, records: [] });
      }
    };

    void load();
    return () => {
      subscribed = false;
    };
  }, [localeTag, meta.title, projectId, reloadToken, supabase, tab]);

  const primaryHref = tab === "daily_logs"
    ? `/daily-reports/new?projectId=${encodeURIComponent(projectId)}${projectName ? `&projectName=${encodeURIComponent(projectName)}` : ""}`
    : tab === "change_orders"
      ? `/change-orders/new?projectId=${encodeURIComponent(projectId)}`
      : tab === "crew"
        ? "/crews"
        : null;
  const primaryLabel = tab === "daily_logs" ? "Create Report" : tab === "change_orders" ? "Create Change Order" : tab === "crew" ? "Open CrewOS" : null;

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-[18px] border border-[var(--bos-border-light)] bg-white p-5 shadow-[var(--bos-shadow-workspace-card)]">
        <div className="min-w-0">
          <p className="text-xl font-bold text-[var(--bos-text-strong-on-light)]">{meta.title}</p>
          <p className="mt-1 max-w-3xl text-sm text-[var(--bos-text-medium-on-light)]">{meta.description}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setReloadToken((value) => value + 1)}>
            <RefreshCw size={14} aria-hidden="true" />
            Refresh
          </Button>
          {primaryHref && primaryLabel ? (
            <Link href={primaryHref} className={getButtonClassName({ size: "sm" })}>{primaryLabel}</Link>
          ) : null}
          {canCreateRegisterRecord ? (
            <Button size="sm" onClick={() => setIsCreateOpen((value) => !value)}>
              {isCreateOpen ? <X size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
              {isCreateOpen ? "Close" : tab === "rfis" ? "Create RFI" : "Create Submittal"}
            </Button>
          ) : null}
        </div>
      </div>

      {isCreateOpen && canCreateRegisterRecord ? (
        <div className="grid gap-3 rounded-[16px] border border-[var(--bos-border-light)] bg-white p-4 shadow-[var(--bos-shadow-workspace-card)] md:grid-cols-2">
          <label className="space-y-1.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)]">
            <span>Title</span>
            <input value={newTitle} onChange={(event) => setNewTitle(event.target.value)} className={registerInputClass} placeholder={tab === "rfis" ? "Clarification needed" : "Product data submittal"} />
          </label>
          {tab === "submittals" ? (
            <>
              <label className="space-y-1.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)]"><span>Discipline</span><input value={newDiscipline} onChange={(event) => setNewDiscipline(event.target.value)} className={registerInputClass} /></label>
              <label className="space-y-1.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)]"><span>Due date</span><input type="date" value={newDueDate} onChange={(event) => setNewDueDate(event.target.value)} className={registerInputClass} /></label>
            </>
          ) : null}
          <label className="space-y-1.5 text-sm font-semibold text-[var(--bos-text-strong-on-light)] md:col-span-2">
            <span>{tab === "rfis" ? "Question / context" : "Description"}</span>
            <textarea value={newDescription} onChange={(event) => setNewDescription(event.target.value)} className={`${registerInputClass} min-h-24 py-2.5`} />
          </label>
          {createError ? <p className="text-sm font-semibold text-[var(--color-danger-700)] md:col-span-2">{createError}</p> : null}
          <div className="flex justify-end md:col-span-2"><Button disabled={!newTitle.trim() || isCreating} onClick={() => void handleCreateRegisterRecord()}>{isCreating ? "Creating..." : tab === "rfis" ? "Create RFI" : "Create Submittal"}</Button></div>
        </div>
      ) : null}

      {state.loading ? <LoadingState /> : state.error ? <ErrorState message={state.error} /> : tab === "documents" ? (
        <DocumentIndex counts={state.counts ?? []} />
      ) : state.records.length ? (
        <RecordList records={state.records} localeTag={localeTag} tab={tab} />
      ) : (
        <EmptyState message={meta.empty} tab={tab} />
      )}
    </section>
  );
}

const registerInputClass = "h-10 w-full rounded-[10px] border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3 text-sm font-medium text-[var(--bos-text-primary)] outline-none focus:border-[var(--orion-blue)] focus:ring-4 focus:ring-[var(--focus-ring-primary)]";

function RecordList({ records, localeTag, tab }: { records: ModuleRecord[]; localeTag: string; tab: ProjectLinkedModuleTab }) {
  const icon = tab === "daily_logs" ? <ClipboardList size={17} /> : tab === "crew" ? <HardHat size={17} /> : tab === "rfis" ? <MessageSquareText size={17} /> : <FileText size={17} />;
  return (
    <div className="grid gap-3">
      {records.map((record) => (
        <article key={record.id} className="rounded-[16px] border border-[var(--bos-border-light)] bg-white p-4 shadow-[var(--bos-shadow-workspace-card)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-[var(--color-neutral-50)] text-[var(--bos-text-medium-on-light)]">{icon}</span>
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-[var(--bos-text-strong-on-light)]">{record.title}</p>
                <p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">{record.detail}</p>
                {record.timestamp ? <p className="mt-2 text-xs text-[var(--bos-text-medium-on-light)]">{formatDate(record.timestamp, localeTag)}</p> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {record.status ? <span className="rounded-full border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-2.5 py-1 text-xs font-semibold capitalize text-[var(--bos-text-medium-on-light)]">{record.status.replaceAll("_", " ")}</span> : null}
              {record.href ? <Link href={record.href} className="text-sm font-bold text-[var(--color-brand-700)] hover:underline">View</Link> : null}
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function DocumentIndex({ counts }: { counts: Array<{ label: string; value: number; href: string }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {counts.map((item) => (
        <Link key={item.label} href={item.href} className="rounded-[16px] border border-[var(--bos-border-light)] bg-white p-4 shadow-[var(--bos-shadow-workspace-card)] transition hover:-translate-y-0.5 hover:border-[var(--color-brand-300)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-[var(--bos-text-strong-on-light)]">{item.label}</p>
              <p className="mt-1 text-xs text-[var(--bos-text-medium-on-light)]">Open linked project records</p>
            </div>
            <span className="text-2xl font-bold text-[var(--bos-text-strong-on-light)]">{item.value}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function LoadingState() {
  return <div className="h-28 animate-pulse rounded-[16px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)]" />;
}

function ErrorState({ message }: { message: string }) {
  return <div className="rounded-[16px] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] p-4 text-sm font-semibold text-[var(--color-danger-700)]">{message}</div>;
}

function EmptyState({ message, tab }: { message: string; tab: ProjectLinkedModuleTab }) {
  const icon = tab === "crew" ? <HardHat size={18} /> : tab === "rfis" ? <MessageSquareText size={18} /> : <FileText size={18} />;
  return (
    <div className="rounded-[16px] border border-dashed border-[var(--bos-border-light-strong)] bg-[var(--color-neutral-50)] p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">{icon}</span>
        <p className="pt-2 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{message}</p>
      </div>
    </div>
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatDate(value: string, localeTag: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(localeTag, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function formatCurrency(value: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);
}
