"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, FileCheck2, Printer, ShieldCheck } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, SkeletonLoader, getButtonClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { formatUsd } from "@/lib/estimates/calculations";
import { loadEstimateById, loadEstimateFormOptions, getCustomerDisplayName, getProjectDisplayName } from "@/lib/estimates/service";
import type { EstimateLineItemRow, EstimateRow } from "@/lib/estimates/types";
import type { ConstructionAgreementSection } from "@/lib/estimates/construction-agreement";

type SignatureRecord = {
  id: string;
  typed_name: string;
  signed_at: string;
  consent_accepted: boolean;
  verification_result: string;
  signature_hash: string;
  estimate_version_number: number;
  agreement_version_id: string;
};

type AgreementRecord = {
  version_number: number;
  agreement_hash: string;
  agreement_snapshot: Record<string, unknown>;
  source_terms: string | null;
  source_payment_terms: string | null;
};

export function SignedAgreementViewer({ estimateId }: { estimateId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [lineItems, setLineItems] = useState<EstimateLineItemRow[]>([]);
  const [customerName, setCustomerName] = useState("Customer");
  const [projectName, setProjectName] = useState("Project");
  const [signature, setSignature] = useState<SignatureRecord | null>(null);
  const [agreement, setAgreement] = useState<AgreementRecord | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      if (!supabase) return;
      const workspace = await resolveWorkspaceContext(supabase);
      if (!workspace.context) {
        if (active) { setError(workspace.errorMessage || "Unable to resolve workspace."); setLoading(false); }
        return;
      }
      try {
        const companyId = workspace.context.companyId;
        const estimateResult = await loadEstimateById(supabase, companyId, estimateId);
        if (estimateResult.error || !estimateResult.data) throw new Error(estimateResult.error || "Estimate not found.");
        const db = supabase as unknown as { from: (table: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any
        const signatureResult = await db.from("estimate_signatures")
          .select("id, typed_name, signed_at, consent_accepted, verification_result, signature_hash, estimate_version_number, agreement_version_id")
          .eq("company_id", companyId).eq("estimate_id", estimateId).eq("verification_result", "verified")
          .order("signed_at", { ascending: false }).limit(1).maybeSingle();
        if (signatureResult.error) throw signatureResult.error;
        if (!signatureResult.data) throw new Error("No verified customer signature is recorded for this agreement.");
        const agreementResult = await db.from("estimate_agreement_versions")
          .select("version_number, agreement_hash, agreement_snapshot, source_terms, source_payment_terms")
          .eq("company_id", companyId).eq("id", signatureResult.data.agreement_version_id).maybeSingle();
        if (agreementResult.error || !agreementResult.data) throw new Error(agreementResult.error?.message || "Signed agreement snapshot is unavailable.");
        const options = await loadEstimateFormOptions(supabase, companyId);
        if (!active) return;
        setEstimate(estimateResult.data.estimate);
        setLineItems(estimateResult.data.lineItems);
        setSignature(signatureResult.data as SignatureRecord);
        setAgreement(agreementResult.data as AgreementRecord);
        if (options.data) {
          const customer = options.data.customers.find((row) => row.id === estimateResult.data?.estimate.customer_id);
          const project = options.data.projects.find((row) => row.id === estimateResult.data?.estimate.project_id || row.id === estimateResult.data?.estimate.converted_project_id);
          setCustomerName(customer ? getCustomerDisplayName(customer) : "Customer");
          setProjectName(project ? getProjectDisplayName(project) : estimateResult.data.estimate.title);
        }
        setLoading(false);
      } catch (caught) {
        if (active) { setError(caught instanceof Error ? caught.message : "Unable to load signed agreement."); setLoading(false); }
      }
    };
    void load();
    return () => { active = false; };
  }, [estimateId, supabase]);

  if (loading) return <div className="space-y-4"><SkeletonLoader className="h-24 w-full" /><SkeletonLoader className="h-80 w-full" /></div>;
  if (error || !estimate || !signature || !agreement) return <ErrorState title="Unable to open signed agreement" description={error || "Signed agreement not found."} />;

  const snapshot = agreement.agreement_snapshot || {};
  const construction = (snapshot.constructionAgreement || {}) as { version?: string; sections?: ConstructionAgreementSection[] };
  const sections = Array.isArray(construction.sections) ? construction.sections : [];
  const projectId = estimate.converted_project_id || estimate.project_id;

  return (
    <div className="mx-auto max-w-5xl space-y-5 print:max-w-none print:space-y-3" data-testid="signed-agreement-viewer">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        {projectId ? <Link href={`/projects/${projectId}?tab=documents`} className={getButtonClassName({ variant: "secondary", size: "sm" })}><ArrowLeft size={16} /> Back to Project Documents</Link> : <Link href={`/estimates/${estimateId}`} className={getButtonClassName({ variant: "secondary", size: "sm" })}><ArrowLeft size={16} /> Back to Estimate</Link>}
        <Button variant="outline" size="sm" onClick={() => window.print()}><Printer size={16} /> Print / Save PDF</Button>
      </div>

      <section className="rounded-[20px] border border-[var(--bos-border-light)] bg-white p-6 shadow-[var(--bos-shadow-workspace-card)] print:border-0 print:shadow-none">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--bos-border-light)] pb-5">
          <div>
            <div className="flex items-center gap-2 text-[var(--orion-blue)]"><FileCheck2 size={22} /><span className="text-xs font-extrabold uppercase tracking-[0.12em]">Executed Agreement</span></div>
            <h1 className="mt-2 text-3xl font-black text-[var(--bos-text-strong-on-light)]">{estimate.estimate_number || "Contract"} · {estimate.title}</h1>
            <p className="mt-1 text-sm font-semibold text-[var(--bos-text-medium-on-light)]">Permanent read-only customer agreement record</p>
          </div>
          <div className="rounded-full border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-3 py-1.5 text-sm font-extrabold text-[var(--color-success-700)]">Verified &amp; Signed</div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Customer" value={customerName} />
          <Fact label="Project" value={projectName} />
          <Fact label="Agreed Total" value={formatUsd(estimate.total_amount ?? 0, "en-US")} />
          <Fact label="Agreement Version" value={`Version ${agreement.version_number}`} />
        </div>
      </section>

      <Card as="section" variant="elevated"><CardHeader><CardTitle>Accepted Estimate &amp; Scope</CardTitle></CardHeader><CardContent className="space-y-5">
        <p className="whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{estimate.description || "No scope summary was provided."}</p>
        {lineItems.length ? <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wide text-[var(--color-text-muted)]"><th className="p-2">Description</th><th className="p-2">Qty</th><th className="p-2">Unit</th><th className="p-2 text-right">Price</th><th className="p-2 text-right">Total</th></tr></thead><tbody>{lineItems.map((item) => <tr key={item.id} className="border-b border-[var(--color-border-subtle)]"><td className="p-2 font-semibold">{item.description}</td><td className="p-2">{item.quantity}</td><td className="p-2">{item.unit}</td><td className="p-2 text-right">{formatUsd(item.unit_price, "en-US")}</td><td className="p-2 text-right font-bold">{formatUsd(item.line_total, "en-US")}</td></tr>)}</tbody></table></div> : null}
        <div className="grid gap-4 md:grid-cols-2"><TextBlock title="Scope Inclusions" value={estimate.scope_inclusions} /><TextBlock title="Scope Exclusions" value={estimate.scope_exclusions} /></div>
      </CardContent></Card>

      <Card as="section" variant="elevated"><CardHeader><CardTitle>Project-Specific Terms</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-2"><TextBlock title="Terms and Conditions" value={agreement.source_terms || String(snapshot.terms || "")} /><TextBlock title="Payment Terms" value={agreement.source_payment_terms || String(snapshot.paymentTerms || "")} /></CardContent></Card>

      {sections.length ? <Card as="section" variant="elevated"><CardHeader><CardTitle>Construction Agreement</CardTitle></CardHeader><CardContent className="space-y-5">{sections.map((section) => <section key={section.id}><h3 className="font-extrabold text-[var(--color-text-primary)]">{section.title}</h3>{section.paragraphs.map((paragraph, index) => <p key={index} className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{paragraph}</p>)}</section>)}</CardContent></Card> : null}

      <Card as="section" variant="elevated"><CardHeader><CardTitle>Customer Signature &amp; Verification</CardTitle></CardHeader><CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Fact label="Signed By" value={signature.typed_name} /><Fact label="Signed At" value={formatDate(signature.signed_at)} /><Fact label="Consent" value={signature.consent_accepted ? "Accepted" : "Not recorded"} /><Fact label="Verification" value={signature.verification_result === "verified" ? "Verified" : signature.verification_result} /></div>
        <div className="mt-5 rounded-[14px] border border-[var(--color-success-200)] bg-[var(--color-success-50)] p-4"><div className="flex items-center gap-2 font-extrabold text-[var(--color-success-700)]"><ShieldCheck size={18} /> Immutable verification record</div><p className="mt-2 break-all text-xs text-[var(--color-success-800)]">Agreement fingerprint: {agreement.agreement_hash}</p><p className="mt-1 break-all text-xs text-[var(--color-success-800)]">Signature fingerprint: {signature.signature_hash}</p></div>
      </CardContent></Card>

      <p className="pb-6 text-center text-xs font-medium text-[var(--color-text-muted)] print:pb-0">This view is read-only. Editing the operational project or estimate does not alter the recorded agreement snapshot or signature evidence.</p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{label}</p><p className="mt-1 break-words text-sm font-extrabold text-[var(--color-text-primary)]">{value}</p></div>; }
function TextBlock({ title, value }: { title: string; value: string | null }) { return <div><h3 className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[var(--color-text-secondary)]">{value || "Not provided."}</p></div>; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Unavailable" : new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
