"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, ErrorState, PageHeader, Select, SkeletonLoader, getButtonClassName } from "@/components/ui";
import { ChangeOrderStatusBadge } from "@/components/change-orders/change-order-status";
import { formatUsd } from "@/lib/change-orders/calculations";
import {
  addChangeOrderToExistingInvoice,
  approveChangeOrder,
  archiveChangeOrder,
  createInvoiceFromChangeOrder,
  getCustomerDisplayName,
  getProjectDisplayName,
  loadChangeOrderById,
  loadChangeOrderFormOptions,
  rejectChangeOrder,
  reopenChangeOrder,
  restoreChangeOrder,
  submitForApproval,
  voidChangeOrder,
} from "@/lib/change-orders/service";
import { formatChangeOrderStatusLabel, normalizeChangeOrderStatus } from "@/lib/change-orders/statuses";
import type { ChangeOrderLineItemRow, ChangeOrderRow } from "@/lib/change-orders/types";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";
import { BlueprintSourceLink } from "@/components/plans/blueprint-source-link";

export function ChangeOrderDetail({ changeOrderId }: { changeOrderId: string }) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [changeOrder, setChangeOrder] = useState<ChangeOrderRow | null>(null);
  const [lineItems, setLineItems] = useState<ChangeOrderLineItemRow[]>([]);
  const [customerName, setCustomerName] = useState("Not linked");
  const [projectName, setProjectName] = useState("Not linked");
  const [invoiceLinks, setInvoiceLinks] = useState<Array<{ id: string; invoiceId: string; amountApplied: number; linkType: string; createdAt: string }>>([]);
  const [activity, setActivity] = useState<Array<{ id: string; activityType: string; description: string; createdAt: string }>>([]);
  const [existingInvoiceOptions, setExistingInvoiceOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

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
      setActionMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage || "Unable to resolve workspace.");
          setIsLoading(false);
        }
        return;
      }

      const [detailResult, optionsResult] = await Promise.all([
        loadChangeOrderById(supabase, workspace.context.companyId, changeOrderId),
        loadChangeOrderFormOptions(supabase, workspace.context.companyId),
      ]);

      if (detailResult.error || !detailResult.data) {
        if (isSubscribed) {
          setErrorMessage(detailResult.error || "Change order not found.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        const row = detailResult.data.changeOrder;

        setCompanyId(workspace.context.companyId);
        setUserId(workspace.context.userId);
        setChangeOrder(row);
        setLineItems(detailResult.data.lineItems);
        setInvoiceLinks(detailResult.data.invoiceLinks.map((link) => ({
          id: link.id,
          invoiceId: link.invoice_id,
          amountApplied: link.amount_applied,
          linkType: link.link_type,
          createdAt: link.created_at,
        })));
        setActivity(detailResult.data.activity.map((item) => ({
          id: item.id,
          activityType: item.activity_type,
          description: item.description,
          createdAt: item.created_at,
        })));

        if (optionsResult.data) {
          const customer = optionsResult.data.customers.find((value) => value.id === row.customer_id);
          const project = optionsResult.data.projects.find((value) => value.id === row.project_id);

          setCustomerName(customer ? getCustomerDisplayName(customer) : "Not linked");
          setProjectName(project ? getProjectDisplayName(project) : "Not linked");

          const invoiceCandidates = optionsResult.data.invoices.filter((invoice) => {
            if (normalizeChangeOrderStatus(invoice.status) === "void") {
              return false;
            }

            if (row.customer_id && invoice.customer_id && row.customer_id !== invoice.customer_id) {
              return false;
            }

            if (row.project_id && invoice.project_id && row.project_id !== invoice.project_id) {
              return false;
            }

            return true;
          });

          const options = invoiceCandidates.map((invoice) => ({
            id: invoice.id,
            label: `${invoice.invoice_number || "Unassigned"} - ${invoice.title}`,
          }));

          setExistingInvoiceOptions(options);
          setSelectedInvoiceId(options[0]?.id || "");
        }

        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, changeOrderId]);

  async function runAction(action: "submit" | "approve" | "reject" | "reopen" | "void" | "archive" | "restore") {
    if (!supabase || !companyId || !userId || !changeOrder) {
      return;
    }

    let error: string | null = null;

    if (action === "submit") {
      const result = await submitForApproval({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (action === "approve") {
      setIsApproveDialogOpen(true);
      return;
    }

    if (action === "reject") {
      const reason = window.prompt("Enter an optional rejection reason:", "") || "";
      if (!window.confirm("Reject this change order?")) {
        return;
      }
      const result = await rejectChangeOrder({ supabase, companyId, changeOrderId, userId, reason });
      error = result.error;
    }

    if (action === "reopen") {
      if (!window.confirm("Reopen this change order to draft?")) {
        return;
      }
      const result = await reopenChangeOrder({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (action === "void") {
      if (!window.confirm("Void this change order?")) {
        return;
      }
      const result = await voidChangeOrder({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (action === "archive") {
      if (!window.confirm("Archive this change order?")) {
        return;
      }
      const result = await archiveChangeOrder({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (action === "restore") {
      const result = await restoreChangeOrder({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (error) {
      setActionMessage(error);
      return;
    }

    router.refresh();
  }

  async function confirmApproveAction() {
    if (!supabase || !companyId || !userId || !changeOrder || isApproving) {
      return;
    }

    setIsApproving(true);
    const result = await approveChangeOrder({ supabase, companyId, changeOrderId, userId });
    setIsApproving(false);
    setIsApproveDialogOpen(false);

    if (result.error) {
      setActionMessage(result.error);
      return;
    }

    router.refresh();
  }

  async function handleAddToExistingInvoice() {
    if (!supabase || !companyId || !userId || !selectedInvoiceId) {
      return;
    }

    if (!window.confirm("Add this change order to the selected invoice?")) {
      return;
    }

    const result = await addChangeOrderToExistingInvoice({
      supabase,
      companyId,
      changeOrderId,
      invoiceId: selectedInvoiceId,
      userId,
      linkType: "manual",
    });

    if (result.error) {
      setActionMessage(result.error);
      return;
    }

    router.refresh();
  }

  async function handleCreateInvoiceFromChangeOrder() {
    if (!supabase || !companyId || !userId) {
      return;
    }

    if (!window.confirm("Create a new invoice from this approved change order?")) {
      return;
    }

    const result = await createInvoiceFromChangeOrder({
      supabase,
      companyId,
      changeOrderId,
      userId,
    });

    if (result.error || !result.invoiceId) {
      setActionMessage(result.error || "Unable to create invoice.");
      return;
    }

    router.push(`/invoices/${result.invoiceId}/edit`);
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

  if (errorMessage || !changeOrder) {
    return <ErrorState title="Unable to load change order" description={errorMessage || "Change order not found."} />;
  }

  const status = normalizeChangeOrderStatus(changeOrder.status);
  const isArchived = !!changeOrder.archived_at;
  const canSubmit = status === "draft";
  const canApprove = status === "pending_approval";
  const canReject = status === "pending_approval";
  const canReopen = status === "approved" || status === "rejected";
  const canAddToInvoice = status === "approved" && !isArchived;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={`${changeOrder.change_order_number} · ${changeOrder.title}`}
        description="Central command view for scope, approvals, schedule impact, and invoice conversion."
        secondaryActions={(
          <>
            <Link href={`/change-orders/${changeOrderId}/print`}>
              <Button type="button" variant="secondary" size="md">Print</Button>
            </Link>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("submit")} disabled={!canSubmit}>Submit for Approval</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("approve")} disabled={!canApprove}>Approve</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("reject")} disabled={!canReject}>Reject</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("reopen")} disabled={!canReopen}>Reopen</Button>
            <Button type="button" variant="danger" size="md" onClick={() => void runAction("void")} disabled={status === "void"}>Void</Button>
            {isArchived ? (
              <Button type="button" variant="secondary" size="md" onClick={() => void runAction("restore")}>Restore</Button>
            ) : (
              <Button type="button" variant="secondary" size="md" onClick={() => void runAction("archive")}>Archive</Button>
            )}
          </>
        )}
        primaryAction={(
          <Link href={`/change-orders/${changeOrderId}/edit`} className={getButtonClassName({ size: "md" })}>Edit Change Order</Link>
        )}
      />

      <BlueprintSourceLink targetType="change_order" targetIds={[changeOrder.id]} />

      {actionMessage ? <ErrorState title="Action result" description={actionMessage} compact /> : null}

      <ConfirmDialog
        open={isApproveDialogOpen}
        title="Approve change order"
        description="Approve this change order?"
        cancelLabel="Cancel"
        confirmLabel={isApproving ? "Approving..." : "Approve"}
        isConfirming={isApproving}
        confirmVariant="primary"
        onCancel={() => setIsApproveDialogOpen(false)}
        onConfirm={() => {
          void confirmApproveAction();
        }}
      />

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Overview</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <DetailRow label="Status" value={<ChangeOrderStatusBadge status={changeOrder.status} />} />
          <DetailRow label="Customer" value={customerName} />
          <DetailRow label="Project" value={projectName} />
          <DetailRow label="Total" value={formatUsd(changeOrder.total_amount, localeTag)} />
          <DetailRow label="Schedule Impact" value={`${changeOrder.schedule_impact_days > 0 ? "+" : ""}${changeOrder.schedule_impact_days} days`} />
          <DetailRow label="Requested Date" value={changeOrder.requested_date || "Not set"} />
          <DetailRow label="Effective Date" value={changeOrder.effective_date || "Not set"} />
          <DetailRow label="Updated" value={new Date(changeOrder.updated_at).toLocaleString(localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Scope / Description</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.description || "No scope description provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Reason</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.reason || "No reason provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Qty</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Unit Cost</th>
                <th className="px-3 py-2">Unit Price</th>
                <th className="px-3 py-2">Cost Amount</th>
                <th className="px-3 py-2">Price Amount</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem) => (
                <tr key={lineItem.id} className="border-t border-[var(--color-border-subtle)]">
                  <td className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{lineItem.description}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{lineItem.quantity}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatChangeOrderStatusLabel(lineItem.unit)}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.unit_cost, localeTag)}</td>
                  <td className="px-3 py-2 text-sm text-[var(--color-text-secondary)]">{formatUsd(lineItem.unit_price, localeTag)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(lineItem.cost_amount, localeTag)}</td>
                  <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(lineItem.price_amount, localeTag)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Financial Summary</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailRow label="Subtotal" value={formatUsd(changeOrder.subtotal, localeTag)} />
          <DetailRow label="Tax" value={formatUsd(changeOrder.tax_amount, localeTag)} />
          <DetailRow label="Total" value={formatUsd(changeOrder.total_amount, localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Customer Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.customer_notes || "No customer notes provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Internal Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.internal_notes || "No internal notes provided."}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Related Invoice(s)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoiceLinks.length === 0 ? (
            <EmptyState compact icon="$" title="Not invoiced yet" description="Add this approved change order to an existing invoice or create a new one." />
          ) : (
            <div className="space-y-2">
              {invoiceLinks.map((link) => (
                <article key={link.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">Invoice: {link.invoiceId}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">Type: {formatChangeOrderStatusLabel(link.linkType)} · Applied: {formatUsd(link.amountApplied, localeTag)}</p>
                </article>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Select value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
              <option value="">Select existing invoice</option>
              {existingInvoiceOptions.map((invoiceOption) => (
                <option key={invoiceOption.id} value={invoiceOption.id}>{invoiceOption.label}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => void handleAddToExistingInvoice()} disabled={!canAddToInvoice || !selectedInvoiceId}>
              Add to Invoice
            </Button>
            <Button type="button" onClick={() => void handleCreateInvoiceFromChangeOrder()} disabled={!canAddToInvoice}>
              Create New Invoice
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No activity yet.</p>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => (
                <article key={entry.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{formatChangeOrderStatusLabel(entry.activityType)}</p>
                  <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.description}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{new Date(entry.createdAt).toLocaleString(localeTag)}</p>
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
