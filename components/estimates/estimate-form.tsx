"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ConfirmDialog, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { EstimateCustomerProjectSection } from "@/components/estimates/estimate-customer-project-section";
import { EstimateInformationSection } from "@/components/estimates/estimate-information-section";
import { EstimateLineItemsSection } from "@/components/estimates/estimate-line-items";
import { EstimateNotesTermsSection } from "@/components/estimates/estimate-notes-terms";
import { EstimateTotalsSection } from "@/components/estimates/estimate-totals";
import { calculateEstimateTotals } from "@/lib/estimates/calculations";
import { getNextEstimateNumber } from "@/lib/estimates/numbering";
import { getCustomerDisplayName, getProfileDisplayName, getProjectDisplayName, loadEstimateById, loadEstimateFormOptions, saveEstimate } from "@/lib/estimates/service";
import type { EstimateFormMode } from "@/components/estimates/types";
import type { EstimateFormErrors, EstimateFormValues, EstimateLineItemDraft } from "@/lib/estimates/types";
import { validateEstimateForm } from "@/lib/estimates/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

const DEFAULT_FORM_VALUES: EstimateFormValues = {
  title: "",
  estimateNumber: "",
  customerId: "",
  projectId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  expirationDate: "",
  preparedBy: "",
  status: "draft",
  description: "",
  discountType: "none",
  discountValue: "0",
  taxRatePercent: "0",
  additionalFee: "0",
  internalNotes: "",
  customerNotes: "",
  scopeInclusions: "",
  scopeExclusions: "",
  terms: "",
  paymentTerms: "",
};

const DEFAULT_LINE_ITEMS: EstimateLineItemDraft[] = [
  {
    id: "draft-line-item-1",
    sortOrder: 0,
    itemCode: "",
    category: "labor",
    description: "",
    quantity: "1",
    unit: "each",
    unitCost: "0",
    markupPercent: "0",
    notes: "",
  },
];

export function EstimateForm({ mode, estimateId }: { mode: EstimateFormMode; estimateId?: string }) {
  const { locale } = useI18n();
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<"draft" | "continue" | "changes">("draft");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<EstimateFormErrors>({});

  const [companyId, setCompanyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [values, setValues] = useState<EstimateFormValues>(DEFAULT_FORM_VALUES);
  const [lineItems, setLineItems] = useState<EstimateLineItemDraft[]>(DEFAULT_LINE_ITEMS);
  const [isDirty, setIsDirty] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string; email: string | null; phone: string | null; billingAddress: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string; customerId: string | null }>>([]);
  const [preparedByOptions, setPreparedByOptions] = useState<Array<{ value: string; label: string }>>([]);

  const totals = useMemo(
    () => calculateEstimateTotals({
      lineItems,
      discountType: values.discountType,
      discountValue: values.discountValue,
      taxRatePercent: values.taxRatePercent,
      additionalFee: values.additionalFee,
    }),
    [lineItems, values.discountType, values.discountValue, values.taxRatePercent, values.additionalFee],
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

      const optionsResult = await loadEstimateFormOptions(supabase, workspace.context.companyId);

      if (optionsResult.error || !optionsResult.data) {
        if (isSubscribed) {
          setErrorMessage(optionsResult.error || "Unable to load estimate form options.");
          setIsLoading(false);
        }
        return;
      }

      const nextCustomerOptions = optionsResult.data.customers.map((customer) => ({
        id: customer.id,
        label: getCustomerDisplayName(customer),
        email: customer.email,
        phone: customer.phone,
        billingAddress: [
          customer.address_line_1 || "",
          customer.address_line_2 || "",
          [customer.city || "", customer.state || "", customer.postal_code || ""].filter(Boolean).join(" "),
        ].filter(Boolean).join(", "),
      }));

      const nextProjectOptions = optionsResult.data.projects.map((project) => ({
        id: project.id,
        label: getProjectDisplayName(project),
        customerId: project.customer_id,
      }));

      const nextPreparedByOptions = optionsResult.data.profiles.map((profile) => ({
        value: profile.id,
        label: getProfileDisplayName(profile),
      }));

      if (isSubscribed) {
        setCustomerOptions(nextCustomerOptions);
        setProjectOptions(nextProjectOptions);
        setPreparedByOptions(nextPreparedByOptions);
      }

      if (mode === "create") {
        const estimateNumber = await getNextEstimateNumber(supabase, workspace.context.companyId);

        if (isSubscribed) {
          setValues((current) => ({
            ...current,
            estimateNumber,
          }));
          setIsLoading(false);
        }

        return;
      }

      if (!estimateId) {
        if (isSubscribed) {
          setErrorMessage("Estimate ID is required for edit mode.");
          setIsLoading(false);
        }
        return;
      }

      const estimateResult = await loadEstimateById(supabase, workspace.context.companyId, estimateId);

      if (estimateResult.error || !estimateResult.data) {
        if (isSubscribed) {
          setErrorMessage(estimateResult.error || "Unable to load estimate.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        setValues({
          title: estimateResult.data.estimate.title,
          estimateNumber: estimateResult.data.estimate.estimate_number || "",
          customerId: estimateResult.data.estimate.customer_id || "",
          projectId: estimateResult.data.estimate.project_id || "",
          issueDate: estimateResult.data.estimate.issue_date || "",
          expirationDate: estimateResult.data.estimate.expiration_date || "",
          preparedBy: estimateResult.data.estimate.prepared_by || "",
          status: estimateResult.data.estimate.status as EstimateFormValues["status"],
          description: estimateResult.data.estimate.description || "",
          discountType: (estimateResult.data.estimate.discount_type || "none") as EstimateFormValues["discountType"],
          discountValue: String(estimateResult.data.estimate.discount_value ?? 0),
          taxRatePercent: String((estimateResult.data.estimate.tax_rate ?? 0) * 100),
          additionalFee: String(estimateResult.data.estimate.additional_fee ?? 0),
          internalNotes: estimateResult.data.estimate.internal_notes || "",
          customerNotes: estimateResult.data.estimate.customer_notes || "",
          scopeInclusions: estimateResult.data.estimate.scope_inclusions || "",
          scopeExclusions: estimateResult.data.estimate.scope_exclusions || "",
          terms: estimateResult.data.estimate.terms || "",
          paymentTerms: estimateResult.data.estimate.payment_terms || "",
        });

        setLineItems(
          estimateResult.data.lineItems.length > 0
            ? estimateResult.data.lineItems.map((lineItem) => ({
                id: lineItem.id,
                sortOrder: lineItem.sort_order,
                itemCode: lineItem.item_code || "",
                category: lineItem.category as EstimateLineItemDraft["category"],
                description: lineItem.description,
                quantity: String(lineItem.quantity),
                unit: lineItem.unit as EstimateLineItemDraft["unit"],
                unitCost: String(lineItem.unit_cost),
                markupPercent: String(lineItem.markup_percent),
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
  }, [supabase, mode, estimateId]);

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

  function onFieldChange<K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) {
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

  async function submit(action: "draft" | "continue" | "changes") {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const nextErrors = validateEstimateForm(values, lineItems);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    if (!companyId || !userId) {
      setErrorMessage("Workspace is not ready.");
      return;
    }

    if (!supabase) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    setSaveMode(action);
    setIsSaving(true);

    try {
      const result = await saveEstimate({
        supabase,
        companyId,
        userId,
        values,
        lineItems,
        estimateId: mode === "edit" ? estimateId : undefined,
      });

      if (result.error || !result.estimateId) {
        setErrorMessage(result.error || "Unable to save estimate.");
        return;
      }

      setIsDirty(false);
      setSuccessMessage("Estimate saved successfully.");

      if (action === "draft") {
        router.push("/estimates");
        router.refresh();
        return;
      }

      router.push(`/estimates/${result.estimateId}/edit`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save estimate error", caughtError);
      setErrorMessage("Unexpected error while saving estimate.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (isDirty) {
      setIsDiscardDialogOpen(true);
      return;
    }

    router.push(mode === "edit" && estimateId ? `/estimates/${estimateId}` : "/estimates");
  }

  function confirmDiscardChanges() {
    setIsDiscardDialogOpen(false);
    router.push(mode === "edit" && estimateId ? `/estimates/${estimateId}` : "/estimates");
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLoader className="h-12 w-80" />
        <SkeletonLoader className="h-52 w-full" />
        <SkeletonLoader className="h-72 w-full" />
        <SkeletonLoader className="h-72 w-full" />
      </div>
    );
  }

  if (errorMessage && !companyId) {
    return <ErrorState title="Unable to load estimate builder" description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog
        open={isDiscardDialogOpen}
        title="Discard changes"
        description="Discard unsaved changes?"
        cancelLabel="Keep Editing"
        confirmLabel="Discard Changes"
        onCancel={() => setIsDiscardDialogOpen(false)}
        onConfirm={confirmDiscardChanges}
      />

      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={mode === "create" ? "New Estimate" : "Edit Estimate"}
        description="Build a detailed construction estimate with customer/project links, line items, and live totals."
        secondaryActions={<Button type="button" variant="secondary" size="md" onClick={handleCancel}>Cancel</Button>}
      />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(mode === "edit" ? "changes" : "continue");
        }}
      >
        <EstimateInformationSection values={values} errors={errors} preparedByOptions={preparedByOptions} onFieldChange={onFieldChange} />

        <EstimateCustomerProjectSection
          values={values}
          errors={errors}
          customers={customerOptions}
          projects={projectOptions}
          onFieldChange={onFieldChange}
        />

        <EstimateLineItemsSection
          lineItems={lineItems}
          localeTag={localeTag}
          error={errors["lineItems.0"] || errors["lineItems.1"] || errors["lineItems.2"]}
          onChange={(nextLineItems) => {
            setLineItems(nextLineItems);
            setErrors((current) => ({
              ...current,
              "lineItems.0": undefined,
              "lineItems.1": undefined,
              "lineItems.2": undefined,
            }));
            setIsDirty(true);
          }}
        />

        <EstimateTotalsSection totals={totals} values={values} localeTag={localeTag} onFieldChange={onFieldChange} />

        <EstimateNotesTermsSection values={values} onFieldChange={onFieldChange} />

        {Object.keys(errors).length > 0 ? (
          <div role="alert" data-orion-status="estimate-validation-error" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
            Please complete the highlighted required estimate information before saving.
          </div>
        ) : null}

        {errorMessage ? (
          <div role="alert" data-orion-status="estimate-save-error" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div role="status" data-orion-status="estimate-save-success" className="rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]">
            {successMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" size="lg" onClick={handleCancel}>Cancel</Button>

          {mode === "create" ? (
            <Button data-orion-action="save-estimate-draft" data-orion-verify="navigation-or-status" type="button" variant="secondary" size="lg" isLoading={isSaving && saveMode === "draft"} onClick={() => void submit("draft")}>
              Save Draft
            </Button>
          ) : null}

          <Button data-orion-action="save-estimate-and-continue" data-orion-verify="navigation-or-status" type="submit" size="lg" isLoading={isSaving && (saveMode === "continue" || saveMode === "changes")}>
            {mode === "create" ? "Save and Continue Editing" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
