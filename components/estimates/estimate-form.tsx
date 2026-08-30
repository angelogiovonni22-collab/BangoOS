"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { EMPTY_ESTIMATE_PROSPECT, loadEstimateProspect, removeEstimateProspect, saveEstimateProspect, validateEstimateProspect, type EstimateProspectErrors, type EstimateProspectValues } from "@/lib/estimates/prospect-service";
import type { EstimateFormMode } from "@/components/estimates/types";
import type { EstimateFormErrors, EstimateFormValues, EstimateLineItemDraft, EstimateSupplierPriceOption } from "@/lib/estimates/types";
import { validateEstimateForm } from "@/lib/estimates/validation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";
import { RecordPhotoUpload, type RecordPhotoUploadHandle } from "@/components/attachments/record-photo-upload";

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
  const photoUploadRef = useRef<RecordPhotoUploadHandle>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMode, setSaveMode] = useState<"draft" | "continue" | "changes" | "send">("draft");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<EstimateFormErrors>({});
  const [prospectErrors, setProspectErrors] = useState<EstimateProspectErrors>({});

  const [companyId, setCompanyId] = useState<string>("");
  const [userId, setUserId] = useState<string>("");

  const [values, setValues] = useState<EstimateFormValues>(DEFAULT_FORM_VALUES);
  const [prospect, setProspect] = useState<EstimateProspectValues>(EMPTY_ESTIMATE_PROSPECT);
  const [lineItems, setLineItems] = useState<EstimateLineItemDraft[]>(DEFAULT_LINE_ITEMS);
  const [isDirty, setIsDirty] = useState(false);
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);

  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string; email: string | null; phone: string | null; billingAddress: string; customerType: string | null; state: string | null }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ id: string; label: string; customerId: string | null }>>([]);
  const [preparedByOptions, setPreparedByOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [supplierPrices, setSupplierPrices] = useState<EstimateSupplierPriceOption[]>([]);

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

  const selectedCustomer = customerOptions.find((customer) => customer.id === values.customerId) || null;
  const residentialState = selectedCustomer?.state || prospect.state;
  const isOhioResidential = (selectedCustomer?.customerType || prospect.customerType) === "residential"
    && ["OH", "OHIO"].includes(residentialState.trim().toUpperCase());

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
        customerType: customer.customer_type,
        state: customer.state,
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

      const { data: priceEntries } = await supabase
        .from("supplier_price_entries")
        .select("id, material_id, vendor_id, price_list_id, supplier_sku, product_description, unit_of_measure, unit_price, contractor_price, availability, created_at")
        .eq("company_id", workspace.context.companyId)
        .order("created_at", { ascending: false });
      const priceListIds = [...new Set((priceEntries ?? []).map((entry) => entry.price_list_id))];
      const priceVendorIds = [...new Set((priceEntries ?? []).map((entry) => entry.vendor_id))];
      const [{ data: priceLists }, { data: priceVendors }] = await Promise.all([
        priceListIds.length ? supabase.from("supplier_price_lists").select("id, effective_on, verified_on, source_filename, status").eq("company_id", workspace.context.companyId).in("id", priceListIds).eq("status", "active") : Promise.resolve({ data: [] }),
        priceVendorIds.length ? supabase.from("vendors").select("id, display_name").eq("company_id", workspace.context.companyId).in("id", priceVendorIds) : Promise.resolve({ data: [] }),
      ]);
      const listMap = Object.fromEntries((priceLists ?? []).map((list) => [list.id, list]));
      const priceVendorMap = Object.fromEntries((priceVendors ?? []).map((vendor) => [vendor.id, vendor.display_name]));
      const latestKeys = new Set<string>();
      const nextSupplierPrices = (priceEntries ?? [])
        .filter((entry) => Boolean(listMap[entry.price_list_id]))
        .sort((left, right) => listMap[right.price_list_id].effective_on.localeCompare(listMap[left.price_list_id].effective_on))
        .filter((entry) => {
          const key = `${entry.vendor_id}:${entry.supplier_sku.toLowerCase()}`;
          if (latestKeys.has(key)) return false;
          latestKeys.add(key);
          return true;
        })
        .map((entry): EstimateSupplierPriceOption => ({
          id: entry.id,
          materialId: entry.material_id,
          vendorId: entry.vendor_id,
          vendorName: priceVendorMap[entry.vendor_id] || "Supplier",
          supplierSku: entry.supplier_sku,
          description: entry.product_description,
          unitOfMeasure: entry.unit_of_measure,
          effectiveUnitCost: entry.contractor_price ?? entry.unit_price,
          verifiedOn: listMap[entry.price_list_id].verified_on,
          sourceFilename: listMap[entry.price_list_id].source_filename,
          availability: entry.availability,
        }));

      if (isSubscribed) {
        setCustomerOptions(nextCustomerOptions);
        setProjectOptions(nextProjectOptions);
        setPreparedByOptions(nextPreparedByOptions);
        setSupplierPrices(nextSupplierPrices);
      }

      if (mode === "create") {
        const estimateNumber = await getNextEstimateNumber(supabase, workspace.context.companyId);

        if (isSubscribed) {
          setValues((current) => ({ ...current, estimateNumber }));
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

      const [estimateResult, prospectResult] = await Promise.all([
        loadEstimateById(supabase, workspace.context.companyId, estimateId),
        loadEstimateProspect(supabase, workspace.context.companyId, estimateId),
      ]);

      if (estimateResult.error || !estimateResult.data) {
        if (isSubscribed) {
          setErrorMessage(estimateResult.error || "Unable to load estimate.");
          setIsLoading(false);
        }
        return;
      }

      if (prospectResult.error) {
        if (isSubscribed) {
          setErrorMessage(prospectResult.error);
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
        setProspect(prospectResult.data || EMPTY_ESTIMATE_PROSPECT);
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
                materialId: lineItem.material_id || "",
                supplierPriceEntryId: lineItem.supplier_price_entry_id || "",
                supplierVendorId: lineItem.supplier_vendor_id || "",
                costSource: lineItem.cost_source || "",
                costVerifiedOn: lineItem.cost_verified_on || "",
                supplierUnitCostSnapshot: lineItem.supplier_unit_cost_snapshot === null ? "" : String(lineItem.supplier_unit_cost_snapshot),
                costOverride: lineItem.cost_override,
              }))
            : DEFAULT_LINE_ITEMS,
        );
        setIsLoading(false);
      }
    };

    void load();
    return () => { isSubscribed = false; };
  }, [supabase, mode, estimateId]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  function onFieldChange<K extends keyof EstimateFormValues>(field: K, value: EstimateFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage(null);
    setIsDirty(true);
  }

  function onProspectChange<K extends keyof EstimateProspectValues>(field: K, value: EstimateProspectValues[K]) {
    setProspect((current) => ({ ...current, [field]: value }));
    setProspectErrors((current) => ({ ...current, [field]: undefined }));
    setSuccessMessage(null);
    setIsDirty(true);
  }

  async function submit(action: "draft" | "continue" | "changes" | "send") {
    if (isSaving) return;

    setErrorMessage(null);
    setSuccessMessage(null);

    const nextErrors = validateEstimateForm(values, lineItems);
    const nextProspectErrors = values.customerId ? {} : validateEstimateProspect(prospect);
    setErrors(nextErrors);
    setProspectErrors(nextProspectErrors);

    if (Object.keys(nextErrors).length > 0 || Object.keys(nextProspectErrors).length > 0) return;
    if (!companyId || !userId) { setErrorMessage("Workspace is not ready."); return; }
    if (!supabase) { setErrorMessage("Unable to connect right now. Please try again shortly."); return; }

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

      const prospectPersistence = values.customerId
        ? await removeEstimateProspect(supabase, companyId, result.estimateId)
        : await saveEstimateProspect({ supabase, companyId, estimateId: result.estimateId, userId, values: prospect });

      if (prospectPersistence.error) {
        setErrorMessage(prospectPersistence.error);
        return;
      }

      await photoUploadRef.current?.upload(result.estimateId, companyId, userId);

      setIsDirty(false);

      if (action === "send") {
        if (isOhioResidential) {
          router.push(`/estimates/${result.estimateId}?createdForReview=1#home-solicitation-review`);
          router.refresh();
          return;
        }
        try {
          const response = await fetch(`/api/estimates/${result.estimateId}/contract`, { method: "POST" });
          const body = await response.json().catch(() => ({})) as { error?: string };
          if (!response.ok) {
            const sendIssue = body.error || "The estimate was saved, but B.O.S. could not send it. Review the send requirement and try again.";
            router.push(`/estimates/${result.estimateId}?sendIssue=${encodeURIComponent(sendIssue)}`);
            router.refresh();
            return;
          }
          setSuccessMessage("Estimate sent successfully.");
          router.push(`/estimates/${result.estimateId}`);
          router.refresh();
          return;
        } catch (sendError) {
          console.error("Send estimate error", sendError);
          const sendIssue = "The estimate was saved, but B.O.S. could not confirm delivery. Retry sending from this page.";
          router.push(`/estimates/${result.estimateId}?sendIssue=${encodeURIComponent(sendIssue)}`);
          router.refresh();
          return;
        }
      }

      setSuccessMessage(values.customerId ? "Estimate saved successfully." : "Estimate and prospective customer details saved successfully.");

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
    if (isDirty) { setIsDiscardDialogOpen(true); return; }
    router.push(mode === "edit" && estimateId ? `/estimates/${estimateId}` : "/estimates");
  }

  function confirmDiscardChanges() {
    setIsDiscardDialogOpen(false);
    router.push(mode === "edit" && estimateId ? `/estimates/${estimateId}` : "/estimates");
  }

  if (isLoading) {
    return <div className="space-y-6"><SkeletonLoader className="h-12 w-80" /><SkeletonLoader className="h-52 w-full" /><SkeletonLoader className="h-72 w-full" /><SkeletonLoader className="h-72 w-full" /></div>;
  }

  if (errorMessage && !companyId) return <ErrorState title="Unable to load estimate builder" description={errorMessage} />;

  return (
    <div className="space-y-6">
      <ConfirmDialog open={isDiscardDialogOpen} title="Discard changes" description="Discard unsaved changes?" cancelLabel="Keep Editing" confirmLabel="Discard Changes" onCancel={() => setIsDiscardDialogOpen(false)} onConfirm={confirmDiscardChanges} />

      <PageHeader
        eyebrow="COMPANY WORKSPACE"
        title={mode === "create" ? "New Estimate" : "Edit Estimate"}
        description="Build the quote once. For a new prospect, B.O.S. will create or match the Customer and create the Project automatically after acceptance."
        secondaryActions={<Button type="button" variant="secondary" size="md" onClick={handleCancel}>Cancel</Button>}
      />

      <form className="space-y-6" onSubmit={(event) => { event.preventDefault(); void submit(mode === "edit" ? "changes" : "send"); }}>
        <EstimateInformationSection values={values} errors={errors} preparedByOptions={preparedByOptions} onFieldChange={onFieldChange} />

        <EstimateCustomerProjectSection
          values={values}
          errors={errors}
          prospect={prospect}
          prospectErrors={prospectErrors}
          customers={customerOptions}
          projects={projectOptions}
          onFieldChange={onFieldChange}
          onProspectChange={onProspectChange}
        />

        <EstimateLineItemsSection
          lineItems={lineItems}
          supplierPrices={supplierPrices}
          localeTag={localeTag}
          error={errors["lineItems.0"] || errors["lineItems.1"] || errors["lineItems.2"]}
          onChange={(nextLineItems) => {
            setLineItems(nextLineItems);
            setErrors((current) => ({ ...current, "lineItems.0": undefined, "lineItems.1": undefined, "lineItems.2": undefined }));
            setIsDirty(true);
          }}
        />

        <EstimateTotalsSection totals={totals} values={values} localeTag={localeTag} onFieldChange={onFieldChange} />
        <RecordPhotoUpload ref={photoUploadRef} entityType="estimate" />
        <EstimateNotesTermsSection values={values} onFieldChange={onFieldChange} />

        {Object.keys(errors).length > 0 || Object.keys(prospectErrors).length > 0 ? (
          <div role="alert" data-orion-status="estimate-validation-error" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">Please complete the highlighted required estimate and customer information before saving.</div>
        ) : null}

        {errorMessage ? <div role="alert" data-orion-status="estimate-save-error" className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">{errorMessage}</div> : null}
        {successMessage ? <div role="status" data-orion-status="estimate-save-success" className="rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3 text-sm text-[var(--color-success-700)]">{successMessage}</div> : null}

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" size="lg" onClick={handleCancel}>Cancel</Button>
          {mode === "create" ? (
            <>
              <Button data-orion-action="save-estimate-draft" data-orion-verify="navigation-or-status" type="button" variant="secondary" size="lg" isLoading={isSaving && saveMode === "draft"} onClick={() => void submit("draft")}>Save Draft</Button>
              <Button data-orion-action="save-estimate-and-continue" data-orion-verify="navigation-or-status" type="button" variant="secondary" size="lg" isLoading={isSaving && saveMode === "continue"} onClick={() => void submit("continue")}>Save and Continue Editing</Button>
            </>
          ) : null}
          <Button data-orion-action={mode === "create" ? (isOhioResidential ? "estimate.create-and-review" : "estimate.save-and-send") : "save-estimate-and-continue"} data-orion-verify="navigation-or-status" type="submit" size="lg" isLoading={isSaving && (saveMode === "send" || saveMode === "changes")}>{mode === "create" ? (isOhioResidential ? "Create Estimate & Review" : "Send Estimate") : "Save Changes"}</Button>
        </div>
      </form>
    </div>
  );
}
