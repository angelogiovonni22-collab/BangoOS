"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export function HomeSolicitationSellerSignature({ estimateId }: { estimateId: string }) {
  const [signerName, setSignerName] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [signedName, setSignedName] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, { cache: "no-store" });
    if (!response.ok) return;
    const body = await response.json();
    setSignedAt(body.profile?.sellerSignedAt || null);
    setSignedName(body.profile?.sellerSignerName || null);
  }

  useEffect(() => { void refresh(); }, [estimateId]);

  async function signAsSeller() {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/estimates/${estimateId}/home-solicitation`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "seller_signature", signerName, consentAccepted: consent }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to record seller signature.");
      setSignedAt(body.profile?.sellerSignedAt || null);
      setSignedName(body.profile?.sellerSignerName || signerName.trim());
      setSignerName("");
      setConsent(false);
      setMessage("Seller signature recorded. Run Save & Review above to refresh the final readiness state.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to record seller signature.");
    } finally {
      setBusy(false);
    }
  }

  return <Card as="section" variant="elevated">
    <CardHeader><CardTitle>Seller Signature</CardTitle><p className="mt-1 text-sm text-[var(--color-text-secondary)]">For an applicable Ohio home-solicitation transaction, the buyer copy must include the seller&apos;s signature.</p></CardHeader>
    <CardContent className="space-y-4">
      {signedAt ? <div className="rounded-[var(--radius-control)] border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"><p className="font-semibold">Seller signature recorded</p><p className="mt-1">{signedName} · {new Date(signedAt).toLocaleString()}</p></div> : null}
      <label className="block text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">Authorized seller signer name<input className="mt-1 w-full rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text-primary)]" value={signerName} onChange={(event) => setSignerName(event.target.value)} autoComplete="name" /></label>
      <label className="flex items-start gap-3 rounded-[var(--radius-control)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm text-[var(--color-text-primary)]"><input className="mt-1" type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>I am authorized to sign for the seller, intend this action to serve as the seller&apos;s electronic signature, and approve this agreement for delivery to the buyer.</span></label>
      <div className="flex flex-wrap items-center gap-3"><Button type="button" size="md" isLoading={busy} disabled={!signerName.trim() || !consent} onClick={() => void signAsSeller()}>Sign as Seller</Button>{message ? <span className="text-sm text-[var(--color-text-secondary)]" role="status">{message}</span> : null}</div>
    </CardContent>
  </Card>;
}
