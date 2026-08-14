"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export function HomeSolicitationSellerSignature({ estimateId }: { estimateId: string }) {
  const [signerName, setSignerName] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signedName, setSignedName] = useState<string | null>(null);
  const [oralAt, setOralAt] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [oralConsent, setOralConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [oralBusy, setOralBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setSignedAt(body.profile?.sellerSignedAt || null);
    setSignedName(body.profile?.sellerSignerName || null);
    setOralAt(body.profile?.oralDisclosureConfirmedAt || null);
  }

  useEffect(() => { void refresh(); }, [estimateId]);

  async function signAsSeller() {
    setBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "seller_signature", signerName, consentAccepted: consent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to record seller signature.");
      setSignedAt(body.profile?.sellerSignedAt || null); setSignedName(body.profile?.sellerSignerName || signerName.trim()); setSignerName(""); setConsent(false);
      setMessage("Seller signature recorded.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record seller signature."); }
    finally { setBusy(false); }
  }

  async function confirmOralDisclosure() {
    setOralBusy(true); setMessage(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "oral_disclosure", consentAccepted: oralConsent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to record oral disclosure.");
      setOralAt(body.profile?.oralDisclosureConfirmedAt || null); setOralConsent(false);
      setMessage("Oral disclosure recorded. The assisted-signing authorization remains valid for 30 minutes; the buyer should sign during this live session.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to record oral disclosure."); }
    finally { setOralBusy(false); }
  }

  return <Card as="section" variant="elevated">
    <CardHeader><CardTitle>Seller &amp; Assisted Signing</CardTitle><p className="mt-1 text-sm text-[var(--color-text-secondary)]">Records the seller&apos;s electronic signature and the time-sensitive oral cancellation-right disclosure for an applicable Ohio home-solicitation transaction.</p></CardHeader>
    <CardContent className="space-y-5">
      {signedAt ? <div className="rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><p className="font-semibold">Seller signature recorded</p><p className="mt-1">{signedName} · {new Date(signedAt).toLocaleString()}</p></div> : null}
      <label className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">Authorized seller signer name<input className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></label>
      <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm text-[var(--color-text-primary)]"><input className="mt-1" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I am authorized to sign for the seller, intend this action to serve as the seller&apos;s electronic signature, and approve this agreement for delivery to the buyer.</span></label>
      <Button type="button" size="md" isLoading={busy} disabled={!signerName.trim() || !consent} onClick={() => void signAsSeller()}>Sign as Seller</Button>

      <div className="border-t border-[var(--color-border-subtle)] pt-5">
        <h3 className="font-semibold text-[var(--color-text-primary)]">Live oral disclosure</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Use this only while the buyer is in the assisted signing session. B.O.S. expires this confirmation after 30 minutes.</p>
        {oralAt ? <p className="mt-3 rounded-[var(--radius-control)] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950">Last confirmed: {new Date(oralAt).toLocaleString()}</p> : null}
        <label className="mt-3 flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm text-[var(--color-text-primary)]"><input className="mt-1" type="checkbox" checked={oralConsent} onChange={(event) => setOralConsent(event.target.checked)} /><span>I am currently communicating with the buyer and have orally informed the buyer of the right to cancel this transaction before the buyer signs.</span></label>
        <Button className="mt-3" type="button" size="md" isLoading={oralBusy} disabled={!oralConsent} onClick={() => void confirmOralDisclosure()}>Confirm Oral Disclosure</Button>
      </div>
      {message ? <p className="text-sm text-[var(--color-text-secondary)]" role="status">{message}</p> : null}
    </CardContent>
  </Card>;
}
