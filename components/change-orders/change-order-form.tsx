"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, CardContent, CardHeader, CardTitle, ErrorState, FormField, Input, PageHeader, Select, SkeletonLoader } from "@/components/ui";
import { CHANGE_ORDER_STATUS_OPTIONS, CHANGE_ORDER_UNIT_OPTIONS } from "@/lib/change-orders/constants";
import { calculateChangeOrderTotals, changeOrderLineItemMoney, formatUsd } from "@/lib/change-orders/calculations";
import { getNextChangeOrderNumber } from "@/lib/change-orders/numbering";
import {
  approveChangeOrder,
  getCustomerDisplayName,
  getProfileDisplayName,
  getProjectDisplayName,
  loadChangeOrderById,
  loadChangeOrderFormOptions,
  reopenChangeOrder,
  rejectChangeOrder,
  saveChangeOrder,
  submitForApproval,
  voidChangeOrder,
} from "@/lib/change-orders/service";
import type { ChangeOrderFormMode } from "@/components/change-orders/types";
import type { ChangeOrderFormErrors, ChangeOrderFormValues, ChangeOrderLineItemDraft } from "@/lib/change-orders/types";
import { validateChangeOrderForm } from "@/lib/change-orders/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

const DEFAULT_FORM_VALUES: ChangeOrderFormValues = {
  title: "",
  changeOrderNumber: "",
  status: "draft",
  requestedDate: new Date().toISOString().slice(0, 10),
  effectiveDate: "",
  preparedBy: "",
  requestedBy: "",
  customerId: "",
  projectId: "",
  estimateId: "",
  description: "",
  reason: "",
  scheduleImpactDays: "0",
  taxRatePercent: "0",
  customerNotes: "",
  internalNotes: "",
};

const DEFAULT_LINE_ITEMS: ChangeOrderLineItemDraft[] = [
  {
    id: "draft-line-item-1",
    sortOrder: 0,
    description: "",
    quantity: "1",
    unit: "each",
    unitCost: "0",
    unitPrice: "0",
    notes: "",
  },
];

export function ChangeOrderForm({
  mode,
  changeOrderId,
  defaultCustomerId,
  defaultProjectId,
  defaultEstimateId,
}: {
  mode: ChangeOrderFormMode;
  changeOrderId?: string;
  defaultCustomerId?: string;
  defaultProjectId?: string;
  defaultEstimateId?: string;
}) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<ChangeOrderFormErrors>({});

  const [companyId, setCompanyId] = useState("");
  const [userId, setUserId] = useState("");

  const [values, setValues] = useState<ChangeOrderFormValues>(DEFAULT_FORM_VALUES);
  const [lineItems, setLineItems] = useState<ChangeOrderLineItemDraft[]>(DEFAULT_LINE_ITEMS);
  const [isDirty, setIsDirty] = useState(false);

  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string; email: string | null; phone: string | null; billingAddress: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string; customerId: string | null }>>([]);
  const [preparedByOptions, setPreparedByOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [estimateOptions, setEstimateOptions] = useState<Array<{ id: string; label: string; customerId: string | null; projectId: string | null }>>([]);

  const totals = useMemo(
    () => calculateChangeOrderTotals({
      lineItems,
      taxRatePercent: values.taxRatePercent,
    }),
    [lineItems, values.taxRatePercent],
  );

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

      setCompanyId(workspace.context.companyId);
      setUserId(workspace.context.userId);

      const optionsResult = await loadChangeOrderFormOptions(supabase, workspace.context.companyId);

      if (optionsResult.error || !optionsResult.data) {
        if (isSubscribed) {
          setErrorMessage(optionsResult.error || "Unable to load change order form options.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        setCustomerOptions(optionsResult.data.customers.map((customer) => ({
          id: customer.id,
          label: getCustomerDisplayName(customer),
          email: customer.email,
          phone: customer.phone,
          billingAddress: [
            customer.address_line_1 || "",
            customer.address_line_2 || "",
            [customer.city || "", customer.state || "", customer.postal_code || ""].filter(Boolean).join(" "),
          ].filter(Boolean).join(", "),
        })));

        setProjectOptions(optionsResult.data.projects.map((project) => ({
          id: project.id,
          label: getProjectDisplayName(project),
          customerId: project.customer_id,
        })));

        setPreparedByOptions(optionsResult.data.profiles.map((profile) => ({
          value: profile.id,
          label: getProfileDisplayName(profile),
        })));

        setEstimateOptions(optionsResult.data.estimates.map((estimate) => ({
          id: estimate.id,
          label: `${estimate.estimate_number || "No #"} - ${estimate.title}`,
          customerId: estimate.customer_id,
          projectId: estimate.project_id,
        })));
      }

      if (mode === "create") {
        const number = await getNextChangeOrderNumber(supabase, workspace.context.companyId);

        if (isSubscribed) {
          setValues((current) => ({
            ...current,
            changeOrderNumber: number,
            customerId: defaultCustomerId || current.customerId,
            projectId: defaultProjectId || current.projectId,
            estimateId: defaultEstimateId || current.estimateId,
          }));
          setIsLoading(false);
        }

        return;
      }

      if (!changeOrderId) {
        if (isSubscribed) {
          setErrorMessage("Change order ID is required for edit mode.");
          setIsLoading(false);
        }
        return;
      }

      const changeOrderResult = await loadChangeOrderById(supabase, workspace.context.companyId, changeOrderId);

      if (changeOrderResult.error || !changeOrderResult.data) {
        if (isSubscribed) {
          setErrorMessage(changeOrderResult.error || "Unable to load change order.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        const row = changeOrderResult.data.changeOrder;

        setValues({
          title: row.title,
          changeOrderNumber: row.change_order_number,
          status: row.status as ChangeOrderFormValues["status"],
          requestedDate: row.requested_date || "",
          effectiveDate: row.effective_date || "",
          preparedBy: row.prepared_by || "",
          requestedBy: row.requested_by || "",
          customerId: row.customer_id || "",
          projectId: row.project_id || "",
          estimateId: row.estimate_id || "",
          description: row.description || "",
          reason: row.reason || "",
          scheduleImpactDays: String(row.schedule_impact_days ?? 0),
          taxRatePercent: String((row.tax_rate ?? 0) * 100),
          customerNotes: row.customer_notes || "",
          internalNotes: row.internal_notes || "",
        });

        setLineItems(
          changeOrderResult.data.lineItems.length > 0
            ? changeOrderResult.data.lineItems.map((lineItem) => ({
                id: lineItem.id,
                sortOrder: lineItem.sort_order,
                description: lineItem.description,
                quantity: String(lineItem.quantity),
                unit: lineItem.unit as ChangeOrderLineItemDraft["unit"],
                unitCost: String(lineItem.unit_cost),
                unitPrice: String(lineItem.unit_price),
                notes: lineItem.notes || "",
              }))
            : DEFAULT_LINE_ITEMS,
        );

        setIsLoading(false);
      }
    };

    void load();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, mode, changeOrderId, defaultCustomerId, defaultProjectId, defaultEstimateId]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) {
        return;
      }

      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", beforeUnload);

    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [isDirty]);

  function onFieldChange<K extends keyof ChangeOrderFormValues>(field: K, value: ChangeOrderFormValues[K]) {
    setValues((current) => ({
      ...current,
      [field]: value,
    }));

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }));

    setSuccessMessage(null);
    setIsDirty(true);
  }

  async function submit(action: "draft" | "submit" | "save" | "approve" | "reject" | "reopen" | "void") {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const nextValues: ChangeOrderFormValues = {
      ...values,
      status: action === "submit" ? "pending_approval" : values.status,
    };

    const nextErrors = validateChangeOrderForm(nextValues, lineItems);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!supabase || !companyId || !userId) {
      setErrorMessage("Unable to resolve workspace context.");
      return;
    }

    setIsSaving(true);

    try {
      const saveResult = await saveChangeOrder({
        supabase,
        companyId,
        userId,
        values: nextValues,
        lineItems,
        changeOrderId,
      });

      if (saveResult.error || !saveResult.changeOrderId) {
        setErrorMessage(saveResult.error || "Unable to save change order.");
        setIsSaving(false);
        return;
      }

      let workflowError: string | null = null;

      if (action === "submit") {
        const result = await submitForApproval({
          supabase,
          companyId,
          changeOrderId: saveResult.changeOrderId,
          userId,
        });
        workflowError = result.error;
      }

      if (action === "approve") {
        const confirmed = window.confirm("Approve this change order?");
        if (confirmed) {
          const result = await approveChangeOrder({
            supabase,
            companyId,
            changeOrderId: saveResult.changeOrderId,
            userId,
          });
          workflowError = result.error;
        }
      }

      if (action === "reject") {
        const reason = window.prompt("Enter an optional rejection reason:", "") || "";
        const confirmed = window.confirm("Reject this change order?");
        if (confirmed) {
          const result = await rejectChangeOrder({
            supabase,
            companyId,
            changeOrderId: saveResult.changeOrderId,
            userId,
            reason,
          });
          workflowError = result.error;
        }
      }

      if (action === "reopen") {
        const confirmed = window.confirm("Reopen this change order to draft?");
        if (confirmed) {
          const result = await reopenChangeOrder({
            supabase,
            companyId,
            changeOrderId: saveResult.changeOrderId,
            userId,
          });
          workflowError = result.error;
        }
      }

      if (action === "void") {
        const confirmed = window.confirm("Void this change order?");
        if (confirmed) {
          const result = await voidChangeOrder({
            supabase,
            companyId,
            changeOrderId: saveResult.changeOrderId,
            userId,
          });
          workflowError = result.error;
        }
      }

      if (workflowError) {
        setErrorMessage(workflowError);
        setIsSaving(false);
        return;
      }

      setIsDirty(false);

      if (mode === "create" || action === "submit") {
        router.push(`/change-orders/${saveResult.changeOrderId}`);
        router.refresh();
      } else {
        setSuccessMessage(action === "save" ? "Saved." : "Change order updated.");
      }
    } catch (caughtError) {
      console.error("Save change order error:", caughtError);
      setErrorMessage("Unexpected error while saving.");
    } finally {
      setIsSaving(false);
    }
  }

  function addLineItem() {
    setLineItems((current) => [
      ...current,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        sortOrder: current.length,
        description: "",
        quantity: "1",
        unit: "each",
        unitCost: "0",
        unitPrice: "0",
        notes: "",
      },
    ]);
    setIsDirty(true);
  }

  function removeLineItem(index: number) {
    setLineItems((current) => current.filter((_item, rowIndex) => rowIndex !== index));
    setIsDirty(true);
  }

  function moveLineItem(index: number, direction: -1 | 1) {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= lineItems.length) {
      return;
    }

    const next = [...lineItems];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setLineItems(next);
    setIsDirty(true);
  }

  function updateLineItem(index: number, nextValue: ChangeOrderLineItemDraft) {
    setLineItems((current) => {
      const next = [...current];
      next[index] = nextValue;
      return next;
    });
    setIsDirty(true);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader className="h-12 w-80" />
        <SkeletonLoader className="h-64 w-full" />
        <SkeletonLoader className="h-64 w-full" />
      </div>
    );
  }

  if (errorMessage && !companyId) {
    return <ErrorState title="Unable to load change order" description={errorMessage} />;
  }

  const canSubmitForApproval = values.status === "draft";
  const canApprove = values.status === "pending_approval";
  const canReject = values.status === "pending_approval";
  const canReopen = values.status === "approved" || values.status === "rejected";
  const canVoid = values.status !== "void" && values.status !== "invoiced";

  return (
    <div className="space-y-6">
      <PageHeader
        compact
        eyebrow="COMPANY WORKSPACE"
        title={mode === "create" ? "New Change Order" : `Edit ${values.changeOrderNumber || "Change Order"}`}
        description="Manage scope changes, approvals, schedule impact, and financial deltas."
        secondaryActions={(
          <Link href={mode === "create" ? "/change-orders" : `/change-orders/${changeOrderId || ""}`}>
            <Button variant="secondary" size="md">Cancel</Button>
          </Link>
        )}
      />

      {errorMessage ? <ErrorState title="Unable to save change order" description={errorMessage} compact /> : null}
      {successMessage ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--color-success-100)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]">
          {successMessage}
        </div>
      ) : null}

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>1. Change Order Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <Field label="Change Order Number" htmlFor="change-order-number">
            <Input id="change-order-number" value={values.changeOrderNumber} onChange={(event) => onFieldChange("changeOrderNumber", event.target.value)} placeholder="CO-2026-0001" />
          </Field>

          <Field label="Title" htmlFor="change-order-title" error={errors.title} required>
            <Input id="change-order-title" value={values.title} onChange={(event) => onFieldChange("title", event.target.value)} />
          </Field>

          <Field label="Status" htmlFor="change-order-status" error={errors.status}>
            <Select id="change-order-status" value={values.status} onChange={(event) => onFieldChange("status", event.target.value as ChangeOrderFormValues["status"])}>
              {CHANGE_ORDER_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Requested Date" htmlFor="requested-date">
            <Input id="requested-date" type="date" value={values.requestedDate} onChange={(event) => onFieldChange("requestedDate", event.target.value)} />
          </Field>

          <Field label="Effective Date" htmlFor="effective-date" error={errors.effectiveDate}>
            <Input id="effective-date" type="date" value={values.effectiveDate} onChange={(event) => onFieldChange("effectiveDate", event.target.value)} />
          </Field>

          <Field label="Prepared By" htmlFor="prepared-by">
            <Select id="prepared-by" value={values.preparedBy} onChange={(event) => onFieldChange("preparedBy", event.target.value)}>
              <option value="">Unassigned</option>
              {preparedByOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Requested By" htmlFor="requested-by">
            <Select id="requested-by" value={values.requestedBy} onChange={(event) => onFieldChange("requestedBy", event.target.value)}>
              <option value="">Unassigned</option>
              {preparedByOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>2. Customer and Project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <Field label="Customer" htmlFor="change-order-customer" error={errors.customerId}>
            <Select id="change-order-customer" value={values.customerId} onChange={(event) => onFieldChange("customerId", event.target.value)}>
              <option value="">No linked customer</option>
              {customerOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Project" htmlFor="change-order-project" error={errors.projectId} required>
            <Select id="change-order-project" value={values.projectId} onChange={(event) => onFieldChange("projectId", event.target.value)}>
              <option value="">Select project</option>
              {projectOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </Field>

          <Field label="Related Estimate" htmlFor="change-order-estimate">
            <Select
              id="change-order-estimate"
              value={values.estimateId}
              onChange={(event) => {
                const estimateId = event.target.value;
                const estimate = estimateOptions.find((item) => item.id === estimateId) || null;
                onFieldChange("estimateId", estimateId);
                if (estimate?.customerId && !values.customerId) {
                  onFieldChange("customerId", estimate.customerId);
                }
                if (estimate?.projectId && !values.projectId) {
                  onFieldChange("projectId", estimate.projectId);
                }
              }}
            >
              <option value="">No related estimate</option>
              {estimateOptions.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </Select>
          </Field>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>3. Scope and Reason</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <TextareaField label="Scope Description" value={values.description} onChange={(value) => onFieldChange("description", value)} />
          <TextareaField label="Reason" value={values.reason} onChange={(value) => onFieldChange("reason", value)} />
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>4. Schedule Impact</CardTitle>
        </CardHeader>
        <CardContent>
          <Field label="Schedule Impact Days" htmlFor="schedule-impact-days" error={errors.scheduleImpactDays}>
            <Input id="schedule-impact-days" type="number" step="1" value={values.scheduleImpactDays} onChange={(event) => onFieldChange("scheduleImpactDays", event.target.value)} />
          </Field>
          <p className="mt-2 text-xs text-[var(--color-text-muted)]">
            Positive values extend the schedule. Zero means no schedule change. Negative values reduce schedule duration.
          </p>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>5. Line Items</CardTitle>
          <Button type="button" size="sm" onClick={addLineItem}>Add Row</Button>
        </CardHeader>
        <CardContent className="space-y-3 overflow-x-auto">
          {errors.lineItems ? <p className="text-sm text-[var(--color-danger-700)]">{errors.lineItems}</p> : null}

          <table className="min-w-[1360px] w-full">
            <thead>
              <tr className="text-left text-xs uppercase tracking-[0.06em] text-[var(--color-text-muted)]">
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Quantity</th>
                <th className="px-3 py-2">Unit</th>
                <th className="px-3 py-2">Unit Cost</th>
                <th className="px-3 py-2">Unit Price</th>
                <th className="px-3 py-2">Cost Amount</th>
                <th className="px-3 py-2">Price Amount</th>
                <th className="px-3 py-2">Notes</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((lineItem, index) => {
                const money = changeOrderLineItemMoney(lineItem);

                return (
                  <tr key={lineItem.id}>
                    <td className="px-3 py-2 min-w-72"><Input value={lineItem.description} onChange={(event) => updateLineItem(index, { ...lineItem, description: event.target.value })} placeholder="Work description" /></td>
                    <td className="px-3 py-2 w-28"><Input type="number" min={0} step="0.01" value={lineItem.quantity} onChange={(event) => updateLineItem(index, { ...lineItem, quantity: event.target.value })} /></td>
                    <td className="px-3 py-2 w-40">
                      <Select value={lineItem.unit} onChange={(event) => updateLineItem(index, { ...lineItem, unit: event.target.value as ChangeOrderLineItemDraft["unit"] })}>
                        {CHANGE_ORDER_UNIT_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2 w-36"><Input type="number" min={0} step="0.01" value={lineItem.unitCost} onChange={(event) => updateLineItem(index, { ...lineItem, unitCost: event.target.value })} /></td>
                    <td className="px-3 py-2 w-36"><Input type="number" min={0} step="0.01" value={lineItem.unitPrice} onChange={(event) => updateLineItem(index, { ...lineItem, unitPrice: event.target.value })} /></td>
                    <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(money.costAmount, localeTag)}</td>
                    <td className="px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)]">{formatUsd(money.priceAmount, localeTag)}</td>
                    <td className="px-3 py-2 min-w-64"><Input value={lineItem.notes} onChange={(event) => updateLineItem(index, { ...lineItem, notes: event.target.value })} placeholder="Optional note" /></td>
                    <td className="px-3 py-2">
                      <div className="flex gap-1">
                        <Button type="button" size="sm" variant="secondary" aria-label="Move line item up" onClick={() => moveLineItem(index, -1)}>↑</Button>
                        <Button type="button" size="sm" variant="secondary" aria-label="Move line item down" onClick={() => moveLineItem(index, 1)}>↓</Button>
                        <Button type="button" size="sm" variant="danger" aria-label="Remove line item" onClick={() => removeLineItem(index)}>Remove</Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>6. Financial Totals</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <Field label="Tax Rate %" htmlFor="tax-rate-percent" error={errors.taxRatePercent}>
            <Input id="tax-rate-percent" type="number" min={0} step="0.01" value={values.taxRatePercent} onChange={(event) => onFieldChange("taxRatePercent", event.target.value)} />
          </Field>

          <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4">
            <SummaryRow label="Subtotal" value={formatUsd(totals.subtotal, localeTag)} />
            <SummaryRow label="Tax" value={formatUsd(totals.taxTotal, localeTag)} />
            <SummaryRow label="Total Change Order" value={formatUsd(totals.grandTotal, localeTag)} emphasized />
            <SummaryRow label="Estimated Cost" value={formatUsd(totals.estimatedCost, localeTag)} />
            <SummaryRow label="Estimated Gross Profit" value={formatUsd(totals.estimatedGrossProfit, localeTag)} />
            <SummaryRow label="Estimated Margin %" value={`${totals.estimatedMarginPercent.toFixed(2)}%`} />
          </div>
        </CardContent>
      </Card>

      <Card as="section" variant="elevated">
        <CardHeader>
          <CardTitle>7. Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-2">
          <TextareaField label="Customer Notes" value={values.customerNotes} onChange={(value) => onFieldChange("customerNotes", value)} />
          <TextareaField label="Internal Notes" value={values.internalNotes} onChange={(value) => onFieldChange("internalNotes", value)} />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link href={mode === "create" ? "/change-orders" : `/change-orders/${changeOrderId || ""}`}>
          <Button type="button" variant="secondary">Cancel</Button>
        </Link>

        {mode === "create" ? (
          <>
            <Button type="button" variant="secondary" onClick={() => void submit("draft")} disabled={isSaving}>Save Draft</Button>
            <Button type="button" variant="secondary" onClick={() => void submit("submit")} disabled={isSaving || !canSubmitForApproval}>Submit for Approval</Button>
            <Button type="button" onClick={() => void submit("save")} disabled={isSaving}>Save and Continue Editing</Button>
          </>
        ) : (
          <>
            <Button type="button" onClick={() => void submit("save")} disabled={isSaving}>Save Changes</Button>
            <Button type="button" variant="secondary" onClick={() => void submit("submit")} disabled={isSaving || !canSubmitForApproval}>Submit for Approval</Button>
            <Button type="button" variant="secondary" onClick={() => void submit("approve")} disabled={isSaving || !canApprove}>Approve</Button>
            <Button type="button" variant="secondary" onClick={() => void submit("reject")} disabled={isSaving || !canReject}>Reject</Button>
            <Button type="button" variant="secondary" onClick={() => void submit("reopen")} disabled={isSaving || !canReopen}>Reopen</Button>
            <Button type="button" variant="danger" onClick={() => void submit("void")} disabled={isSaving || !canVoid}>Void</Button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
  error,
  required,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
  required?: boolean;
}) {
  return (
    <FormField
      label={label}
      htmlFor={htmlFor}
      required={required}
      className={className}
      error={error}
      labelClassName="tracking-[0.01em]"
    >
      {children}
    </FormField>
  );
}

function TextareaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FormField label={label} labelClassName="tracking-[0.01em]">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
      />
    </FormField>
  );
}

function SummaryRow({ label, value, emphasized }: { label: string; value: string; emphasized?: boolean }) {
  return (
    <div className={["flex items-center justify-between py-1.5", emphasized ? "border-t border-[var(--color-border-subtle)] mt-2 pt-3" : ""].join(" ")}>
      <span className="text-sm text-[var(--color-text-secondary)]">{label}</span>
      <span className={["text-sm", emphasized ? "font-bold text-[var(--color-text-primary)]" : "font-semibold text-[var(--color-text-primary)]"].join(" ")}>{value}</span>
    </div>
  );
}
