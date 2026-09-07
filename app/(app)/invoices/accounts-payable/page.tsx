"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, getButtonClassName } from "@/components/ui";
import { loadAccountsPayableSnapshot, type AccountsPayableSnapshot } from "@/lib/finance/ap-prevailing-wage";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type BillRow = { id: string; vendor_id: string; project_id: string | null; bill_number: string; vendor_invoice_number: string | null; bill_date: string; due_date: string | null; status: string; total_amount: number; amount_paid: number; balance_due: number };
type VendorRow = { id: string; display_name: string | null; company_name: string | null };
type ProjectRow = { id: string; name: string | null; project_number: string | null };
type QueryBuilder = { select: (columns: string) => QueryBuilder; eq: (column: string, value: unknown) => QueryBuilder; then: PromiseLike<{ data: unknown; error: { message?: string } | null }>["then"] };
type LooseClient = { from: (table: string) => QueryBuilder };

const EMPTY_SNAPSHOT: AccountsPayableSnapshot = { totalOpenBills: 0, totalApproved: 0, totalPaid: 0, totalOutstanding: 0, overdueOutstanding: 0, billCount: 0, overdueBillCount: 0 };
const AP_WRITE_ROLES = new Set(["owner", "administrator", "operations_manager", "office_manager", "accountant"]);

export default function AccountsPayablePage() {
  const { locale } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const currency = (value: number) => new Intl.NumberFormat(es ? "es-US" : "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number.isFinite(value) ? value : 0);
  const supabase = useMemo(() => createClient(), []);
  const [snapshot, setSnapshot] = useState<AccountsPayableSnapshot>(EMPTY_SNAPSHOT);
  const [bills, setBills] = useState<BillRow[]>([]);
  const [vendorNames, setVendorNames] = useState<Record<string, string>>({});
  const [projectNames, setProjectNames] = useState<Record<string, string>>({});
  const [canManage, setCanManage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!supabase) { setErrorMessage(es ? "No se puede conectar a las finanzas de B.O.S. en este momento." : "Unable to connect to B.O.S. finance right now."); setIsLoading(false); return; }
    setIsLoading(true); setErrorMessage(null);
    const workspace = await resolveWorkspaceContext(supabase);
    if (workspace.errorMessage || !workspace.context) { setErrorMessage(workspace.errorMessage || (es ? "No se pudo cargar el espacio de trabajo." : "Unable to load workspace.")); setIsLoading(false); return; }

    try {
      const companyId = workspace.context.companyId;
      const db = supabase as unknown as LooseClient;
      const [nextSnapshot, billsResult, vendorsResult, projectsResult] = await Promise.all([
        loadAccountsPayableSnapshot({ supabase, companyId }),
        db.from("vendor_bills").select("id,vendor_id,project_id,bill_number,vendor_invoice_number,bill_date,due_date,status,total_amount,amount_paid,balance_due").eq("company_id", companyId),
        db.from("vendors").select("id,display_name,company_name").eq("company_id", companyId),
        db.from("projects").select("id,name,project_number").eq("company_id", companyId),
      ]);
      if (billsResult.error) throw new Error(billsResult.error.message || (es ? "No se pudieron cargar las facturas de proveedores." : "Unable to load vendor bills."));
      if (vendorsResult.error) throw new Error(vendorsResult.error.message || (es ? "No se pudieron cargar los proveedores." : "Unable to load vendors."));
      if (projectsResult.error) throw new Error(projectsResult.error.message || (es ? "No se pudieron cargar los proyectos." : "Unable to load projects."));
      const nextBills = Array.isArray(billsResult.data) ? billsResult.data as BillRow[] : [];
      const vendors = Array.isArray(vendorsResult.data) ? vendorsResult.data as VendorRow[] : [];
      const projects = Array.isArray(projectsResult.data) ? projectsResult.data as ProjectRow[] : [];
      nextBills.sort((a, b) => String(b.bill_date || "").localeCompare(String(a.bill_date || "")));
      setSnapshot(nextSnapshot); setBills(nextBills); setCanManage(AP_WRITE_ROLES.has((workspace.context.role || "").toLowerCase()));
      setVendorNames(Object.fromEntries(vendors.map((row) => [row.id, row.display_name || row.company_name || (es ? "Proveedor" : "Vendor")])));
      setProjectNames(Object.fromEntries(projects.map((row) => [row.id, row.name || row.project_number || (es ? "Proyecto" : "Project")])));
    } catch (error) { setErrorMessage(error instanceof Error ? error.message : (es ? "No se pudieron cargar las cuentas por pagar." : "Unable to load accounts payable.")); }
    finally { setIsLoading(false); }
  }, [supabase, es]);

  useEffect(() => { queueMicrotask(() => void load()); }, [load]);

  return <div className="container-content space-y-[var(--space-section)]">
    <PageHeader compact eyebrow={l("FINANCE · ACCOUNTS PAYABLE", "FINANZAS · CUENTAS POR PAGAR")} title={l("Accounts Payable", "Cuentas por pagar")} description={l("Monitor vendor bills, approvals, payments, outstanding balances, and overdue exposure from one company-scoped command center.", "Controla facturas de proveedores, aprobaciones, pagos, saldos pendientes y exposición vencida desde un centro de comando de la empresa.")} primaryAction={canManage ? <Link href="/invoices/accounts-payable/new" className={getButtonClassName({ size: "md" })}>{l("New Vendor Bill", "Nueva factura de proveedor")}</Link> : undefined} />
    {errorMessage ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{errorMessage}</div> : null}
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><Metric label={l("Open Bills", "Facturas abiertas")} value={currency(snapshot.totalOpenBills)} detail={`${snapshot.billCount} ${l("active records", "registros activos")}`} /><Metric label={l("Outstanding", "Pendiente")} value={currency(snapshot.totalOutstanding)} detail={l("Remaining vendor liability", "Obligación restante con proveedores")} /><Metric label={l("Overdue", "Vencido")} value={currency(snapshot.overdueOutstanding)} detail={`${snapshot.overdueBillCount} ${l("overdue", "vencidas")}`} danger={snapshot.overdueOutstanding > 0} /><Metric label={l("Approved", "Aprobado")} value={currency(snapshot.totalApproved)} detail={l("Approved / paid bill value", "Valor de facturas aprobadas / pagadas")} /><Metric label={l("Paid", "Pagado")} value={currency(snapshot.totalPaid)} detail={l("Payments recorded", "Pagos registrados")} /></section>
    <section className="overflow-hidden rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] shadow-[var(--shadow-card)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--bos-border-subtle)] px-5 py-4"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--bos-text-muted)]">{l("Vendor bill register", "Registro de facturas de proveedores")}</p><h2 className="mt-1 text-lg font-semibold">{l("Current AP activity", "Actividad actual de cuentas por pagar")}</h2></div><div className="flex gap-4"><Link href="/vendors" className="text-sm font-semibold text-blue-400 hover:text-blue-300">{l("Vendors", "Proveedores")}</Link><Link href="/invoices/prevailing-wage" className="text-sm font-semibold text-blue-400 hover:text-blue-300">{l("Prevailing Wage", "Salario prevaleciente")} →</Link></div></div>
      {isLoading ? <p className="p-6 text-sm text-[var(--bos-text-secondary)]">{l("Loading accounts payable…", "Cargando cuentas por pagar…")}</p> : bills.length === 0 ? <div className="p-8 text-center"><p className="font-semibold">{l("No vendor bills yet.", "Aún no hay facturas de proveedores.")}</p><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{l("The AP foundation is active and ready for vendor bill entry.", "La base de cuentas por pagar está activa y lista para registrar facturas de proveedores.")}</p>{canManage ? <Link href="/invoices/accounts-payable/new" className="mt-4 inline-flex text-sm font-semibold text-blue-400">{l("Create first vendor bill", "Crear primera factura de proveedor")} →</Link> : null}</div> : <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-[var(--bos-bg-control)] text-xs uppercase tracking-[0.12em] text-[var(--bos-text-muted)]"><tr><th className="px-5 py-3">{l("Bill", "Factura")}</th><th className="px-5 py-3">{l("Vendor", "Proveedor")}</th><th className="px-5 py-3">{l("Project", "Proyecto")}</th><th className="px-5 py-3">{l("Due", "Vence")}</th><th className="px-5 py-3">{l("Status", "Estado")}</th><th className="px-5 py-3 text-right">{l("Total", "Total")}</th><th className="px-5 py-3 text-right">{l("Balance", "Saldo")}</th></tr></thead><tbody className="divide-y divide-[var(--bos-border-subtle)]">{bills.map((bill) => <tr key={bill.id} className="hover:bg-[var(--bos-bg-hover)]"><td className="px-5 py-4"><Link href={`/invoices/accounts-payable/${bill.id}`} className="font-semibold text-blue-400 hover:text-blue-300">{bill.bill_number}</Link><p className="text-xs text-[var(--bos-text-muted)]">{bill.vendor_invoice_number || bill.bill_date}</p></td><td className="px-5 py-4">{vendorNames[bill.vendor_id] || l("Vendor", "Proveedor")}</td><td className="px-5 py-4">{bill.project_id ? projectNames[bill.project_id] || l("Project", "Proyecto") : l("Company overhead", "Gastos generales de la empresa")}</td><td className="px-5 py-4">{bill.due_date || "—"}</td><td className="px-5 py-4"><StatusPill status={bill.status} es={es} /></td><td className="px-5 py-4 text-right font-medium">{currency(bill.total_amount)}</td><td className="px-5 py-4 text-right font-semibold">{currency(bill.balance_due)}</td></tr>)}</tbody></table></div>}
    </section>
  </div>;
}

function Metric({ label, value, detail, danger = false }: { label: string; value: string; detail: string; danger?: boolean }) { return <div className="rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)]"><p className="text-xs font-bold uppercase tracking-[0.15em] text-[var(--bos-text-muted)]">{label}</p><p className={`mt-2 text-2xl font-bold ${danger ? "text-red-400" : "text-[var(--bos-text-primary)]"}`}>{value}</p><p className="mt-1 text-xs text-[var(--bos-text-secondary)]">{detail}</p></div>; }
function StatusPill({ status, es }: { status: string; es: boolean }) { const normalized=(status || "draft").replaceAll("_", " "); const labels: Record<string,string>={draft:"Borrador",submitted:"Enviada",approved:"Aprobada",paid:"Pagada",partial:"Parcial",overdue:"Vencida",void:"Anulada"}; return <span className="inline-flex rounded-full border border-[var(--bos-border-default)] bg-[var(--bos-bg-control)] px-2.5 py-1 text-xs font-semibold capitalize">{es ? labels[(status || "draft").toLowerCase()] || normalized : normalized}</span>; }
