"use client";

import { useEffect, useState } from "react";

type ApprovalPayload = {
  company: { name: string };
  changeOrder: {
    change_order_number: string;
    title: string;
    description: string | null;
    reason: string | null;
    status: string;
    total_amount: number;
    subtotal: number;
    tax_amount: number;
    schedule_impact_days: number;
    requested_date: string | null;
    effective_date: string | null;
    customerName: string;
    customerEmail: string | null;
    projectName: string;
    projectNumber: string | null;
  };
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unit: string;
    unit_price: number;
    price_amount: number;
  }>;
  expiresAt: string;
  decision: { decision: string; typed_name: string; created_at: string } | null;
};

const money = (value: number) => Number(value || 0).toLocaleString(undefined, { style: "currency", currency: "USD" });
const unitLabel = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

export default function ChangeOrderApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState("");
  const [payload, setPayload] = useState<ApprovalPayload | null>(null);
  const [typedName, setTypedName] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"approved" | "rejected" | null>(null);
  const [decision, setDecision] = useState<string | null>(null);

  useEffect(() => {
    void params.then(async ({ token: raw }) => {
      setToken(raw);
      try {
        const response = await fetch(`/api/change-orders/approval/${encodeURIComponent(raw)}`);
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to open change order.");
        setPayload(body);
        setDecision(body.decision?.decision || null);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Unable to open change order.");
      }
    });
  }, [params]);

  async function submit(nextDecision: "approved" | "rejected") {
    setSubmitting(nextDecision);
    setError(null);
    try {
      const response = await fetch(`/api/change-orders/approval/${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: nextDecision, typedName, consentAccepted: consent }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to record your decision.");
      setDecision(body.decision || nextDecision);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to record your decision.");
    } finally {
      setSubmitting(null);
    }
  }

  if (error && !payload) return <Status title="Change order unavailable" body={error} />;
  if (!payload) return <main className="min-h-screen bg-slate-100 p-6 text-slate-900">Loading secure change order…</main>;

  if (decision) {
    return <Status
      title={decision === "approved" ? "Change order approved" : "Change order rejected"}
      body={decision === "approved"
        ? "Your approval has been recorded and Bango Construction has been notified."
        : "Your decision has been recorded and Bango Construction has been notified."}
      success={decision === "approved"}
    />;
  }

  const co = payload.changeOrder;
  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <header className="rounded-[28px] bg-[#07162f] p-7 text-white shadow-xl">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">{payload.company.name}</p>
          <h1 className="mt-2 text-3xl font-black">Change Order Approval</h1>
          <p className="mt-2 text-sm text-slate-300">{co.change_order_number} · Secure customer review</p>
        </header>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="grid lg:grid-cols-[1.4fr_.6fr]">
            <div className="p-7">
              <p className="text-xs font-black uppercase tracking-[.15em] text-blue-700">Project</p>
              <h2 className="mt-2 text-2xl font-black">{co.projectName}</h2>
              <p className="mt-1 text-sm text-slate-500">{co.projectNumber || "Project"} · Prepared for {co.customerName}</p>
              <h3 className="mt-6 text-xl font-black">{co.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{co.description || "See line items below."}</p>
              {co.reason ? <p className="mt-4 text-sm leading-6 text-slate-600"><strong>Reason:</strong> {co.reason}</p> : null}
            </div>
            <div className="flex flex-col justify-between bg-slate-950 p-7 text-white">
              <div>
                <p className="text-xs font-bold uppercase tracking-[.15em] text-blue-200">Change order total</p>
                <p className="mt-2 text-4xl font-black">{money(co.total_amount)}</p>
              </div>
              <div className="mt-8 text-sm text-slate-300">Schedule impact<br/><strong className="text-white">{co.schedule_impact_days > 0 ? "+" : ""}{co.schedule_impact_days} days</strong></div>
            </div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Line Items</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-[.08em] text-slate-500">
                <tr><th className="px-4 py-3">Description</th><th className="px-4 py-3">Qty</th><th className="px-4 py-3">Unit</th><th className="px-4 py-3 text-right">Customer Price</th><th className="px-4 py-3 text-right">Amount</th></tr>
              </thead>
              <tbody>
                {payload.items.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-4 py-3 font-semibold">{item.description}</td><td className="px-4 py-3">{item.quantity}</td><td className="px-4 py-3">{unitLabel(item.unit)}</td><td className="px-4 py-3 text-right">{money(item.unit_price)}</td><td className="px-4 py-3 text-right font-bold">{money(item.price_amount)}</td></tr>)}
              </tbody>
            </table>
          </div>
          <div className="mt-5 ml-auto max-w-sm space-y-2 border-t border-slate-200 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Subtotal</span><strong>{money(co.subtotal)}</strong></div>
            <div className="flex justify-between"><span className="text-slate-500">Tax</span><strong>{money(co.tax_amount)}</strong></div>
            <div className="flex justify-between text-lg"><span className="font-black">Total</span><strong>{money(co.total_amount)}</strong></div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black">Your Decision</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">Enter your legal name and confirm that your electronic approval or rejection will be recorded with this change order.</p>
          <label className="mt-5 block text-sm font-bold">Legal name<input value={typedName} onChange={(event) => setTypedName(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-300 px-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>
          <label className="mt-4 flex items-start gap-3 text-sm leading-6 text-slate-700"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 h-5 w-5" /><span>I consent to use my typed name and this secure link to record my decision electronically.</span></label>
          {error ? <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={submitting !== null} onClick={() => void submit("approved")} className="min-h-12 rounded-xl bg-emerald-700 px-5 font-black text-white disabled:opacity-50">{submitting === "approved" ? "Approving…" : "Approve Change Order"}</button>
            <button type="button" disabled={submitting !== null} onClick={() => void submit("rejected")} className="min-h-12 rounded-xl border border-red-300 bg-red-50 px-5 font-black text-red-700 disabled:opacity-50">{submitting === "rejected" ? "Rejecting…" : "Reject Change Order"}</button>
          </div>
        </section>

        <p className="text-center text-xs text-slate-500">Secure link expires {new Date(payload.expiresAt).toLocaleString()}.</p>
      </div>
    </main>
  );
}

function Status({ title, body, success = false }: { title: string; body: string; success?: boolean }) {
  return <main className="grid min-h-screen place-items-center bg-slate-100 p-6"><section className={`w-full max-w-lg rounded-[28px] border bg-white p-8 text-center shadow-xl ${success ? "border-emerald-200" : "border-slate-200"}`}><h1 className="text-2xl font-black text-slate-950">{title}</h1><p className="mt-3 text-sm leading-6 text-slate-600">{body}</p></section></main>;
}
