"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status";
import { formatInvoiceDate } from "@/lib/invoices";
import { formatUsd } from "@/lib/invoices/calculations";
import { getCustomerDisplayName, getProjectDisplayName, loadInvoiceById, loadInvoiceFormOptions, markInvoicePaid, sendInvoice, voidInvoice } from "@/lib/invoices/service";
import type { InvoiceLineItemRow, InvoicePaymentRow, InvoiceRow } from "@/lib/invoices/types";
import { normalizeInvoiceStatus } from "@/lib/invoices/statuses";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

export function InvoiceDetail({ invoiceId }: { invoiceId: string }) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [invoice, setInvoice] = useState<InvoiceRow | null>(null);
  const [lineItems, setLineItems] = useState<InvoiceLineItemRow[]>([]);
  const [payments, setPayments] = useState<InvoicePaymentRow[]>([]);
  const [customerName, setCustomerName] = useState("Not linked");
  const [projectName, setProjectName] = useState("Not linked");
  const [linkedChangeOrders, setLinkedChangeOrders] = useState<Array<{ id: string; number: string; title: string }>>([]);

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

      const invoiceResult = await loadInvoiceById(supabase, workspace.context.companyId, invoiceId);

      if (invoiceResult.error || !invoiceResult.data) {
        if (isSubscribed) {
          setErrorMessage(invoiceResult.error || "Invoice not found.");
          setIsLoading(false);
        }
        return;
      }

      const [optionsResult, changeOrderLinksResult] = await Promise.all([
        loadInvoiceFormOptions(supabase, workspace.context.companyId),
        supabase
          .from("change_order_invoice_links")
          .select("change_order_id")
          .eq("company_id", workspace.context.companyId)
          .eq("invoice_id", invoiceId),
      ]);

      if (isSubscribed) {
        setCompanyId(workspace.context.companyId);
        setUserId(workspace.context.userId);
        setInvoice(invoiceResult.data.invoice);
        setLineItems(invoiceResult.data.lineItems);
        setPayments(invoiceResult.data.payments);

        if (optionsResult.data) {
          const customer = optionsResult.data.customers.find((row) => row.id === invoiceResult.data?.invoice.customer_id);
          const project = optionsResult.data.projects.find((row) => row.id === invoiceResult.data?.invoice.project_id);

          setCustomerName(customer ? getCustomerDisplayName(customer) : "Not linked");
          setProjectName(project ? getProjectDisplayName(project) : "Not linked");
        }

        if (changeOrderLinksResult.data && changeOrderLinksResult.data.length > 0) {
          const linkedIds = changeOrderLinksResult.data.map((row) => row.change_order_id);
          const changeOrdersResult = await supabase
            .from("change_orders")
            .select("id, change_order_number, title")
            .eq("company_id", workspace.context.companyId)
            .in("id", linkedIds);

          if (!changeOrdersResult.error) {
            setLinkedChangeOrders(
              (changeOrdersResult.data ?? []).map((row) => ({
                id: row.id,
                number: row.change_order_number,
                title: row.title,
              })),
            );
          }
        } else {
          setLinkedChangeOrders([]);
        }

        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, invoiceId]);

  async function handleSend() {
    if (!supabase || !companyId || !userId || !invoice) {
      return;
    }

    const result = await sendInvoice({
      supabase,
      companyId,
      invoiceId,
      userId,
    });

    if (!result.error) {
      router.refresh();
    }
  }

  async function handleMarkPaid() {
    if (!supabase || !companyId || !userId || !invoice) {
      return;
    }

    const result = await markInvoicePaid({
      supabase,
      companyId,
      invoiceId,
      userId,
    });

    if (!result.error) {
      router.refresh();
    }
  }

  async function handleVoid() {
    if (!supabase || !companyId || !userId || !invoice) {
      return;
    }

    const result = await voidInvoice({
      supabase,
      companyId,
      invoiceId,
      userId,
    });

    if (!result.error) {
      router.refresh();
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader className="h-12 w-96" />
        <SkeletonLoader className="h-44 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage || !invoice) {
    return <ErrorState title="Unable to load invoice" description={errorMessage || "Invoice not found."} />;
  }

  const balanceDue = Math.max(invoice.total_amount - invoice.amount_paid, 0);
  const status = normalizeInvoiceStatus(invoice.status);
  const canSend = status === "draft";
  const canMarkPaid = ["sent", "viewed", "partially_paid", "overdue"].includes(status) && balanceDue > 0;
  const canVoid = status !== "paid" && status !== "void";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={`${invoice.invoice_number || "Unassigned"} · ${invoice.title}`}
        description="Review invoice details, balances, and payment history in a read-only profile."
        secondaryActions={(
          <>
            <Link href={`/invoices/${invoiceId}/print`}>
              <Button type="button" variant="secondary" size="md">Print</Button>
            </Link>
            <Button type="button" variant="secondary" size="md" onClick={handleSend} disabled={!canSend}>Send</Button>
            <Button type="button" variant="secondary" size="md" onClick={handleMarkPaid} disabled={!canMarkPaid}>Mark Paid</Button>
            <Button type="button" variant="secondary" size="md" onClick={handleVoid} disabled={!canVoid}>Void</Button>
          </>
        )}
        primaryAction={(
          <Link href={`/invoices/${invoiceId}/edit`} className={getButtonClassName({ size: "md" })}>Edit Invoice</Link>
        )}
      />

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Invoice Header</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <DetailRow label="Status" value={<InvoiceStatusBadge status={invoice.status} />} />
          <DetailRow label="Customer" value={customerName} />
          <DetailRow label="Project" value={projectName} />
          <DetailRow label="Issue Date" value={formatInvoiceDate(invoice.issue_date, localeTag, "Not set")} />
          <DetailRow label="Due Date" value={formatInvoiceDate(invoice.due_date, localeTag, "Not set")} />
          <DetailRow label="Amount" value={formatUsd(invoice.total_amount, localeTag)} />
          <DetailRow label="Paid" value={formatUsd(invoice.amount_paid, localeTag)} />
          <DetailRow label="Balance Due" value={formatUsd(balanceDue, localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Customer Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-primary)]">{customerName}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{invoice.description || "No invoice description provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Project Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-primary)]">{projectName}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-[860px] w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Rate</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem) => (
                <tr key={lineItem.id} className="border-t border-[var(--color-border-subtle)]">
                  <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{lineItem.description}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.quantity}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.unit}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.rate, localeTag)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(lineItem.amount, localeTag)}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Amounts</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailRow label="Subtotal" value={formatUsd(invoice.subtotal, localeTag)} />
          <DetailRow label="Discount" value={formatUsd(invoice.discount_total, localeTag)} />
          <DetailRow label="Tax" value={formatUsd(invoice.tax_amount, localeTag)} />
          <DetailRow label="Additional Fee" value={formatUsd(invoice.additional_fee, localeTag)} />
          <DetailRow label="Total" value={formatUsd(invoice.total_amount, localeTag)} />
          <DetailRow label="Balance Due" value={formatUsd(balanceDue, localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{invoice.notes || "No notes provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Linked Change Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {linkedChangeOrders.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No change orders linked to this invoice yet.</p>
          ) : (
            <div className="space-y-2">
              {linkedChangeOrders.map((item) => (
                <article key={item.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2.5">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{item.number || "Unassigned"}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.title}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <EmptyState compact icon="$" title="No payments recorded" description="Payments posted to this invoice will appear here." />
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <article key={payment.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(payment.amount, localeTag)}</p>
                    <p className="text-xs text-[var(--color-text-secondary)]">{formatInvoiceDate(payment.payment_date, localeTag, "Not set")}</p>
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{payment.method || "manual"} · {payment.status}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{payment.notes || "No note provided."}</p>
                </article>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[var(--color-text-muted)]">{label}</p>
      <div className="mt-1 text-sm text-[var(--color-text-primary)]">{value}</div>
    </div>
  );
}
