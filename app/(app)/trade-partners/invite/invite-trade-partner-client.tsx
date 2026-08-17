"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Input } from "@/components/ui";

type VendorOption = { id: string; name: string };

export function InviteTradePartnerClient({ vendors }: { vendors: VendorOption[] }) {
  const [vendorId, setVendorId] = useState(vendors[0]?.id || "");
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/trade-partners/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendorId, email, firstName, lastName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to send invitation.");
      setSuccess(true);
      setMessage(body.message || "Trade Partner invitation sent.");
      setEmail("");
      setFirstName("");
      setLastName("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send invitation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)] sm:p-6">
      {vendors.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--bos-border-default)] p-6 text-center">
          <h2 className="font-semibold">Create a vendor first</h2>
          <p className="mt-2 text-sm text-[var(--bos-text-secondary)]">A Trade Partner login must be linked to an existing B.O.S. vendor record.</p>
          <Link href="/vendors/new" className="mt-4 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white">Add Vendor</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5">
          <label className="block space-y-2 text-sm font-semibold">
            Trade Partner / Vendor
            <select value={vendorId} onChange={(event) => setVendorId(event.target.value)} required className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3">
              {vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 text-sm font-semibold">First Name<Input value={firstName} onChange={(event) => setFirstName(event.target.value)} /></label>
            <label className="block space-y-2 text-sm font-semibold">Last Name<Input value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
          </div>

          <label className="block space-y-2 text-sm font-semibold">Email Address<Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>

          <div className="rounded-xl border border-[var(--bos-border-subtle)] bg-[var(--bos-bg-root)] p-4 text-sm leading-6 text-[var(--bos-text-secondary)]">
            B.O.S. will create a restricted subcontractor account linked to this vendor and email an invitation. The invited user will create their password, then enter the Trade Partner portal. Project access still requires an active project assignment for this vendor.
          </div>

          {message ? <div role="status" className={`rounded-xl border px-4 py-3 text-sm font-semibold ${success ? "border-emerald-300/40 bg-emerald-50 text-emerald-800" : "border-red-300/40 bg-red-50 text-red-900"}`}>{message}</div> : null}

          <div className="flex flex-wrap justify-end gap-2">
            <Link href="/trade-partners" className="inline-flex h-10 items-center rounded-lg border border-[var(--bos-border-default)] px-4 text-sm font-semibold">Back</Link>
            <Button type="submit" disabled={busy || !vendorId}>{busy ? "Sending invitation…" : "Send Trade Partner Invitation"}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
