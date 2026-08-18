"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";

export default function ActivateTradePartnerPage() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "working" | "error">("idle");
  const [message, setMessage] = useState("");

  const tokenHash = searchParams.get("token_hash") || "";
  const type = searchParams.get("type") || "";
  const next = searchParams.get("next") || "/partner/welcome";

  async function continueSetup() {
    if (!tokenHash || !type) {
      setStatus("error");
      setMessage("This setup link is incomplete. Request a fresh Trade Partner invitation.");
      return;
    }

    setStatus("working");
    setMessage("");

    try {
      const response = await fetch("/api/auth/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenHash, type, next }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; next?: string; error?: string };
      if (!response.ok || !payload.ok) {
        setStatus("error");
        setMessage(payload.error || "This setup link is invalid or has expired. Request a fresh Trade Partner invitation.");
        return;
      }
      window.location.assign(payload.next || "/partner/welcome");
    } catch {
      setStatus("error");
      setMessage("B.O.S. could not verify this setup link. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-[#061421] px-5 py-16 text-white">
      <div className="mx-auto max-w-xl rounded-2xl border border-sky-800/70 bg-[#081a2b] p-8 shadow-2xl">
        <div className="text-sm font-bold tracking-[0.22em] text-sky-300">B.O.S. TRADE PARTNER</div>
        <h1 className="mt-4 text-3xl font-bold">Finish your secure account setup</h1>
        <p className="mt-4 leading-7 text-slate-300">
          Continue below to verify this invitation and create your B.O.S. Trade Partner password. Your access remains limited to the projects assigned to your Trade Partner company.
        </p>

        {status === "error" ? (
          <div className="mt-6 rounded-xl border border-red-300/40 bg-red-950/40 px-4 py-3 text-sm text-red-100">{message}</div>
        ) : null}

        <button
          type="button"
          onClick={continueSetup}
          disabled={status === "working"}
          className="mt-7 w-full rounded-xl bg-sky-500 px-5 py-3.5 font-bold text-white transition hover:bg-sky-400 disabled:cursor-wait disabled:opacity-70"
        >
          {status === "working" ? "Verifying secure invitation…" : "Continue to Create Password"}
        </button>

        <p className="mt-5 text-xs leading-5 text-slate-400">
          For security, invitation verification occurs only after you press Continue. This prevents automated email security scanners from activating the link before you do.
        </p>
      </div>
    </main>
  );
}
