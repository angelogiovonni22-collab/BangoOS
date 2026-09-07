"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader, getButtonClassName } from "@/components/ui";
import { InvoicesDirectory } from "@/components/invoices";
import { loadInvoiceDirectoryData, getCustomerDisplayName, getProjectDisplayName } from "@/lib/invoices/service";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export default function InvoicesPage() {
  const { locale, t } = useI18n();
  const es = locale === "es";
  const l = (en: string, spanish: string) => es ? spanish : en;
  const localeTag = es ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [items, setItems] = useState<Array<{ id: string; invoiceNumber: string; title: string; customerName: string; customerId: string | null; projectName: string; projectId: string | null; status: string; issueDate: string | null; dueDate: string | null; totalAmount: number; amountPaid: number; balanceDue: number; updatedAt: string }>>([]);
  const [customerOptions, setCustomerOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ value: string; label: string }>>([]);

  const load = useCallback(async () => {
    if (!supabase) { setErrorMessage(es ? "No se puede conectar en este momento. Inténtalo de nuevo en breve." : "Unable to connect right now. Please try again shortly."); setIsLoading(false); return; }
    setIsLoading(true); setErrorMessage(null);
    const workspace = await resolveWorkspaceContext(supabase);
    if (workspace.errorMessage || !workspace.context) { setErrorMessage(workspace.errorMessage || (es ? "No se pudo cargar el espacio de trabajo." : "Unable to load workspace.")); setIsLoading(false); return; }
    const result = await loadInvoiceDirectoryData(supabase, workspace.context.companyId);
    if (result.error || !result.customers || !result.projects || !result.invoices) { setErrorMessage(result.error || (es ? "No se pudieron cargar las facturas." : "Unable to load invoices.")); setIsLoading(false); return; }
    const customerMap = new Map(result.customers.map((customer) => [customer.id, getCustomerDisplayName(customer)]));
    const projectMap = new Map(result.projects.map((project) => [project.id, getProjectDisplayName(project)]));
    const now = new Date();
    setItems(result.invoices.map((invoice) => {
      const normalizedStatus = normalizeInvoiceStatus(invoice.status);
      const dueDate = invoice.due_date ? new Date(`${invoice.due_date}T00:00:00`) : null;
      const isOverdue = normalizedStatus !== "paid" && normalizedStatus !== "void" && dueDate && dueDate < now;
      const unassigned = es ? "Sin asignar" : "Unassigned";
      const notLinked = es ? "Sin vincular" : "Not linked";
      return { id: invoice.id, invoiceNumber: invoice.invoice_number || unassigned, title: invoice.title, customerName: invoice.customer_id ? customerMap.get(invoice.customer_id) || notLinked : notLinked, customerId: invoice.customer_id, projectName: invoice.project_id ? projectMap.get(invoice.project_id) || notLinked : notLinked, projectId: invoice.project_id, status: isOverdue ? "overdue" : normalizedStatus, issueDate: invoice.issue_date, dueDate: invoice.due_date, totalAmount: invoice.total_amount || 0, amountPaid: invoice.amount_paid || 0, balanceDue: Math.max((invoice.total_amount || 0) - (invoice.amount_paid || 0), 0), updatedAt: invoice.updated_at };
    }));
    setCustomerOptions(result.customers.map((customer) => ({ value: customer.id, label: getCustomerDisplayName(customer) })));
    setProjectOptions(result.projects.map((project) => ({ value: project.id, label: getProjectDisplayName(project) })));
    setIsLoading(false);
  }, [supabase, es]);

  useEffect(() => { queueMicrotask(() => { void load(); }); }, [load]);
  const workspaceCard = "group rounded-2xl border border-[var(--bos-border-default)] bg-[var(--bos-bg-panel)] p-5 shadow-[var(--shadow-card)] transition hover:bg-[var(--bos-bg-hover)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]";
  return <div className="container-content space-y-[var(--space-section)]">
    <PageHeader compact eyebrow={l("COMPANY WORKSPACE", "ESPACIO DE TRABAJO DE LA EMPRESA")} title={l("Invoices", "Facturas")} description={l("Create, issue, and track customer invoices and payments.", "Crea, emite y da seguimiento a las facturas y pagos de clientes.")} primaryAction={<Link href="/invoices/new" className={getButtonClassName({ size: "md" })}>{l("New Invoice", "Nueva factura")}</Link>} />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <Link href="/invoices/accounts-receivable" className={workspaceCard}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{l("Finance", "Finanzas")}</p><div className="mt-2 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{l("Accounts Receivable", "Cuentas por cobrar")}</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{l("Customer balances, collections, aging, and payment activity.", "Saldos de clientes, cobros, antigüedad y actividad de pagos.")}</p></div><span className="text-xl text-blue-400 transition group-hover:translate-x-1">→</span></div></Link>
      <Link href="/invoices/accounts-payable" className={workspaceCard}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{l("Finance", "Finanzas")}</p><div className="mt-2 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{l("Accounts Payable", "Cuentas por pagar")}</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{l("Vendor bills, approvals, balances, and overdue exposure.", "Facturas de proveedores, aprobaciones, saldos y exposición vencida.")}</p></div><span className="text-xl text-blue-400 transition group-hover:translate-x-1">→</span></div></Link>
      <Link href="/invoices/banking" className={workspaceCard}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{t("finance.finance")}</p><div className="mt-2 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{t("finance.banking")}</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{t("finance.bankingDescription")}</p></div><span className="text-xl text-blue-400 transition group-hover:translate-x-1">→</span></div></Link>
      <Link href="/invoices/payroll" className={workspaceCard}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{l("Workforce Finance", "Finanzas del personal")}</p><div className="mt-2 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{l("Payroll", "Nómina")}</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{l("Approved time, weekly overtime, gross pay, approvals, and provider handoff.", "Tiempo aprobado, horas extra semanales, pago bruto, aprobaciones y entrega al proveedor de nómina.")}</p></div><span className="text-xl text-blue-400 transition group-hover:translate-x-1">→</span></div></Link>
      <Link href="/invoices/prevailing-wage" className={workspaceCard}><p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--bos-text-muted)]">{l("Commercial Compliance", "Cumplimiento comercial")}</p><div className="mt-2 flex items-center justify-between gap-4"><div><h2 className="text-lg font-semibold">{l("Prevailing Wage", "Salario prevaleciente")}</h2><p className="mt-1 text-sm text-[var(--bos-text-secondary)]">{l("DBRA, Ohio public work, certified payroll, and wage deficiencies.", "DBRA, obra pública de Ohio, nómina certificada y deficiencias salariales.")}</p></div><span className="text-xl text-blue-400 transition group-hover:translate-x-1">→</span></div></Link>
    </div>
    <InvoicesDirectory items={items} customerOptions={customerOptions} projectOptions={projectOptions} localeTag={localeTag} isLoading={isLoading} errorMessage={errorMessage} />
  </div>;
}
