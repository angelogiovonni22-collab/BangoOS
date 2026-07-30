"use client";

import { useEffect, useMemo, useState } from "react";
import { ErrorState, SkeletonLoader } from "@/components/ui";
import { formatInvoiceDate } from "@/lib/invoices";
import { formatUsd } from "@/lib/invoices/calculations";
import { getCustomerDisplayName, getProjectDisplayName, loadInvoiceById, loadInvoiceFormOptions } from "@/lib/invoices/service";
import { formatInvoiceStatusLabel } from "@/lib/invoices/statuses";
import type { InvoiceLineItemRow, InvoiceRow } from "@/lib/invoices/types";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export function InvoicePrintView({ invoiceId }: { invoiceId: string }) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemRow[]>([]);
  const [customerName, setCustomerName] = useState("Not linked");
  const [projectName, setProjectName] = useState("Not linked");
  const [companyName, setCompanyName] = useState("BangoOS Construction");
  const [linkedChangeOrderNumbers, setLinkedChangeOrderNumbers] = useState<string[]>([]);

  useEffect(() => {
    let isSubscribed = true;

    const load = async () => {
      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage || "Unable to resolve workspace.");
          setIsLoading(false);
        }
        return;
      }

      const [invoiceResult, optionsResult, companyResult, changeOrderLinksResult] = await Promise.all([
        loadInvoiceById(supabase, workspace.context.companyId, invoiceId),
        loadInvoiceFormOptions(supabase, workspace.context.companyId),
        supabase.from("companies").select("name").eq("id", workspace.context.companyId).maybeSingle(),
        supabase
          .from("change_order_invoice_links")
          .select("change_order_id")
          .eq("company_id", workspace.context.companyId)
          .eq("invoice_id", invoiceId),
      ]);

      if (invoiceResult.error || !invoiceResult.data) {
        if (isSubscribed) {
          setErrorMessage(invoiceResult.error || "Invoice not found.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        setInvoice(invoiceResult.data.invoice);
        setLineItems(invoiceResult.data.lineItems);

        if (optionsResult.data) {
          const customer = optionsResult.data.customers.find((row) => row.id === invoiceResult.data?.invoice.customer_id);
          const project = optionsResult.data.projects.find((row) => row.id === invoiceResult.data?.invoice.project_id);

          setCustomerName(customer ? getCustomerDisplayName(customer) : "Not linked");
          setProjectName(project ? getProjectDisplayName(project) : "Not linked");
        }

        if (companyResult.data?.name) {
          setCompanyName(companyResult.data.name);
        }

        if (changeOrderLinksResult.data && changeOrderLinksResult.data.length > 0) {
          const linkedIds = changeOrderLinksResult.data.map((row) => row.change_order_id);
          const changeOrdersResult = await supabase
            .from("change_orders")
            .select("change_order_number")
            .eq("company_id", workspace.context.companyId)
            .in("id", linkedIds);

          if (!changeOrdersResult.error) {
            setLinkedChangeOrderNumbers((changeOrdersResult.data ?? []).map((row) => row.change_order_number).filter(Boolean));
          }
        } else {
          setLinkedChangeOrderNumbers([]);
        }

        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, invoiceId]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <SkeletonLoader className="h-16 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage || !invoice) {
    return <ErrorState title="Unable to load print view" description={errorMessage || "Invoice not found."} />;
  }

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-8 shadow-[var(--shadow-small)] print:shadow-none print:border-none print:rounded-none print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-6 border-b border-[var(--color-border-subtle)] pb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Company</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{companyName}</h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Professional Construction Services</p>
        </div>

        <div className="text-right">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Invoice</p>
          <h2 className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">{invoice.invoice_number || "Unassigned"}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{formatInvoiceStatusLabel(invoice.status)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <InfoCard title="Bill To" value={customerName} secondary={projectName === "Not linked" ? undefined : `Project: ${projectName}`} />
        <InfoCard title="Issue Date" value={formatInvoiceDate(invoice.issue_date, localeTag, "Not set")} />
        <InfoCard title="Due Date" value={formatInvoiceDate(invoice.due_date, localeTag, "Not set")} />
      </div>

      {linkedChangeOrderNumbers.length > 0 ? (
        <div className="mt-4 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Linked Change Orders</p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">{linkedChangeOrderNumbers.join(", ")}</p>
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="bg-[var(--color-primary-50)]/50 text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
              <th className="px-3 py-2">Description</th>
              <th className="px-3 py-2">Qty</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Rate</th>
              <th className="px-3 py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((lineItem) => (
              <tr key={lineItem.id} className="border-t border-[var(--color-border-subtle)]">
                <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{lineItem.description}</td>
                <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.quantity}</td>
                <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.unit}</td>
                <td className="px-3 py-2 text-right text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.rate, localeTag)}</td>
                <td className="px-3 py-2 text-right text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(lineItem.amount, localeTag)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Notes</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{invoice.notes || "No notes provided."}</p>
          </section>

          <section>
            <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">Payment Instructions</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm text-[var(--color-text-primary)]">{invoice.payment_terms || "Payment terms available upon request."}</p>
          </section>
        </div>

        <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
          <TotalRow label="Subtotal" value={formatUsd(invoice.subtotal, localeTag)} />
          <TotalRow label="Discount" value={`-${formatUsd(invoice.discount_total, localeTag)}`} />
          <TotalRow label="Tax" value={formatUsd(invoice.tax_amount, localeTag)} />
          <TotalRow label="Additional Fee" value={formatUsd(invoice.additional_fee, localeTag)} />
          <TotalRow label="Total" value={formatUsd(invoice.total_amount, localeTag)} emphasized />
          <TotalRow label="Paid" value={formatUsd(invoice.amount_paid, localeTag)} />
          <TotalRow label="Balance Due" value={formatUsd(Math.max(invoice.total_amount - invoice.amount_paid, 0), localeTag)} emphasized />
        </section>
      </div>
    </div>
  );
}

function InfoCard({ title, value, secondary }: { title: string; value: string; secondary?: string }) {
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{value}</p>
      {secondary ? <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{secondary}</p> : null}
    </div>
  );
}

function TotalRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={["flex items-center justify-between py-1.5", emphasized ? "border-t border-[var(--color-border-subtle)] mt-1 pt-3" : ""].join(" ")}>
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={emphasized ? "text-sm font-bold text-[var(--color-text-primary)]" : "text-sm font-semibold text-[var(--color-text-primary)]"}>{value}</span>
    </div>
  );
}
