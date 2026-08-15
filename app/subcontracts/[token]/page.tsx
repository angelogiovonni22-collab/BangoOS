"use client";

import { useEffect, useState } from "react";

type Snapshot = Record<string, any>;
type ContractPayload = {
  company: { name: string };
  vendor: { name: string; email: string | null };
  master: { status: string; version: string; snapshot: Snapshot; hash: string; signedAt: string | null };
  authorization: { status: string; version: string; snapshot: Snapshot; hash: string; signedAt: string | null };
  expiresAt: string;
};

const money = (value: unknown) => value == null ? "Not specified" : Number(value).toLocaleString(undefined, { style: "currency", currency: "USD" });

export default function SubcontractSigningPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [data, setData] = useState<ContractPayload | null>(null);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [mobilizationStatus, setMobilizationStatus] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void params.then(({ token: value }) => {
      setToken(value);
      fetch(`/api/subcontracts/${encodeURIComponent(value)}`)
        .then(async (response) => {
          const body = await response.json();
          if (!response.ok) throw new Error(body.error || "Unable to open subcontract.");
          setData(body);
          setSigned(body.authorization.status === "signed");
        })
        .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to open subcontract."))
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function sign() {
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/subcontracts/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ typedName: name, title, consentAccepted: consent }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to sign subcontract.");
      setSigned(true);
      setMobilizationStatus(body.mobilizationStatus || "not_cleared");
      setBlockers(Array.isArray(body.blockers) ? body.blockers : []);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to sign subcontract.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <main className="min-h-screen bg-slate-100 p-6 text-slate-900">Loading secure subcontract…</main>;
  if (error && !data) return <main className="min-h-screen bg-slate-100 p-6"><div className="mx-auto max-w-2xl rounded-3xl bg-white p-8 shadow"><h1 className="text-2xl font-black text-slate-950">Subcontract unavailable</h1><p className="mt-3 text-red-700">{error}</p></div></main>;
  if (!data) return null;

  const wa = data.authorization.snapshot;
  const masterSections = Array.isArray(data.master.snapshot.sections) ? data.master.snapshot.sections : [];

  if (signed) {
    return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-3xl space-y-5"><div className="rounded-3xl bg-slate-950 p-8 text-white"><p className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">Bango Construction</p><h1 className="mt-2 text-3xl font-black">Subcontract signed</h1><p className="mt-3 text-slate-300">Your Master Subcontract Agreement and Project Work Authorization have been recorded.</p></div><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6"><h2 className="text-xl font-bold text-emerald-950">Contract documents complete</h2><p className="mt-2 text-emerald-800">Project: {wa.project}</p>{mobilizationStatus ? <p className="mt-3 font-bold text-emerald-950">Mobilization status: {mobilizationStatus === "cleared" ? "CLEARED TO MOBILIZE" : "NOT CLEARED TO MOBILIZE"}</p> : null}{blockers.length ? <p className="mt-2 text-sm text-emerald-900">Remaining requirements: {blockers.join(", ").replaceAll("_", " ")}</p> : null}<p className="mt-3 text-sm text-emerald-900">Do not begin work until Bango Construction confirms that all project mobilization requirements are cleared.</p></div></div></main>;
  }

  return <main className="min-h-screen bg-[#edf2f7] px-3 py-5 text-slate-950 sm:px-6 sm:py-10"><div className="mx-auto max-w-5xl overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl shadow-slate-900/10">
    <header className="bg-slate-950 px-6 py-8 text-white sm:px-10"><div className="flex flex-wrap items-start justify-between gap-5"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">Bango Construction</p><h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Subcontract Agreement</h1><p className="mt-2 text-slate-300">Master Agreement + Project Work Authorization</p></div><div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm"><p className="font-bold">{data.vendor.name}</p><p className="mt-1 text-slate-300">Secure electronic signature</p></div></div></header>

    <div className="space-y-8 px-5 py-7 sm:px-10 sm:py-10">
      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5 md:grid-cols-2"><Info label="Project" value={wa.project} /><Info label="Trade" value={wa.trade} /><Info label="Project address" value={wa.projectAddress || "Not specified"} /><Info label="Contract amount" value={money(wa.contractAmount)} /><Info label="Start date" value={wa.startDate || "Not scheduled"} /><Info label="Target completion" value={wa.targetCompletionDate || "Not scheduled"} /></section>

      <section><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Project Work Authorization</p><h2 className="mt-1 text-2xl font-black">Scope & commercial terms</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><TextBox title="Scope of work" body={wa.scopeOfWork || "See project documents and written assignment."} /><TextBox title="Payment terms" body={wa.paymentTerms || "Per approved invoice and project requirements."} /><TextBox title="Retainage" body={wa.retainagePercent == null ? "Not specified" : `${wa.retainagePercent}%`} /><TextBox title="Authorization version" body={data.authorization.version} /></div>{Array.isArray(wa.terms) ? <div className="mt-5 rounded-2xl border border-slate-200 p-5"><h3 className="font-black">Project-specific conditions</h3><ul className="mt-3 space-y-2 text-sm leading-6 text-slate-700">{wa.terms.map((term: string) => <li key={term}>• {term}</li>)}</ul></div> : null}</section>

      <details open={data.master.status !== "signed"} className="rounded-2xl border border-slate-200"><summary className="cursor-pointer px-5 py-4 font-black">Master Subcontract Agreement <span className="ml-2 text-sm font-medium text-slate-500">v{data.master.version}{data.master.status === "signed" ? " · already executed" : ""}</span></summary><div className="space-y-5 border-t border-slate-200 px-5 py-6">{masterSections.map((section: any) => <section key={section.title}><h3 className="font-black">{section.title}</h3><p className="mt-2 text-sm leading-7 text-slate-700">{section.body}</p></section>)}</div></details>

      <section className="rounded-3xl border-2 border-slate-900 bg-slate-50 p-6"><p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Electronic acceptance</p><h2 className="mt-2 text-2xl font-black">Accept & Sign Subcontract</h2><p className="mt-2 text-sm leading-6 text-slate-600">By signing, you represent that you are authorized to bind the subcontractor identified above. If the Master Subcontract Agreement has not previously been executed, this signature executes both that agreement and this Project Work Authorization.</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-bold">Full legal name<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" /></label><label className="text-sm font-bold">Title / capacity<input className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Owner, President, Authorized Representative" /></label></div><label className="mt-5 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" className="mt-1" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have reviewed and accept the applicable Master Subcontract Agreement and Project Work Authorization, consent to electronic records and signatures, and intend my typed name to serve as my electronic signature.</span></label>{error ? <p className="mt-4 font-semibold text-red-700">{error}</p> : null}<button type="button" onClick={() => void sign()} disabled={submitting || !name.trim() || !title.trim() || !consent} className="mt-6 w-full rounded-xl bg-slate-950 px-5 py-4 text-base font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{submitting ? "Recording signature…" : "Accept & Sign Subcontract"}</button><p className="mt-3 text-center text-xs text-slate-500">B.O.S. provides the secure electronic workflow and audit evidence. The contracting parties are identified in the agreement.</p></section>
    </div>
  </div></main>;
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 font-bold text-slate-950">{value}</p></div>; }
function TextBox({ title, body }: { title: string; body: string }) { return <div className="rounded-2xl border border-slate-200 p-5"><h3 className="font-black">{title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{body}</p></div>; }
