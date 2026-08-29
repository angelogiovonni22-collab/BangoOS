"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, ErrorState, Input, PageHeader } from "@/components/ui";
import { useCompany } from "@/lib/company";

type InviteResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  warning?: string | null;
  vendorId?: string;
  vendorCode?: string;
  delivery?: Array<{ channel: "email" | "sms"; status: "sent" | "skipped" | "failed"; message?: string }>;
};

export function NewVendorClient() {
  const { companyName } = useCompany();
  const [company, setCompany] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setResult(null);

    if (!email.trim() && !phone.trim()) {
      setErrorMessage("Enter an email address, mobile phone number, or both.");
      return;
    }

    if (isSending) return;
    setIsSending(true);

    try {
      const response = await fetch("/api/trade-partners/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: company,
          firstName,
          lastName,
          email,
          phone,
        }),
      });
      const body = await response.json() as InviteResult;
      if (!response.ok || !body.ok) throw new Error(body.error || "Unable to send the Trade Partner invitation.");
      setResult(body);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to send the Trade Partner invitation.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Trade Partners"
        title="Invite Trade Partner"
        description={`Send a secure B.O.S. onboarding invitation for ${companyName || "your company"}. The Trade Partner completes their own company, trade, address, compliance, and account information.`}
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <form onSubmit={handleSubmit} className="space-y-5 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)] sm:p-7">
          <div>
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Contact information</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-text-secondary)]">
              You do not need their account number, payment terms, credit limit, tax ID, addresses, ratings, or compliance details. B.O.S. collects that information directly from the Trade Partner after they accept the invitation.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Company / trade name" hint="Optional">
              <Input value={company} onChange={(event) => setCompany(event.target.value)} disabled={isSending} autoComplete="organization" placeholder="Optional" />
            </Field>
            <div className="hidden sm:block" aria-hidden="true" />
            <Field label="First name" hint="Optional">
              <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} disabled={isSending} autoComplete="given-name" />
            </Field>
            <Field label="Last name" hint="Optional">
              <Input value={lastName} onChange={(event) => setLastName(event.target.value)} disabled={isSending} autoComplete="family-name" />
            </Field>
            <Field label="Email address" hint="Use email, mobile, or both">
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={isSending} autoComplete="email" placeholder="tradepartner@example.com" />
            </Field>
            <Field label="Mobile phone" hint="Use email, mobile, or both">
              <Input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={isSending} autoComplete="tel" placeholder="(614) 555-0123" />
            </Field>
          </div>

          {errorMessage ? <ErrorState compact title="Unable to send invitation" description={errorMessage} /> : null}

          {result?.ok ? (
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4" role="status">
              <p className="font-bold text-emerald-700 dark:text-emerald-200">Invitation sent</p>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{result.message}</p>
              {result.vendorCode ? <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">Trade Partner #{result.vendorCode}</p> : null}
              {result.warning ? <p className="mt-3 rounded-xl border border-amber-400/30 bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-100">{result.warning}</p> : null}
              {result.vendorId ? <Link href={`/vendors/${result.vendorId}`} className="mt-3 inline-flex text-sm font-bold text-blue-500 hover:underline">Open pending Trade Partner record</Link> : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border-subtle)] pt-5 sm:flex-row sm:justify-end">
            <Link href="/vendors">
              <Button type="button" variant="outline" size="lg">Cancel</Button>
            </Link>
            <Button type="submit" size="lg" disabled={isSending}>{isSending ? "Sending invitation…" : "Send Trade Partner Invitation"}</Button>
          </div>
        </form>

        <aside className="h-fit rounded-[var(--radius-2xl)] border border-blue-400/20 bg-blue-500/5 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-blue-500">What happens next</p>
          <div className="mt-4 space-y-4 text-sm leading-6 text-[var(--color-text-secondary)]">
            <Step number="1" text="B.O.S. automatically creates the next Trade Partner number, such as TP-000001." />
            <Step number="2" text="The invitation is delivered by email and/or SMS using the contact information above." />
            <Step number="3" text="The Trade Partner activates their secure account and completes their own onboarding profile and compliance documents." />
            <Step number="4" text="Their answers automatically populate the Trade Partner record in B.O.S." />
            <Step number="5" text="B.O.S. alerts company owners and administrators when onboarding is complete and ready for review." />
          </div>
        </aside>
      </div>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="space-y-2">
      <span className="flex items-center justify-between gap-3 text-sm font-bold text-[var(--color-text-primary)]">
        <span>{label}</span>
        {hint ? <span className="text-[11px] font-medium text-[var(--color-text-muted)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

function Step({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500 text-xs font-black text-white">{number}</span>
      <p>{text}</p>
    </div>
  );
}
