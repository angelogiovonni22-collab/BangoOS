"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorState, PageHeader, SkeletonLoader } from "@/components/ui";
import { InvoiceBillingDetailsSection } from "@/components/invoices/invoice-billing-details-section";
import { InvoiceCustomerProjectSection } from "@/components/invoices/invoice-customer-project-section";
import { InvoiceInformationSection } from "@/components/invoices/invoice-information-section";
import { InvoiceLineItemsSection } from "@/components/invoices/invoice-line-items";
import { InvoiceNotesTermsSection } from "@/components/invoices/invoice-notes-terms";
import { InvoiceTotalsSection } from "@/components/invoices/invoice-totals";
import { calculateInvoiceTotals } from "@/lib/invoices/calculations";
import { createEstimateConversionDraft } from "@/lib/invoices/conversion";
import { getNextInvoiceNumber } from "@/lib/invoices/numbering";
import { getCustomerDisplayName, getProfileDisplayName, getProjectDisplayName, loadInvoiceById, loadInvoiceFormOptions, saveInvoice, sendInvoice } from "@/lib/invoices/service";
import type { InvoiceFormMode } from "@/components/invoices/types";
import type { InvoiceFormErrors, InvoiceFormValues, InvoiceLineItemDraft } from "@/lib/invoices/types";
import { validateInvoiceForm } from "@/lib/invoices/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

const DEFAULT_FORM_VALUES: InvoiceFormValues = {
  title: "",
  invoiceNumber: "",
  customerId: "",
  projectId: "",
  estimateId: "",
  preparedBy: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  status: "draft",
  description: "",
  discountType: "none",
  discountValue: "0",
  taxRatePercent: "0",
  additionalFee: "0",
  notes: "",
  paymentTerms: "",
};

const DEFAULT_LINE_ITEMS: InvoiceLineItemDraft[] = [
  {
    id: "draft-line-item-1",
    sortOrder: 0,
    description: "",
    quantity: "1",
    unit: "each",
    rate: "0",
    notes: "",
  },
];

export function InvoiceForm({
  mode,
  invoiceId,
  defaultCustomerId,
  defaultProjectId,
  defaultEstimateId,
}: {
  mode: InvoiceFormMode;
  invoiceId?: string;
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
  const [saveMode, setSaveMode] = useState<"draft" | "send" | "changes">("draft");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<InvoiceFormErrors>({});

  const [companyId, setCompanyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [values, setValues] = useState<InvoiceFormValues>(DEFAULT_FORM_VALUES);
  const [lineItems, setLineItems] = useState<InvoiceLineItemDraft[]>(DEFAULT_LINE_ITEMS);
  const [isDirty, setIsDirty] = useState(false);

  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string; email: string | null; phone: string | null; billingAddress: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string; customerId: string | null }>>([]);
  const [preparedByOptions, setPreparedByOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [estimateOptions, setEstimateOptions] = useState<Array<{ id: string; label: string; customerId: string | null; projectId: string | null }>>([]);

  const totals = useMemo(
    () => calculateInvoiceTotals({
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

      const optionsResult = await loadInvoiceFormOptions(supabase, workspace.context.companyId);

      if (optionsResult.error || !optionsResult.data) {
        if (isSubscribed) {
          setErrorMessage(optionsResult.error || "Unable to load invoice form options.");
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

      const nextEstimateOptions = optionsResult.data.estimates
        .filter((estimate) => estimate.status === "approved")
        .map((estimate) => ({
          id: estimate.id,
          label: `${estimate.estimate_number || "No #"} - ${estimate.title}`,
          customerId: estimate.customer_id,
          projectId: estimate.project_id,
        }));

      if (isSubscribed) {
        setCustomerOptions(nextCustomerOptions);
        setProjectOptions(nextProjectOptions);
        setPreparedByOptions(nextPreparedByOptions);
        setEstimateOptions(nextEstimateOptions);
      }

      if (mode === "create") {
        const invoiceNumber = await getNextInvoiceNumber(supabase, workspace.context.companyId);

        if (isSubscribed) {
          setValues((current) => ({
            ...current,
            invoiceNumber,
            customerId: defaultCustomerId || current.customerId,
            projectId: defaultProjectId || current.projectId,
            estimateId: defaultEstimateId || current.estimateId,
          }));

          if (defaultEstimateId) {
            const conversion = await createEstimateConversionDraft(supabase, workspace.context.companyId, defaultEstimateId);

            const conversionData = conversion.data;

            if (conversionData) {
              setValues((current) => ({
                ...current,
                title: current.title || `${conversionData.title} Invoice`,
                customerId: conversionData.customerId || current.customerId,
                projectId: conversionData.projectId || current.projectId,
              }));

              if (conversionData.suggestedLineItems.length > 0) {
                setLineItems(conversionData.suggestedLineItems.map((lineItem, index) => ({
                  id: `estimate-line-${index}`,
                  sortOrder: index,
                  description: lineItem.description,
                  quantity: String(lineItem.quantity),
                  unit: lineItem.unit as InvoiceLineItemDraft["unit"],
                  rate: String(lineItem.rate),
                  notes: "",
                })));
              }
            }
          }

          setIsLoading(false);
        }

        return;
      }

      if (!invoiceId) {
        if (isSubscribed) {
          setErrorMessage("Invoice ID is required for edit mode.");
          setIsLoading(false);
        }
        return;
      }

      const invoiceResult = await loadInvoiceById(supabase, workspace.context.companyId, invoiceId);

      if (invoiceResult.error || !invoiceResult.data) {
        if (isSubscribed) {
          setErrorMessage(invoiceResult.error || "Unable to load invoice.");
          setIsLoading(false);
        }
        return;
      }

      if (isSubscribed) {
        setValues({
          title: invoiceResult.data.invoice.title,
          invoiceNumber: invoiceResult.data.invoice.invoice_number || "",
          customerId: invoiceResult.data.invoice.customer_id || "",
          projectId: invoiceResult.data.invoice.project_id || "",
          estimateId: invoiceResult.data.invoice.estimate_id || "",
          preparedBy: invoiceResult.data.invoice.prepared_by || "",
          issueDate: invoiceResult.data.invoice.issue_date || "",
          dueDate: invoiceResult.data.invoice.due_date || "",
          status: invoiceResult.data.invoice.status as InvoiceFormValues["status"],
          description: invoiceResult.data.invoice.description || "",
          discountType: (invoiceResult.data.invoice.discount_type || "none") as InvoiceFormValues["discountType"],
          discountValue: String(invoiceResult.data.invoice.discount_value ?? 0),
          taxRatePercent: String((invoiceResult.data.invoice.tax_rate ?? 0) * 100),
          additionalFee: String(invoiceResult.data.invoice.additional_fee ?? 0),
          notes: invoiceResult.data.invoice.notes || "",
          paymentTerms: invoiceResult.data.invoice.payment_terms || "",
        });

        setLineItems(
          invoiceResult.data.lineItems.length > 0
            ? invoiceResult.data.lineItems.map((lineItem) => ({
                id: lineItem.id,
                sortOrder: lineItem.sort_order,
                description: lineItem.description,
                quantity: String(lineItem.quantity),
                unit: lineItem.unit as InvoiceLineItemDraft["unit"],
                rate: String(lineItem.rate),
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
  }, [supabase, mode, invoiceId, defaultCustomerId, defaultProjectId, defaultEstimateId]);

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

  function onFieldChange<K extends keyof InvoiceFormValues>(field: K, value: InvoiceFormValues[K]) {
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

  async function submit(action: "draft" | "send" | "changes") {
    if (isSaving) {
      return;
    }

    setErrorMessage(null);
    setSuccessMessage(null);

    const nextValues = {
      ...values,
      status: action === "send" ? "sent" : values.status,
    };

    const nextErrors = validateInvoiceForm(nextValues, lineItems);
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
      const result = await saveInvoice({
        supabase,
        companyId,
        userId,
        values: nextValues,
        lineItems,
        invoiceId: mode === "edit" ? invoiceId : undefined,
      });

      if (result.error || !result.invoiceId) {
        setErrorMessage(result.error || "Unable to save invoice.");
        return;
      }

      if (action === "send") {
        const sendResult = await sendInvoice({
          supabase,
          companyId,
          invoiceId: result.invoiceId,
          userId,
        });

        if (sendResult.error) {
          setErrorMessage(sendResult.error);
          return;
        }
      }

      setIsDirty(false);
      setSuccessMessage(action === "send" ? "Invoice sent successfully." : "Invoice saved successfully.");

      if (action === "draft") {
        router.push("/invoices");
        router.refresh();
        return;
      }

      router.push(`/invoices/${result.invoiceId}/edit`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save invoice error", caughtError);
      setErrorMessage("Unexpected error while saving invoice.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancel() {
    if (isDirty && !window.confirm("Discard unsaved changes?")) {
      return;
    }

    router.push(mode === "edit" && invoiceId ? `/invoices/${invoiceId}` : "/invoices");
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
    return <ErrorState title="Unable to load invoice builder" description={errorMessage} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={mode === "create" ? "New Invoice" : "Edit Invoice"}
        description="Create, review, and issue customer invoices with line items and payment terms."
        secondaryActions={(
          <Link href={mode === "edit" && invoiceId ? `/invoices/${invoiceId}` : "/invoices"}>
            <Button variant="secondary" size="md">Cancel</Button>
          </Link>
        )}
      />

      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void submit(mode === "edit" ? "changes" : "draft");
        }}
      >
        <InvoiceInformationSection values={values} errors={errors} preparedByOptions={preparedByOptions} onFieldChange={onFieldChange} />

        <InvoiceCustomerProjectSection
          values={values}
          errors={errors}
          customers={customerOptions}
          projects={projectOptions}
          estimates={estimateOptions}
          onFieldChange={onFieldChange}
        />

        <InvoiceBillingDetailsSection values={values} onFieldChange={onFieldChange} />

        <InvoiceLineItemsSection
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

        <InvoiceTotalsSection totals={totals} values={values} localeTag={localeTag} onFieldChange={onFieldChange} />

        <InvoiceNotesTermsSection values={values} onFieldChange={onFieldChange} />

        {errorMessage ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
            {errorMessage}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]">
            {successMessage}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" size="lg" onClick={handleCancel}>Cancel</Button>

          {mode === "create" ? (
            <Button type="button" variant="secondary" size="lg" isLoading={isSaving && saveMode === "draft"} onClick={() => void submit("draft")}>
              Save Draft
            </Button>
          ) : null}

          <Button type="button" variant="secondary" size="lg" isLoading={isSaving && saveMode === "send"} onClick={() => void submit("send")}>
            Send Invoice
          </Button>

          <Button type="submit" size="lg" isLoading={isSaving && saveMode === "changes"}>
            {mode === "create" ? "Save and Continue Editing" : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
