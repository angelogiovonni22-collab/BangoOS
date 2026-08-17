"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";

export default function TradePartnerWelcomePage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) {
      setMessage("B.O.S. authentication is unavailable.");
      setChecking(false);
      return;
    }

    void supabase.auth.getUser().then(({ data }) => {
      setAuthenticated(Boolean(data.user));
      setChecking(false);
    });
  }, []);

  async function finishSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("Use a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("B.O.S. authentication is unavailable.");
      return;
    }

    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/partner");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to finish account setup.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-content flex min-h-[70vh] items-center justify-center py-8">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-6 shadow-[var(--shadow-card)] sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8ec3ff]">B.O.S. Trade Partner</p>
        <h1 className="mt-2 text-2xl font-semibold">Finish Your Secure Account</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--bos-text-secondary)]">Create the password you will use to sign into B.O.S. Your account is restricted to the projects assigned to your Trade Partner company.</p>

        {checking ? <p className="mt-6 text-sm text-[var(--bos-text-secondary)]">Verifying invitation…</p> : !authenticated ? (
          <div className="mt-6 rounded-xl border border-amber-300/40 bg-amber-50 p-4 text-sm text-amber-900">This invitation session is not active. Open the newest B.O.S. invitation link from your email again.</div>
        ) : (
          <form onSubmit={finishSetup} className="mt-6 space-y-4">
            <label className="block space-y-2 text-sm font-semibold">Password<Input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            <label className="block space-y-2 text-sm font-semibold">Confirm Password<Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>
            {message ? <div role="status" className="rounded-xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-root)] px-4 py-3 text-sm">{message}</div> : null}
            <Button type="submit" fullWidth size="lg" disabled={busy}>{busy ? "Securing account…" : "Finish Setup & Open My Jobs"}</Button>
          </form>
        )}
      </section>
    </div>
  );
}
