"use client";

import { useEffect, useState } from "react";
import { Button, Input } from "@/components/ui";

type InvitePayload = {
  invitation?: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    expiresAt?: string | null;
  };
  tradePartner?: {
    displayName?: string | null;
    vendorCode?: string | null;
  };
  error?: string;
};

export function TradePartnerInviteClient({ token }: { token: string }) {
  const missingTokenMessage = "This Trade Partner invitation link is missing its secure token.";
  const [loading, setLoading] = useState(Boolean(token));
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);
  const [error, setError] = useState(token ? "" : missingTokenMessage);
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [tradePartnerName, setTradePartnerName] = useState("Trade Partner");
  const [vendorCode, setVendorCode] = useState("");

  useEffect(() => {
    if (!token) return;

    let active = true;
    void fetch(`/api/trade-partners/invite/claim?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json() as InvitePayload;
        if (!response.ok) throw new Error(body.error || "Unable to verify the Trade Partner invitation.");
        if (!active) return;
        setFirstName(body.invitation?.firstName || "");
        setLastName(body.invitation?.lastName || "");
        setEmail(body.invitation?.email || "");
        setPhone(body.invitation?.phone || "");
        setTradePartnerName(body.tradePartner?.displayName || "Trade Partner");
        setVendorCode(body.tradePartner?.vendorCode || "");
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to verify the Trade Partner invitation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [token]);

  async function continueToSecureSetup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setWarning("");

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email address so B.O.S. can create your secure account.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/trade-partners/invite/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email, firstName, lastName }),
      });
      const body = await response.json() as { error?: string; message?: string; warning?: string | null };
      if (!response.ok) throw new Error(body.error || "Unable to continue the Trade Partner invitation.");
      setMessage(body.message || "Your secure B.O.S. setup link has been sent.");
      setWarning(body.warning || "");
      setComplete(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to continue the Trade Partner invitation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#050d18] px-4 py-10 text-slate-100 sm:px-6 sm:py-16">
      <div className="mx-auto grid w-full max-w-5xl overflow-hidden rounded-3xl border border-blue-300/20 bg-[#0b1728] shadow-2xl lg:grid-cols-[0.95fr_1.05fr]">
        <section className="border-b border-blue-300/15 bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.18),transparent_42%)] p-7 sm:p-10 lg:border-b-0 lg:border-r">
          <p className="text-xs font-black uppercase tracking-[0.26em] text-blue-400">B.O.S.</p>
          <p className="mt-2 text-sm font-bold text-slate-200">Bango Operating System</p>
          <h1 className="mt-8 text-3xl font-black tracking-tight sm:text-4xl">Trade Partner Invitation</h1>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-300 sm:text-base">
            Your contractor uses B.O.S. to keep Trade Partner profiles, project access, plans, messages, payment applications, and compliance records connected in one secure workspace.
          </p>
          <div className="mt-8 space-y-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-blue-300/15 bg-blue-950/20 px-4 py-3">You enter your own company and trade information.</div>
            <div className="rounded-2xl border border-blue-300/15 bg-blue-950/20 px-4 py-3">B.O.S. sends your secure account setup separately.</div>
            <div className="rounded-2xl border border-blue-300/15 bg-blue-950/20 px-4 py-3">You only see projects and information assigned to your Trade Partner company.</div>
          </div>
        </section>

        <section className="p-7 sm:p-10">
          {loading ? (
            <div className="py-16 text-center text-sm text-slate-300">Verifying your secure invitation…</div>
          ) : error && !email && !firstName && !lastName ? (
            <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-5 text-sm text-red-100" role="alert">{error}</div>
          ) : complete ? (
            <div className="space-y-5 py-8">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/15 text-2xl text-emerald-300">✓</div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-400">Invitation confirmed</p>
                <h2 className="mt-2 text-2xl font-black">Check your newest B.O.S. message</h2>
              </div>
              <p className="text-sm leading-6 text-slate-300">{message}</p>
              {warning ? <div className="rounded-xl border border-amber-300/30 bg-amber-400/10 p-4 text-sm text-amber-100">{warning}</div> : null}
              <div className="rounded-2xl border border-blue-300/15 bg-blue-950/20 p-4 text-sm leading-6 text-slate-300">
                Open the secure account setup link, create your password, and B.O.S. will take you directly to the Trade Partner onboarding form where you complete your company, trade, and compliance information.
              </div>
            </div>
          ) : (
            <form onSubmit={continueToSecureSetup} className="space-y-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-400">Secure invitation</p>
                <h2 className="mt-2 text-2xl font-black">Confirm your contact information</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  B.O.S. only needs enough information here to create your secure login. You will complete the rest of your Trade Partner profile yourself after activation.
                </p>
              </div>

              <div className="rounded-2xl border border-blue-300/15 bg-[#0f2036] p-4">
                <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Trade Partner record</p>
                <p className="mt-1 font-bold">{tradePartnerName}</p>
                {vendorCode ? <p className="mt-1 text-xs text-slate-400">{vendorCode}</p> : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-sm font-bold">
                  <span>First name</span>
                  <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="given-name" />
                </label>
                <label className="space-y-2 text-sm font-bold">
                  <span>Last name</span>
                  <Input value={lastName} onChange={(event) => setLastName(event.target.value)} autoComplete="family-name" />
                </label>
              </div>

              <label className="block space-y-2 text-sm font-bold">
                <span>Email for your B.O.S. login <span className="text-red-300">*</span></span>
                <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                <span className="block text-xs font-normal text-slate-400">If your contractor invited you by phone only, enter the email you want to use to sign in to B.O.S.</span>
              </label>

              {phone ? (
                <div className="rounded-xl border border-blue-300/15 bg-blue-950/20 px-4 py-3 text-sm text-slate-300">
                  Invitation phone: <span className="font-bold text-slate-100">{phone}</span>
                </div>
              ) : null}

              {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-100" role="alert">{error}</div> : null}

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                {submitting ? "Preparing secure account…" : "Continue to Secure Account Setup"}
              </Button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
