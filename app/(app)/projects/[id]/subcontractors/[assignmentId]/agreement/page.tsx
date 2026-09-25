import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

const money = (value: number | null) =>
  value == null
    ? "Not provided"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

const dateTime = (value: string | null) =>
  value ? new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeStyle: "short" }).format(new Date(value)) : "Not recorded";

export default async function ProjectSubcontractAgreementPage({
  params,
}: {
  params: Promise<{ id: string; assignmentId: string }>;
}) {
  const { id: projectId, assignmentId } = await params;
  const supabase = await createClient();
  if (!supabase) return <AgreementError message="B.O.S. database is unavailable." />;

  const workspace = await resolveWorkspaceContext(supabase as SupabaseClient<Database>);
  if (!workspace.context) redirect("/login");

  const companyId = workspace.context.companyId;
  const [assignmentResult, authorizationResult] = await Promise.all([
    supabase
      .from("trade_partner_assignments")
      .select("id,vendor_id,trade_name,scope_of_work,contract_amount,payment_terms,retainage_percent,start_date,target_completion_date,contract_status")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("id", assignmentId)
      .maybeSingle(),
    supabase
      .from("project_subcontract_work_authorizations")
      .select("id,master_agreement_id,status,scope_of_work,contract_amount,payment_terms,retainage_percent,start_date,target_completion_date,signer_name,signer_title,signer_email,signed_at,sent_at")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!assignmentResult.data) notFound();
  const assignment = assignmentResult.data;
  const authorization = authorizationResult.data;

  const [projectResult, vendorResult, masterResult] = await Promise.all([
    supabase.from("projects").select("name,project_number").eq("company_id", companyId).eq("id", projectId).maybeSingle(),
    supabase.from("vendors").select("display_name,company_name").eq("company_id", companyId).eq("id", assignment.vendor_id).maybeSingle(),
    authorization?.master_agreement_id
      ? supabase
          .from("subcontractor_master_agreements")
          .select("status,agreement_version,signer_name,signer_title,signer_email,signed_at")
          .eq("company_id", companyId)
          .eq("id", authorization.master_agreement_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const vendorName = vendorResult.data?.display_name || vendorResult.data?.company_name || "Trade Partner";
  const projectName = projectResult.data?.name || "Project";
  const master = masterResult.data;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--color-primary-700)]">Signed Subcontract Record</p>
          <h1 className="mt-1 text-2xl font-black text-[var(--bos-text-strong-on-light)]">{vendorName}</h1>
          <p className="mt-1 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">{projectName}{projectResult.data?.project_number ? ` · ${projectResult.data.project_number}` : ""}</p>
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
  return (
    <div className="rounded-xl border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2.5">
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-[var(--bos-text-medium-on-light)]">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm font-bold text-[var(--bos-text-strong-on-light)]">{value}</p>
    </div>
  );
}

function AgreementError({ message }: { message: string }) {
  return <div className="mx-auto mt-10 max-w-xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{message}</div>;
}

function pretty(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
