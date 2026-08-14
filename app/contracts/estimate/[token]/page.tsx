"use client";

import { useEffect, useState } from "react";
import { CONSTRUCTION_AGREEMENT_VERSION, constructionAgreementSections } from "@/lib/estimates/construction-agreement";

type HomeSolicitationNotice = {
  applicable: true;
  rulesetVersion: string;
  sellerName: string | null;
  sellerAddress: string | null;
  sellerSignerName: string | null;
  sellerSignedAt: string | null;
  cancellationEmail: string | null;
  cancellationFax: string | null;
  transactionDate: string;
  cancellationDeadlineDate: string;
};

type Contract = {
  company: { name: string };
  estimate: { title: string; estimate_number: string | null; description: string | null; total_amount: number; terms: string | null; payment_terms: string | null; scope_inclusions: string | null; scope_exclusions: string | null };
  items: Array<{ description: string; quantity: number; unit: string; unit_price: number; line_total: number }>;
  expiresAt: string;
  homeSolicitation: HomeSolicitationNotice | null;
};

export default function EstimateContractPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [contract, setContract] = useState<Contract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [signed, setSigned] = useState(false);
  const [signedDeadline, setSignedDeadline] = useState<string | null>(null);

  useEffect(() => { void params.then(({ token: value }) => { setToken(value); fetch(`/api/contracts/estimate/${encodeURIComponent(value)}`).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error); setContract(body); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to open contract.")); }); }, [params]);

  async function sign() {
    setSubmitting(true); setError(null);
    try {
      const response = await fetch(`/api/contracts/estimate/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ typedName, consentAccepted: consent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to sign.");
      setSignedDeadline(body.cancellationDeadlineDate || null);
      setSigned(true);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to sign."); }
    finally { setSubmitting(false); }
  }

  if (error && !contract) return <main className="mx-auto max-w-3xl p-6"><h1 className="text-2xl font-bold">Estimate unavailable</h1><p className="mt-3 text-red-700">{error}</p></main>;
  if (!contract) return <main className="mx-auto max-w-3xl p-6">Loading secure estimate…</main>;
  if (signed) return <main className="mx-auto max-w-3xl p-6"><div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8"><h1 className="text-2xl font-bold text-emerald-950">Estimate signed</h1><p className="mt-3 text-emerald-800">Your estimate has been accepted and B.O.S. has created the project.</p>{signedDeadline ? <p className="mt-3 font-semibold text-emerald-950">Your Ohio cancellation period runs through midnight on {signedDeadline}. Bango Construction will not begin covered services during that period.</p> : null}<p className="mt-3 text-emerald-800">You may close this page.</p></div></main>;

  return <main className="mx-auto max-w-4xl space-y-6 p-4 text-slate-950 sm:p-8">
    <header className="rounded-3xl bg-slate-950 p-6 text-white"><p className="text-sm uppercase tracking-widest">{contract.company.name}</p><h1 className="mt-2 text-3xl font-bold">{contract.estimate.title}</h1><p className="mt-1 text-slate-300">Estimate · {contract.estimate.estimate_number || "Estimate"}</p></header>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-950"><h2 className="text-xl font-semibold text-slate-950">Scope of work</h2><p className="mt-3 whitespace-pre-wrap text-slate-700">{contract.estimate.description || "See line items below."}</p></section>
    <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-950"><table className="w-full text-slate-950"><thead className="bg-slate-100 text-left text-sm text-slate-900"><tr><th className="p-3">Work</th><th className="p-3">Qty</th><th className="p-3 text-right">Amount</th></tr></thead><tbody className="text-slate-800">{contract.items.map((item, index) => <tr className="border-t border-slate-200" key={index}><td className="p-3">{item.description}</td><td className="p-3">{item.quantity} {item.unit}</td><td className="p-3 text-right">${Number(item.line_total).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td></tr>)}</tbody></table><div className="border-t border-slate-200 bg-slate-50 p-4 text-right text-xl font-bold text-slate-950">Total ${Number(contract.estimate.total_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div></section>
    <section className="rounded-3xl border border-slate-200 bg-white p-6 text-slate-950"><h2 className="text-xl font-semibold text-slate-950">Terms and conditions</h2><p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{contract.estimate.terms || "No additional terms provided."}</p><h3 className="mt-5 font-semibold text-slate-950">Payment terms</h3><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{contract.estimate.payment_terms || "Not specified."}</p></section>
    <details className="rounded-3xl border border-slate-200 bg-white text-slate-950 shadow-sm"><summary className="cursor-pointer list-none px-6 py-5 text-lg font-semibold marker:hidden">Read Construction Agreement <span className="ml-2 text-sm font-normal text-slate-500">Version {CONSTRUCTION_AGREEMENT_VERSION}</span></summary><div className="space-y-6 border-t border-slate-200 px-6 py-6">{constructionAgreementSections.map((section) => <section key={section.id}><h2 className="font-semibold text-slate-950">{section.title}</h2>{section.paragraphs.map((paragraph) => <p className="mt-2 text-sm leading-6 text-slate-700" key={paragraph}>{paragraph}</p>)}</section>)}</div></details>

    {contract.homeSolicitation ? <HomeSolicitationNotices notice={contract.homeSolicitation} /> : null}

    <section className="rounded-3xl border border-blue-200 bg-blue-50 p-6 text-slate-950">
      <h2 className="text-xl font-semibold text-slate-950">Digital signature</h2>
      {contract.homeSolicitation ? <p className="mt-4 rounded-xl border-2 border-slate-900 bg-white p-4 text-sm font-bold leading-6 text-slate-950">You, the buyer, may cancel this transaction at any time prior to midnight of the third business day after the date of this transaction. See the notice of cancellation above for an explanation of this right.</p> : null}
      <label className="mt-4 block text-sm font-semibold text-slate-900" htmlFor="legal-name">Full legal name</label><input id="legal-name" className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 placeholder:text-slate-500" value={typedName} onChange={(event) => setTypedName(event.target.value)} autoComplete="name" />
      <label className="mt-4 flex gap-3 text-sm text-slate-800"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>By signing, I confirm that I have reviewed and accept this estimate, its scope, price, project-specific terms, payment terms, and the incorporated Construction Agreement. I consent to use my typed name as my electronic signature and represent that I am authorized to accept for the customer. {contract.homeSolicitation ? "I also acknowledge that I received the Ohio cancellation-right notice shown with this agreement. " : ""}I also agree to the <a className="font-semibold text-blue-800 underline underline-offset-2" href="/legal/electronic-signature-and-platform-terms" target="_blank" rel="noreferrer">B.O.S. Electronic Signature &amp; Platform Terms</a>.</span></label>
      {contract.homeSolicitation ? <div className="mt-5 rounded-xl border border-slate-300 bg-white p-4 text-sm text-slate-700"><p className="font-semibold text-slate-950">Seller acceptance</p><p className="mt-1">{contract.homeSolicitation.sellerName}</p><p>Authorized signer: {contract.homeSolicitation.sellerSignerName}</p><p>Electronically signed: {contract.homeSolicitation.sellerSignedAt ? new Date(contract.homeSolicitation.sellerSignedAt).toLocaleString() : "Not recorded"}</p></div> : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}<button className="mt-5 rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={submitting || !typedName.trim() || !consent} onClick={() => void sign()}>{submitting ? "Signing…" : "Sign estimate"}</button>
    </section>
  </main>;
}

function HomeSolicitationNotices({ notice }: { notice: HomeSolicitationNotice }) {
  return <section className="rounded-3xl border-2 border-slate-900 bg-white p-6 text-slate-950">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">Ohio consumer notice</p><h2 className="mt-1 text-2xl font-bold">Right to Cancel</h2></div><p className="text-sm font-semibold">Deadline: midnight {notice.cancellationDeadlineDate}</p></div>
    <p className="mt-4 text-sm leading-6">You may cancel this transaction without penalty or obligation within three business days from the transaction date shown below. Written cancellation may be sent to the seller by an allowed delivery method, including email to the address shown below.</p>
    <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><strong>Transaction date:</strong> {notice.transactionDate}</p><p><strong>Seller:</strong> {notice.sellerName}</p><p><strong>Seller address:</strong> {notice.sellerAddress}</p><p><strong>Cancellation email:</strong> {notice.cancellationEmail || "Not provided"}</p>{notice.cancellationFax ? <p><strong>Cancellation fax:</strong> {notice.cancellationFax}</p> : null}<p><strong>Seller signer:</strong> {notice.sellerSignerName}</p></div>
    <div className="mt-6 grid gap-4 md:grid-cols-2"><CancellationCopy notice={notice} copy="Copy 1" /><CancellationCopy notice={notice} copy="Copy 2" /></div>
  </section>;
}

function CancellationCopy({ notice, copy }: { notice: HomeSolicitationNotice; copy: string }) {
  const contact = notice.cancellationEmail || notice.cancellationFax || notice.sellerAddress || "seller contact shown in agreement";
  return <div className="rounded-xl border-2 border-dashed border-slate-400 p-5 text-sm leading-6"><p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{copy}</p><h3 className="mt-1 text-lg font-extrabold">NOTICE OF CANCELLATION</h3><p className="mt-3"><strong>Date of transaction:</strong> {notice.transactionDate}</p><p className="mt-3">You may cancel this transaction, without any penalty or obligation, within three business days from the transaction date.</p><p className="mt-3">To cancel, send a signed and dated copy of this notice or any other written notice expressing your intent to cancel to <strong>{notice.sellerName}</strong> at <strong>{contact}</strong> no later than midnight of <strong>{notice.cancellationDeadlineDate}</strong>.</p><div className="mt-5 space-y-3"><p>I hereby cancel this transaction.</p><p>Date: ____________________</p><p>Buyer signature: ______________________________</p></div></div>;
}
