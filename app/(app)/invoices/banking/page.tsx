"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, getButtonClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { loadBankingWorkspace, suggestReconciliationMatches, type BankingWorkspace } from "@/lib/banking/service";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function BankingPage() {
  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<BankingWorkspace | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setError("Unable to connect right now."); setLoading(false); return; }
    setLoading(true); setError(null);
    const context = await resolveWorkspaceContext(supabase);
    if (!context.context) { setError(context.errorMessage || "Unable to load workspace."); setLoading(false); return; }
    setCompanyId(context.context.companyId);
    const result = await loadBankingWorkspace(supabase, context.context.companyId);
    if (result.error) setError(result.error); else setWorkspace(result.data);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);

  const suggestMatches = async () => {
    if (!supabase || !companyId) return;
    setMatching(true); setError(null);
    const result = await suggestReconciliationMatches(supabase, companyId);
    if (result.error) setError(result.error); else await load();
    setMatching(false);
  };

  const card = "rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]";
  const forecast = workspace?.forecast.filter((_, index) => index % 7 === 0).slice(0, 9) ?? [];

  return <div className="container-content space-y-[var(--space-section)]">
    <PageHeader compact eyebrow="FINANCE" title="Banking & Reconciliation" description="Provider-agnostic bank ledger, transaction matching, reconciliation status, and forward cash visibility." primaryAction={<button type="button" onClick={() => void suggestMatches()} disabled={matching || loading || !workspace?.transactions.length} className={getButtonClassName({ size: "md" })}>{matching ? "Matching…" : "Suggest matches"}</button>} />

    {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
    {loading ? <div className={card}>Loading banking workspace…</div> : null}

    {!loading && workspace ? <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Forecast cash</p><p className="mt-2 text-2xl font-semibold">{money.format(workspace.cashBalance)}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">Included active bank accounts</p></div>
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Bank accounts</p><p className="mt-2 text-2xl font-semibold">{workspace.accounts.length}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">Provider or manually managed</p></div>
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Needs review</p><p className="mt-2 text-2xl font-semibold">{workspace.unmatchedCount}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">Unmatched or suggested transactions</p></div>
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">Reconciled</p><p className="mt-2 text-2xl font-semibold">{workspace.matchedCount}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">Confirmed transaction matches</p></div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={card}><div className="flex items-center justify-between"><div><h2 className="text-lg font-semibold">Bank accounts</h2><p className="text-sm text-[var(--bos-text-secondary)]">Credentials remain outside B.O.S.; only provider identifiers and balances live here.</p></div></div><div className="mt-4 space-y-3">{workspace.accounts.length ? workspace.accounts.map(account => <div key={account.id} className="rounded-xl border border-[var(--bos-border-subtle)] p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{account.name}{account.mask ? ` •••• ${account.mask}` : ""}</p><p className="text-sm capitalize text-[var(--bos-text-secondary)]">{account.accountType} · {account.status}</p></div><div className="text-right"><p className="font-semibold">{money.format(account.currentBalance ?? 0)}</p><p className="text-xs text-[var(--bos-text-muted)]">Current balance</p></div></div></div>) : <div className="rounded-xl border border-dashed border-[var(--bos-border-default)] p-5 text-sm text-[var(--bos-text-secondary)]">No bank accounts are connected yet. The internal banking foundation is ready; live provider linking remains intentionally disabled until credentials/provider access are supplied.</div>}</div></section>

        <section className={card}><h2 className="text-lg font-semibold">Reconciliation queue</h2><p className="text-sm text-[var(--bos-text-secondary)]">Imported transactions are matched to existing B.O.S. payment and receipt records without changing the accounting source records.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--bos-border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--bos-text-muted)]"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Description</th><th className="py-2 pr-3">Amount</th><th className="py-2">Status</th></tr></thead><tbody>{workspace.transactions.slice(0,12).map(tx => <tr key={tx.id} className="border-b border-[var(--bos-border-subtle)]"><td className="py-3 pr-3">{tx.transactionDate}</td><td className="py-3 pr-3"><p className="font-medium">{tx.merchantName || tx.description}</p>{tx.merchantName ? <p className="text-xs text-[var(--bos-text-muted)]">{tx.description}</p> : null}</td><td className="py-3 pr-3 font-medium">{tx.direction === "debit" ? "−" : "+"}{money.format(tx.amount)}</td><td className="py-3 capitalize">{tx.reconciliationStatus}</td></tr>)}{!workspace.transactions.length ? <tr><td colSpan={4} className="py-8 text-center text-[var(--bos-text-secondary)]">No bank transactions have been ingested.</td></tr> : null}</tbody></table></div></section>
      </div>

      <section className={card}><h2 className="text-lg font-semibold">60-day cash-flow forecast</h2><p className="text-sm text-[var(--bos-text-secondary)]">Starts with included bank balances, then layers open invoice receivables, vendor-bill obligations, and approved forecast adjustments by expected date.</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--bos-border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--bos-text-muted)]"><th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Inflows</th><th className="py-2 pr-3">Outflows</th><th className="py-2 pr-3">Net</th><th className="py-2">Projected cash</th></tr></thead><tbody>{forecast.map(day => <tr key={day.date} className="border-b border-[var(--bos-border-subtle)]"><td className="py-3 pr-3">{day.date}</td><td className="py-3 pr-3">{money.format(day.inflow)}</td><td className="py-3 pr-3">{money.format(day.outflow)}</td><td className="py-3 pr-3">{money.format(day.net)}</td><td className="py-3 font-semibold">{money.format(day.projectedBalance)}</td></tr>)}</tbody></table></div></section>
    </> : null}
  </div>;
}
