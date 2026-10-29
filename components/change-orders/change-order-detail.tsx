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
import { translateLiteral } from "@/lib/i18n/literal";
import { BlueprintSourceLink } from "@/components/plans/blueprint-source-link";

export function ChangeOrderDetail({ changeOrderId }: { changeOrderId: string }) {
  const { locale, t } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [changeOrder, setChangeOrder] = useState<ChangeOrderRow | null>(null);
  const [lineItems, setLineItems] = useState<ChangeOrderLineItemRow[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [invoiceLinks, setInvoiceLinks] = useState<Array<{ id: string; invoiceId: string; amountApplied: number; linkType: string; createdAt: string }>>([]);
  const [activity, setActivity] = useState<Array<{ id: string; activityType: string; description: string; createdAt: string }>>([]);
  const [existingInvoiceOptions, setExistingInvoiceOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  const [isApproveDialogOpen, setIsApproveDialogOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isSendingToCustomer, setIsSendingToCustomer] = useState(false);
  const [customerApprovalMessage, setCustomerApprovalMessage] = useState<string | null>(null);
  const [customerApprovalUrl, setCustomerApprovalUrl] = useState<string | null>(null);

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

          setCustomerName(customer ? getCustomerDisplayName(customer) : "");
          setProjectName(project ? getProjectDisplayName(project) : "");

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
  }, [supabase, changeOrderId, refreshVersion]);

  async function runAction(action: "submit" | "approve" | "reject" | "reopen" | "void" | "archive" | "restore") {
    if (!supabase || !companyId || !userId || !changeOrder) {
      return;
    }

    if (changeOrder.archived_at && action !== "restore") {
      setActionMessage("Restore this change order before changing its status.");
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
      const reason = window.prompt(t("finance.rejectionReasonPrompt"), "") || "";
      if (!window.confirm(t("finance.rejectChangeOrderQuestion"))) {
        return;
      }
      const result = await rejectChangeOrder({ supabase, companyId, changeOrderId, userId, reason });
      error = result.error;
    }

    if (action === "reopen") {
      if (!window.confirm(t("finance.reopenChangeOrderQuestion"))) {
        return;
      }
      const result = await reopenChangeOrder({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (action === "void") {
      if (!window.confirm(t("finance.voidChangeOrderQuestion"))) {
        return;
      }
      const result = await voidChangeOrder({ supabase, companyId, changeOrderId, userId });
      error = result.error;
    }

    if (action === "archive") {
      if (!window.confirm(t("finance.archiveChangeOrderQuestion"))) {
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

    setRefreshVersion((current) => current + 1);
  }

  async function confirmApproveAction() {
    if (!supabase || !companyId || !userId || !changeOrder || changeOrder.archived_at || isApproving) {
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

    setRefreshVersion((current) => current + 1);
  }

  async function handleSendToCustomer() {
    if (!changeOrder || isSendingToCustomer) return;
    setIsSendingToCustomer(true);
    setCustomerApprovalMessage(null);
    setCustomerApprovalUrl(null);
    try {
      const response = await fetch(`/api/change-orders/${changeOrder.id}/send-approval`, { method: "POST" });
      const body = await response.json();
      if (body.url) setCustomerApprovalUrl(body.url);
      if (!response.ok) throw new Error(body.error || "Unable to send change order.");
      setCustomerApprovalMessage("Change order sent to the customer for approval.");
      setChangeOrder((current) => current ? { ...current, status: "pending_approval", submitted_at: new Date().toISOString() } : current);
    } catch (caught) {
      setCustomerApprovalMessage(caught instanceof Error ? caught.message : "Unable to send change order.");
    } finally {
      setIsSendingToCustomer(false);
    }
  }

  async function handleAddToExistingInvoice() {
    if (!supabase || !companyId || !userId || !selectedInvoiceId) {
      return;
    }

    if (!window.confirm(t("finance.addChangeOrderToInvoiceQuestion"))) {
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

    setRefreshVersion((current) => current + 1);
  }

  async function handleCreateInvoiceFromChangeOrder() {
    if (!supabase || !companyId || !userId) {
      return;
    }

    if (!window.confirm(t("finance.createInvoiceFromChangeOrderQuestion"))) {
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
    return <ErrorState title={t("finance.loadChangeOrderError")} description={errorMessage || t("finance.changeOrderNotFound")} />;
  }

  const status = normalizeChangeOrderStatus(changeOrder.status);
  const isArchived = !!changeOrder.archived_at;
  const canSubmit = status === "draft" && !isArchived;
  const canApprove = status === "pending_approval" && !isArchived;
  const canReject = status === "pending_approval" && !isArchived;
  const canReopen = (status === "approved" || status === "rejected") && !isArchived;
  const canAddToInvoice = status === "approved" && !isArchived;
  const canSendToCustomer = !["void", "invoiced"].includes(status) && !isArchived;
  const customerTotalMissing = Number(changeOrder.total_amount || 0) <= 0;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("finance.companyWorkspace")}
        title={`${changeOrder.change_order_number} · ${changeOrder.title}`}
        titleIsUserContent
        description={t("finance.changeOrderDetailDescription")}
        secondaryActions={(
          <>
            <Link href={`/change-orders/${changeOrderId}/print`}>
              <Button type="button" variant="secondary" size="md">{t("finance.print")}</Button>
            </Link>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("submit")} disabled={!canSubmit}>{t("finance.submitInternally")}</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("approve")} disabled={!canApprove}>{t("finance.markApproved")}</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("reject")} disabled={!canReject}>{t("finance.reject")}</Button>
            <Button type="button" variant="secondary" size="md" onClick={() => void runAction("reopen")} disabled={!canReopen}>{t("finance.reopen")}</Button>
            <Button type="button" variant="danger" size="md" onClick={() => void runAction("void")} disabled={status === "void" || isArchived}>{t("finance.void")}</Button>
            {isArchived ? (
              <Button type="button" variant="secondary" size="md" onClick={() => void runAction("restore")}>{t("finance.restore")}</Button>
            ) : (
              <Button type="button" variant="secondary" size="md" onClick={() => void runAction("archive")}>{t("finance.archive")}</Button>
            )}
          </>
        )}
        primaryAction={(
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="md" onClick={() => void handleSendToCustomer()} disabled={!canSendToCustomer || customerTotalMissing || isSendingToCustomer}>
              {isSendingToCustomer ? t("finance.sending") : t("finance.sendToCustomer")}
            </Button>
            <Link href={`/change-orders/${changeOrderId}/edit`} className={getButtonClassName({ size: "md", variant: "secondary" })}>{t("finance.editChangeOrder")}</Link>
          </div>
        )}
      />

      <BlueprintSourceLink targetType="change_order" targetIds={[changeOrder.id]} />

      {isArchived ? <div role="status" className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-4 py-3 text-sm text-[var(--color-text-secondary)]">{locale === "es" ? "Orden de cambio archivada. Restáurala antes de editarla o cambiar su estado." : "Archived change order. Restore it before editing or changing its status."}</div> : null}

      {actionMessage ? <ErrorState title={t("finance.actionResult")} description={actionMessage} compact /> : null}
      {customerTotalMissing ? <div className="rounded-[var(--radius-lg)] border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-200">{t("finance.customerTotalMissing")}</div> : null}
      {customerApprovalMessage ? <div className="rounded-[var(--radius-lg)] border border-sky-400/30 bg-sky-400/10 px-4 py-3 text-sm text-sky-100" role="status">{translateLiteral(locale, customerApprovalMessage)}{customerApprovalUrl ? <a href={customerApprovalUrl} target="_blank" rel="noreferrer" className="ml-2 font-bold underline">{t("finance.openCustomerApprovalLink")}</a> : null}</div> : null}

      <ConfirmDialog
        open={isApproveDialogOpen}
        title={t("finance.approveChangeOrder")}
        description={t("finance.approveChangeOrderQuestion")}
        cancelLabel={t("finance.cancel")}
        confirmLabel={isApproving ? t("finance.approving") : t("finance.approve")}
        isConfirming={isApproving}
        confirmVariant="primary"
        onCancel={() => setIsApproveDialogOpen(false)}
        onConfirm={() => {
          void confirmApproveAction();
        }}
      />

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.overview")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <DetailRow label={t("finance.status")} value={<ChangeOrderStatusBadge status={changeOrder.status} />} />
          <DetailRow label={t("finance.customer")} value={customerName ? <span data-user-content>{customerName}</span> : t("finance.notLinked")} />
          <DetailRow label={t("finance.project")} value={projectName ? <span data-user-content>{projectName}</span> : t("finance.notLinked")} />
          <DetailRow label={t("finance.total")} value={formatUsd(changeOrder.total_amount, localeTag)} />
          <DetailRow label={t("finance.scheduleImpact")} value={`${changeOrder.schedule_impact_days > 0 ? "+" : ""}${changeOrder.schedule_impact_days} ${t(Math.abs(changeOrder.schedule_impact_days) === 1 ? "finance.day" : "finance.days")}`} />
          <DetailRow label={t("finance.requestedDate")} value={changeOrder.requested_date || t("finance.notSet")} />
          <DetailRow label={t("finance.effectiveDate")} value={changeOrder.effective_date || t("finance.notSet")} />
          <DetailRow label={t("finance.updated")} value={new Date(changeOrder.updated_at).toLocaleString(localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.scopeDescription")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-user-content={Boolean(changeOrder.description) || undefined} className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.description || t("finance.noScopeDescription")}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.reason")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-user-content={Boolean(changeOrder.reason) || undefined} className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.reason || t("finance.noReason")}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.lineItems")}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-[980px] w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                <th className="px-3 py-2">{t("finance.description")}</th>
                <th className="px-3 py-2">{t("finance.quantityShort")}</th>
                <th className="px-3 py-2">{t("finance.unit")}</th>
                <th className="px-3 py-2">{t("finance.unitCost")}</th>
                <th className="px-3 py-2">{t("finance.unitPrice")}</th>
                <th className="px-3 py-2">{t("finance.costAmount")}</th>
                <th className="px-3 py-2">{t("finance.priceAmount")}</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem) => (
                <tr key={lineItem.id} className="border-t border-[var(--color-border-subtle)]">
                  <td data-user-content className="px-3 py-2 text-sm text-[var(--color-text-primary)]">{lineItem.description}</td>
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
          <CardTitle>{t("finance.financialSummary")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <DetailRow label={t("finance.subtotal")} value={formatUsd(changeOrder.subtotal, localeTag)} />
          <DetailRow label={t("finance.tax")} value={formatUsd(changeOrder.tax_amount, localeTag)} />
          <DetailRow label={t("finance.total")} value={formatUsd(changeOrder.total_amount, localeTag)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.customerNotes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-user-content={Boolean(changeOrder.customer_notes) || undefined} className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.customer_notes || t("finance.noCustomerNotes")}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.internalNotes")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p data-user-content={Boolean(changeOrder.internal_notes) || undefined} className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{changeOrder.internal_notes || t("finance.noInternalNotes")}</p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.relatedInvoices")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {invoiceLinks.length === 0 ? (
            <EmptyState compact icon="$" title={t("finance.notInvoicedYet")} description={t("finance.notInvoicedDescription")} />
          ) : (
            <div className="space-y-2">
              {invoiceLinks.map((link) => (
                <article key={link.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{t("finance.invoiceLabel")}: {link.invoiceId}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t("finance.typeLabel")}: {formatChangeOrderStatusLabel(link.linkType)} · {t("finance.appliedLabel")}: {formatUsd(link.amountApplied, localeTag)}</p>
                </article>
              ))}
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Select aria-label={t("finance.selectExistingInvoice")} value={selectedInvoiceId} onChange={(event) => setSelectedInvoiceId(event.target.value)}>
              <option value="">{t("finance.selectExistingInvoice")}</option>
              {existingInvoiceOptions.map((invoiceOption) => (
                <option data-user-content key={invoiceOption.id} value={invoiceOption.id}>{invoiceOption.label}</option>
              ))}
            </Select>
            <Button type="button" variant="secondary" onClick={() => void handleAddToExistingInvoice()} disabled={!canAddToInvoice || !selectedInvoiceId}>
              {t("finance.addToInvoice")}
            </Button>
            <Button type="button" onClick={() => void handleCreateInvoiceFromChangeOrder()} disabled={!canAddToInvoice}>
              {t("finance.createNewInvoice")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>{t("finance.activityTimeline")}</CardTitle>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("finance.noActivityYet")}</p>
          ) : (
            <div className="space-y-3">
              {activity.map((entry) => (
                <article key={entry.id} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">{translateLiteral(locale, formatChangeOrderStatusLabel(entry.activityType))}</p>
                  <p data-user-content className="mt-1 text-sm text-[var(--color-text-secondary)]">{entry.description}</p>
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
