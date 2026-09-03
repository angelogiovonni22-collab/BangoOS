"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui";

export default function TestAdminAccessPage() {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") || "");
    setFirstName(params.get("firstName") || "");
    setLastName(params.get("lastName") || "");
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/settings/test-admin-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, firstName, lastName }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to create test administrator access.");
      setMessage(body.message || "Test administrator access is ready.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create test administrator access.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-content space-y-5">
      <section className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8ec3ff]">B.O.S. Test Access</p>
        <h1 className="mt-2 text-2xl font-semibold">Test Administrator</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--bos-text-secondary)]">
          Create a completely separate B.O.S. test company and give the invited person Administrator access inside that sandbox.
          They can create customers, projects, estimates, invoices, schedules, crews, reports, materials, vendors, and other test records without touching Bango Construction data.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,620px)_minmax(0,1fr)]">
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
          <div>
            <h2 className="text-lg font-semibold">Create isolated test access</h2>
            <p className="mt-1 text-sm text-[var(--bos-text-secondary)]">The invitee receives their own sign-in and an empty test company.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">First name</span>
              <input value={firstName} onChange={(event) => setFirstName(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3" autoComplete="given-name" />
            </label>
            <label className="space-y-1.5">
              <span className="block text-xs font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">Last name</span>
              <input value={lastName} onChange={(event) => setLastName(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3" autoComplete="family-name" />
            </label>
          </div>

          <label className="space-y-1.5">
            <span className="block text-xs font-bold uppercase tracking-[0.1em] text-[var(--bos-text-muted)]">Email address</span>
            <input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="h-11 w-full rounded-lg border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-3" autoComplete="email" placeholder="tester@example.com" />
          </label>

          {message ? <div role="status" className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-600">{message}</div> : null}
          {error ? <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-600">{error}</div> : null}

          <div className="flex justify-end"><Button type="submit" disabled={busy}>{busy ? "Creating test company…" : "Create Test Administrator"}</Button></div>
        </form>

        <aside className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-small)]">
          <h2 className="text-lg font-semibold">Isolation rules</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--bos-text-secondary)]">
            The test administrator gets the normal B.O.S. Administrator permissions only inside a newly created test company. Bango Construction remains a separate company scope.
          </p>
          <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm leading-6 text-amber-700">
            This test workspace is not attached to a Stripe customer or subscription. Orion usage remains limited to the small test allowance so testing cannot silently create unlimited AI spend.
          </div>
        </aside>
      </section>
    </div>
  );
}
