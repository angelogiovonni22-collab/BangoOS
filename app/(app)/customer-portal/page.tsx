import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type CustomerProject = {
  project_id: string;
  project_name: string;
  project_status: string;
  address_line_1: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  estimated_start_date: string | null;
  estimated_end_date: string | null;
};
type RpcClient = { rpc: (name: string) => Promise<{ data: CustomerProject[] | null; error: { message: string } | null }> };

export default async function CustomerPortalPage() {
  const supabase = await createClient();
  if (!supabase) redirect("/login");
  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) redirect("/login");
  if ((workspace.context.role || "").toLowerCase() !== "customer") redirect("/app-entry");

  const { data, error } = await (supabase as unknown as RpcClient).rpc("get_my_customer_projects");
  const projects = data ?? [];

  return (
    <div className="container-content space-y-6">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ec3ff]">B.O.S. Customer Portal</p>
        <h1 className="mt-2 text-2xl font-semibold">My Project</h1>
        <p className="mt-2 max-w-3xl text-sm text-[var(--bos-text-secondary)]">View the project information shared with you by the construction team. Internal B.O.S. company operations and financial records remain private.</p>
      </section>
      {error ? <section className="rounded-2xl border border-amber-300/40 bg-amber-50 p-5 text-sm text-amber-900">Your customer login needs to be linked to a customer record by a B.O.S. administrator.</section> : projects.length === 0 ? <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 text-sm text-[var(--bos-text-secondary)]">No project is linked to this account yet.</section> : <div className="grid gap-4 lg:grid-cols-2">{projects.map((project) => <article key={project.project_id} className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="text-lg font-semibold">{project.project_name}</h2><span className="rounded-full border border-[var(--bos-border-default)] px-3 py-1 text-xs font-semibold">{formatLabel(project.project_status)}</span></div><p className="mt-3 text-sm text-[var(--bos-text-secondary)]">{formatAddress(project)}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><Info label="Estimated start" value={formatDate(project.estimated_start_date)} /><Info label="Estimated completion" value={formatDate(project.estimated_end_date)} /></div></article>)}</div>}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>; }
function formatDate(value: string | null) { if (!value) return "Not scheduled"; const date = new Date(`${value}T00:00:00`); return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date); }
function formatLabel(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatAddress(project: CustomerProject) { return [project.address_line_1, project.city, project.state, project.postal_code].filter(Boolean).join(", ") || "Project address not published"; }
