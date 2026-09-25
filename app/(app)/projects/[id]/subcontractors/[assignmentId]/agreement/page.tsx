import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type Assignment = {
  id: string; vendor_id: string; trade_name: string; scope_of_work: string | null; contract_amount: number | null;
  payment_terms: string | null; retainage_percent: number | null; start_date: string | null; target_completion_date: string | null;
  contract_status: string;
};
type Authorization = {
  id: string; master_agreement_id: string | null; status: string; scope_of_work: string | null; contract_amount: number | null;
  payment_terms: string | null; retainage_percent: number | null; start_date: string | null; target_completion_date: string | null;
  signer_name: string | null; signer_title: string | null; signer_email: string | null; signed_at: string | null;
};
type Master = { status: string; agreement_version: string | null; signer_name: string | null; signer_title: string | null; signer_email: string | null; signed_at: string | null };
type Project = { name: string; project_number: string | null };
type Vendor = { display_name: string | null; company_name: string | null };

const money = (value: number | null) => value == null ? "Not provided" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)) : "Not recorded";

export default async function ProjectSubcontractAgreementPage({ params }: { params: Promise<{ id: string; assignmentId: string }> }) {
  const { id: projectId, assignmentId } = await params;
  const supabase = await createClient();
  if (!supabase) return <AgreementError message="B.O.S. database is unavailable." />;

  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) redirect("/login");
  const companyId = workspace.context.companyId;

  const assignmentResult = await supabase
    .from("trade_partner_assignments" as never)
    .select("*")
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .eq("id", assignmentId)
    .maybeSingle();
  const assignment = assignmentResult.data as unknown as Assignment | null;
  if (!assignment) notFound();

  const authorizationResult = await supabase
    .from("project_subcontract_work_authorizations" as never)
    .select("*")
    .eq("company_id", companyId)
    .eq("project_id", projectId)
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const authorization = authorizationResult.data as unknown as Authorization | null;

  const [projectResult, vendorResult, masterResult] = await Promise.all([
    supabase.from("projects").select("name,project_number").eq("company_id", companyId).eq("id", projectId).maybeSingle(),
    supabase.from("vendors").select("display_name,company_name").eq("company_id", companyId).eq("id", assignment.vendor_id).maybeSingle(),
    authorization?.master_agreement_id
      ? supabase.from("subcontractor_master_agreements" as never).select("*").eq("company_id", companyId).eq("id", authorization.master_agreement_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const project = projectResult.data as Project | null;
  const vendor = vendorResult.data as Vendor | null;
  const master = masterResult.data as unknown as Master | null;
  const vendorName = vendor?.display_name || vendor?.company_name || "Trade Partner";
  const projectName = project?.name || "Project";

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-primary-700)]">Signed Subcontract Record</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--bos-text-strong-on-light)]">{vendorName}</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{projectName}{project?.project_number ? ` · ${project.project_number}` : ""}</p>
        </div>
        <Link href={`/projects/${projectId}?tab=subcontractors`} className="rounded-lg border border-[var(--bos-border-light)] px-3 py-2 text-sm font-black text-[var(--bos-text-strong-on-light)]">Back to Subcontractors</Link>
      </div>

      <section className="rounded-2xl border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-5 shadow-[var(--shadow-small)]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Info label="Project Work Authorization" value={authorization?.status ? pretty(authorization.status) : pretty(assignment.contract_status)} />
          <Info label="Master Agreement" value={master?.status ? pretty(master.status) : "Not recorded"} />
          <Info label="Subcontract Amount" value={money(Number(authorization?.contract_amount ?? assignment.contract_amount ?? 0))} />
          <Info label="Signed At" value={dateTime(authorization?.signed_at || null)} />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-5 shadow-[var(--shadow-small)]">
        <h2 className="text-lg font-black text-[var(--bos-text-strong-on-light)]">Project Work Authorization</h2>
        <div className="mt-4 grid gap-3">
          <Info label="Trade" value={assignment.trade_name} />
          <Info label="Scope of Work" value={authorization?.scope_of_work || assignment.scope_of_work || "Not provided"} />
          <Info label="Payment Terms" value={authorization?.payment_terms || assignment.payment_terms || "Not provided"} />
          <Info label="Retainage" value={authorization?.retainage_percent == null && assignment.retainage_percent == null ? "Not specified" : `${Number(authorization?.retainage_percent ?? assignment.retainage_percent)}%`} />
          <Info label="Schedule" value={[authorization?.start_date || assignment.start_date, authorization?.target_completion_date || assignment.target_completion_date].filter(Boolean).join(" → ") || "Not scheduled"} />
          <Info label="Signer" value={[authorization?.signer_name, authorization?.signer_title].filter(Boolean).join(" · ") || "Not recorded"} />
          <Info label="Signer Email" value={authorization?.signer_email || "Not recorded"} />
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--bos-border-light)] bg-[var(--bos-bg-workspace-surface)] p-5 shadow-[var(--shadow-small)]">
        <h2 className="text-lg font-black text-[var(--bos-text-strong-on-light)]">Master Subcontract Agreement</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Info label="Status" value={master?.status ? pretty(master.status) : "Not recorded"} />
          <Info label="Agreement Version" value={master?.agreement_version || "Not recorded"} />
          <Info label="Signer" value={[master?.signer_name, master?.signer_title].filter(Boolean).join(" · ") || "Not recorded"} />
          <Info label="Signed At" value={dateTime(master?.signed_at || null)} />
        </div>
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5"><p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p><p className="mt-1 whitespace-pre-wrap text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p></div>;
}
function AgreementError({ message }: { message: string }) { return <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{message}</div>; }
function pretty(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase()); }
