"use client";

import { useEffect, useState } from "react";

type Contract = { company: { name: string }; estimate: { title: string; estimate_number: string | null; description: string | null; total_amount: number; terms: string | null; payment_terms: string | null; scope_inclusions: string | null; scope_exclusions: string | null }; items: Array<{ description: string; quantity: number; unit: string; unit_price: number; line_total: number }>; expiresAt: string };

export default function EstimateContractPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => { void params.then(({ token: value }) => { setToken(value); fetch(`/api/contracts/estimate/${encodeURIComponent(value)}`).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setContract(body); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to open contract.")); }); }, [params]);

  async function sign() {
    setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/contracts/estimate/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typedName, consentAccepted: consent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to sign.");
      setSigned(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign."); }
    finally { setSubmitting(false); }
  }

  if (error && !contract) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Contract unavailable</h1><p className="mt-3 text-red-700">{error}</p></main>;
  if (!contract) return <main className="mx-auto max-w-3xl p-6">Loading secure contract…</main>;
  if (signed) return <main className="mx-auto max-w-3xl p-6"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8"><h1 className="text-2xl font-bold text-emerald-950">Contract signed</h1><p className="mt-3 text-emerald-800">Check your email and select the verification link. BOS will create the project only after verification succeeds.</p></div></main>;

  return <main className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
    <header className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-sm uppercase tracking-widest">{contract.company.name}</p><h1 className="mt-2 text-3xl font-bold">{contract.estimate.title}</h1><p className="mt-1 text-slate-300">Contract · {contract.estimate.estimate_number || "Estimate"}</p></header>
    <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-semibold">Scope of work</h2><p className="mt-3 whitespace-pre-wrap text-slate-700">{contract.estimate.description || "See line items below."}</p></section>
    <section className="overflow-hidden rounded-3xl border bg-white"><table className="w-full"><thead className="bg-slate-100 text-left text-sm"><tr><th className="p-3">Work</th><th className="p-3">Qty</th><th className="p-3 text-right">Amount</th></tr></thead><tbody>{contract.items.map((item, index) => <tr className="border-t" key={index}><td className="p-3">{item.description}</td><td className="p-3">{item.quantity} {item.unit}</td><td className="p-3 text-right">${Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table><div className="border-t bg-slate-50 p-4 text-right text-xl font-bold">Total ${Number(contract.estimate.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></section>
    <section className="rounded-3xl border bg-white p-6"><h2 className="text-xl font-semibold">Terms and conditions</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{contract.estimate.terms || "No additional terms provided."}</p><h3 className="mt-5 font-semibold">Payment terms</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{contract.estimate.payment_terms || "Not specified."}</p></section>
    <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6"><h2 className="text-xl font-semibold">Digital signature</h2><label className="mt-4 block text-sm font-semibold" htmlFor="legal-name">Full legal name</label><input id="legal-name" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3" value={typedName} onChange={(event) => setTypedName(event.target.value)} autoComplete="name" /><label className="mt-4 flex gap-3 text-sm"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I have read this contract, agree to its terms, and consent to use my typed name as my electronic signature.</span></label>{error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}<button className="mt-5 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={submitting || !typedName.trim() || !consent} onClick={() => void sign()}>{submitting ? "Signing…" : "Sign contract"}</button></section>
  </main>;
}
