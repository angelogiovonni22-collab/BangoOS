"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, getButtonClassName } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { loadBankingWorkspace, suggestReconciliationMatches, type BankingWorkspace } from "@/lib/banking/service";
import { useI18n } from "@/lib/i18n/provider";

export default function BankingPage() {
  const { locale } = useI18n();
  const es = locale === "es";
  const money = useMemo(() => new Intl.NumberFormat(es ? "es-US" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }), [es]);
  const c = es ? {
    eyebrow: "FINANZAS", title: "Banca y conciliación", description: "Libro bancario independiente del proveedor, coincidencia de transacciones, estado de conciliación y visibilidad futura del efectivo.", suggest: "Sugerir coincidencias", matching: "Buscando coincidencias…", loading: "Cargando espacio de banca…",
    forecastCash: "Efectivo proyectado", includedAccounts: "Cuentas bancarias activas incluidas", bankAccounts: "Cuentas bancarias", providerManaged: "Administradas por proveedor o manualmente", needsReview: "Requiere revisión", unmatched: "Transacciones sin coincidencia o sugeridas", reconciled: "Conciliadas", confirmed: "Coincidencias de transacciones confirmadas",
    accountsHelp: "Las credenciales permanecen fuera de B.O.S.; aquí solo se guardan identificadores del proveedor y saldos.", currentBalance: "Saldo actual", none: "Todavía no hay cuentas bancarias conectadas. La base bancaria interna está lista; la vinculación con proveedores permanece deshabilitada intencionalmente hasta que se proporcionen las credenciales o el acceso del proveedor.",
    queue: "Cola de conciliación", queueHelp: "Las transacciones importadas se comparan con los pagos y recibos existentes de B.O.S. sin modificar los registros contables de origen.", date: "Fecha", descriptionCol: "Descripción", amount: "Importe", status: "Estado", noTx: "No se han importado transacciones bancarias.",
    forecast: "Pronóstico de flujo de efectivo a 60 días", forecastHelp: "Comienza con los saldos bancarios incluidos y luego incorpora cuentas por cobrar abiertas, obligaciones de facturas de proveedores y ajustes de pronóstico aprobados por fecha esperada.", inflows: "Entradas", outflows: "Salidas", net: "Neto", projected: "Efectivo proyectado",
    connectError: "No se puede conectar en este momento.", workspaceError: "No se puede cargar el espacio de trabajo."
  } : {
    eyebrow: "FINANCE", title: "Banking & Reconciliation", description: "Provider-agnostic bank ledger, transaction matching, reconciliation status, and forward cash visibility.", suggest: "Suggest matches", matching: "Matching…", loading: "Loading banking workspace…",
    forecastCash: "Forecast cash", includedAccounts: "Included active bank accounts", bankAccounts: "Bank accounts", providerManaged: "Provider or manually managed", needsReview: "Needs review", unmatched: "Unmatched or suggested transactions", reconciled: "Reconciled", confirmed: "Confirmed transaction matches",
    accountsHelp: "Credentials remain outside B.O.S.; only provider identifiers and balances live here.", currentBalance: "Current balance", none: "No bank accounts are connected yet. The internal banking foundation is ready; live provider linking remains intentionally disabled until credentials/provider access are supplied.",
    queue: "Reconciliation queue", queueHelp: "Imported transactions are matched to existing B.O.S. payment and receipt records without changing the accounting source records.", date: "Date", descriptionCol: "Description", amount: "Amount", status: "Status", noTx: "No bank transactions have been ingested.",
    forecast: "60-day cash-flow forecast", forecastHelp: "Starts with included bank balances, then layers open invoice receivables, vendor-bill obligations, and approved forecast adjustments by expected date.", inflows: "Inflows", outflows: "Outflows", net: "Net", projected: "Projected cash",
    connectError: "Unable to connect right now.", workspaceError: "Unable to load workspace."
  };

  const supabase = useMemo(() => createClient(), []);
  const [workspace, setWorkspace] = useState<BankingWorkspace | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [matching, setMatching] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) { setError(c.connectError); setLoading(false); return; }
    setLoading(true); setError(null);
    const context = await resolveWorkspaceContext(supabase);
    if (!context.context) { setError(context.errorMessage || c.workspaceError); setLoading(false); return; }
    setCompanyId(context.context.companyId);
    const result = await loadBankingWorkspace(supabase, context.context.companyId);
    if (result.error) setError(result.error); else setWorkspace(result.data);
    setLoading(false);
  }, [supabase, c.connectError, c.workspaceError]);

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
    <PageHeader compact eyebrow={c.eyebrow} title={c.title} description={c.description} primaryAction={<button type="button" onClick={() => void suggestMatches()} disabled={matching || loading || !workspace?.transactions.length} className={getButtonClassName({ size: "md" })}>{matching ? c.matching : c.suggest}</button>} />
    {error ? <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div> : null}
    {loading ? <div className={card}>{c.loading}</div> : null}
    {!loading && workspace ? <>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{c.forecastCash}</p><p className="mt-2 text-2xl font-semibold">{money.format(workspace.cashBalance)}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{c.includedAccounts}</p></div>
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{c.bankAccounts}</p><p className="mt-2 text-2xl font-semibold">{workspace.accounts.length}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{c.providerManaged}</p></div>
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{c.needsReview}</p><p className="mt-2 text-2xl font-semibold">{workspace.unmatchedCount}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{c.unmatched}</p></div>
        <div className={card}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{c.reconciled}</p><p className="mt-2 text-2xl font-semibold">{workspace.matchedCount}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{c.confirmed}</p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={card}><h2 className="text-lg font-semibold">{c.bankAccounts}</h2><p className="text-sm text-[var(--bos-text-secondary)]">{c.accountsHelp}</p><div className="mt-4 space-y-3">{workspace.accounts.length ? workspace.accounts.map(account => <div key={account.id} className="rounded-xl border border-[var(--bos-border-subtle)] p-4"><div className="flex items-start justify-between gap-4"><div><p className="font-semibold">{account.name}{account.mask ? ` •••• ${account.mask}` : ""}</p><p className="text-sm capitalize text-[var(--bos-text-secondary)]">{account.accountType} · {account.status}</p></div><div className="text-right"><p className="font-semibold">{money.format(account.currentBalance ?? 0)}</p><p className="text-xs text-[var(--bos-text-muted)]">{c.currentBalance}</p></div></div></div>) : <div className="rounded-xl border border-dashed border-[var(--bos-border-default)] p-5 text-sm text-[var(--bos-text-secondary)]">{c.none}</div>}</div></section>
        <section className={card}><h2 className="text-lg font-semibold">{c.queue}</h2><p className="text-sm text-[var(--bos-text-secondary)]">{c.queueHelp}</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--bos-border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--bos-text-muted)]"><th className="py-2 pr-3">{c.date}</th><th className="py-2 pr-3">{c.descriptionCol}</th><th className="py-2 pr-3">{c.amount}</th><th className="py-2">{c.status}</th></tr></thead><tbody>{workspace.transactions.slice(0,12).map(tx => <tr key={tx.id} className="border-b border-[var(--bos-border-subtle)]"><td className="py-3 pr-3">{tx.transactionDate}</td><td className="py-3 pr-3"><p className="font-medium">{tx.merchantName || tx.description}</p>{tx.merchantName ? <p className="text-xs text-[var(--bos-text-muted)]">{tx.description}</p> : null}</td><td className="py-3 pr-3 font-medium">{tx.direction === "debit" ? "−" : "+"}{money.format(tx.amount)}</td><td className="py-3 capitalize">{tx.reconciliationStatus}</td></tr>)}{!workspace.transactions.length ? <tr><td colSpan={4} className="py-8 text-center text-[var(--bos-text-secondary)]">{c.noTx}</td></tr> : null}</tbody></table></div></section>
      </div>
      <section className={card}><h2 className="text-lg font-semibold">{c.forecast}</h2><p className="text-sm text-[var(--bos-text-secondary)]">{c.forecastHelp}</p><div className="mt-4 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-[var(--bos-border-subtle)] text-left text-xs uppercase tracking-wide text-[var(--bos-text-muted)]"><th className="py-2 pr-3">{c.date}</th><th className="py-2 pr-3">{c.inflows}</th><th className="py-2 pr-3">{c.outflows}</th><th className="py-2 pr-3">{c.net}</th><th className="py-2">{c.projected}</th></tr></thead><tbody>{forecast.map(day => <tr key={day.date} className="border-b border-[var(--bos-border-subtle)]"><td className="py-3 pr-3">{day.date}</td><td className="py-3 pr-3">{money.format(day.inflow)}</td><td className="py-3 pr-3">{money.format(day.outflow)}</td><td className="py-3 pr-3">{money.format(day.net)}</td><td className="py-3 font-semibold">{money.format(day.projectedBalance)}</td></tr>)}</tbody></table></div></section>
    </> : null}
  </div>;
}
