"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createCustomer, CustomerCreateError } from "@/lib/customers";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";
import { RecordPhotoUpload, type RecordPhotoUploadHandle } from "@/components/attachments/record-photo-upload";

type CustomerType = "residential" | "commercial";

type CustomerFormData = {
  customerType: CustomerType;
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
  notes: string;
};

const initialFormData: CustomerFormData = {
  customerType: "residential",
  companyName: "",
  firstName: "",
  lastName: "",
  email: "",
  phoneNumber: "",
  streetAddress: "",
  city: "",
  state: "",
  zipCode: "",
  notes: "",
};

export default function NewCustomerPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const photoUploadRef = useRef<RecordPhotoUploadHandle>(null);

  const [formData, setFormData] = useState<CustomerFormData>(initialFormData);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasMissingRequiredValues =
    !formData.customerType
    || !formData.firstName.trim()
    || !formData.lastName.trim()
    || !formData.email.trim()
    || !formData.phoneNumber.trim()
    || !formData.streetAddress.trim()
    || !formData.city.trim()
    || !formData.state.trim()
    || !formData.zipCode.trim();

  const isSubmitDisabled = isSaving || hasMissingRequiredValues;

  const handleFieldChange = <K extends keyof CustomerFormData>(
    field: K,
    value: CustomerFormData[K],
  ) => {
    setFormData((previous) => ({
      ...previous,
      [field]: value,
    }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleCancel = () => {
    setFormData(initialFormData);
    setErrorMessage(null);
  };

  const resolveWorkspaceError = (errorCode: string | null, fallback: string | null) => {
    if (errorCode === "unauthenticated") {
      return t("customers.errorLoginRequired");
    }

    if (errorCode === "profile_missing") {
      return t("customers.errorProfileMissing");
    }

    if (errorCode === "company_missing") {
      return t("customers.errorCompanyMissing");
    }

    if (errorCode === "supabase_unavailable") {
      return t("customers.errorConnect");
    }

    return fallback || t("customers.errorSaveUnexpected");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!formData.customerType) {
      setErrorMessage(t("customers.validationSelectType"));
      return;
    }

    if (!formData.firstName.trim()) {
      setErrorMessage(t("customers.validationFirstName"));
      return;
    }

    if (!formData.lastName.trim()) {
      setErrorMessage(t("customers.validationLastName"));
      return;
    }

    if (!formData.email.trim()) {
      setErrorMessage(t("customers.validationEmail"));
      return;
    }

    if (!supabase) {
      setErrorMessage(t("customers.errorConnect"));
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        setErrorMessage(resolveWorkspaceError(workspace.errorCode, workspace.errorMessage));
        return;
      }

      const created = await createCustomer({
        supabase,
        companyId: workspace.context.companyId,
        actorProfileId: workspace.context.userId,
        role: workspace.context.role,
        input: {
          customerType: formData.customerType,
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phoneNumber,
          addressLine1: formData.streetAddress,
          city: formData.city,
          state: formData.state,
          postalCode: formData.zipCode,
          companyName: formData.companyName,
          addressLine2: null,
          notes: formData.notes,
        },
        duplicateMode: "allow",
      });

      await photoUploadRef.current?.upload(created.customerId, workspace.context.companyId, workspace.context.userId);

      router.push(created.deepLink);
      router.refresh();
    } catch (caughtError) {
      console.error("Save customer error:", caughtError);

      if (caughtError instanceof CustomerCreateError) {
        if (caughtError.code === "VALIDATION") {
          const firstError = Array.isArray(caughtError.details.validationErrors)
            ? String(caughtError.details.validationErrors[0] || "")
            : caughtError.message;
          setErrorMessage(firstError || t("customers.errorSaveUnexpected"));
          return;
        }

        if (caughtError.code === "PERMISSION") {
          setErrorMessage(t("customers.errorSaveUnexpected"));
          return;
        }

        if (caughtError.code === "DUPLICATE") {
          setErrorMessage(caughtError.message);
          return;
        }

        if (caughtError.code === "PERSISTENCE") {
          setErrorMessage(t("customers.errorSaveCustomer", { message: caughtError.message }));
          return;
        }
      }

      setErrorMessage(t("customers.errorSaveUnexpected"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow={t("customers.pageEyebrow")}
        title={t("customers.newTitle")}
        description={t("customers.newDescription")}
      />

      <form id="new-customer-form" onSubmit={handleSubmit} className="space-y-[var(--space-section)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionCustomerInfo")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label={t("customers.customerType")} htmlFor="customerType" required>
              <Select
                id="customerType"
                value={formData.customerType}
                onChange={(event) => handleFieldChange("customerType", event.target.value as CustomerType)}
                required
              >
                <option value="residential">{t("customers.typeResidential")}</option>
                <option value="commercial">{t("customers.typeCommercial")}</option>
              </Select>
            </FormField>

            <FormField label={t("customers.companyNameOptional")} htmlFor="companyName">
              <Input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(event) => handleFieldChange("companyName", event.target.value)}
                placeholder="Bango Construction LLC"
              />
            </FormField>

            <FormField label={t("customers.firstName")} htmlFor="firstName" required>
              <Input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(event) => handleFieldChange("firstName", event.target.value)}
                placeholder="Jordan"
                required
              />
            </FormField>

            <FormField label={t("customers.lastName")} htmlFor="lastName" required>
              <Input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(event) => handleFieldChange("lastName", event.target.value)}
                placeholder="Smith"
                required
              />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionContactInfo")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label={t("customers.email")} htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
                placeholder="customer@example.com"
                required
              />
            </FormField>

            <FormField label={t("customers.phoneNumber")} htmlFor="phoneNumber" required>
              <Input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(event) => handleFieldChange("phoneNumber", event.target.value)}
                placeholder="(555) 123-4567"
                required
              />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionAddress")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label={t("customers.streetAddress")} htmlFor="streetAddress" required className="md:col-span-2">
              <Input
                id="streetAddress"
                type="text"
                value={formData.streetAddress}
                onChange={(event) => handleFieldChange("streetAddress", event.target.value)}
                placeholder="123 Main St"
                required
              />
            </FormField>

            <FormField label={t("customers.city")} htmlFor="city" required>
              <Input
                id="city"
                type="text"
                value={formData.city}
                onChange={(event) => handleFieldChange("city", event.target.value)}
                placeholder="Austin"
                required
              />
            </FormField>

            <FormField label={t("customers.state")} htmlFor="state" required>
              <Input
                id="state"
                type="text"
                value={formData.state}
                onChange={(event) => handleFieldChange("state", event.target.value)}
                placeholder="TX"
                required
              />
            </FormField>

            <FormField label={t("customers.zipCode")} htmlFor="zipCode" required>
              <Input
                id="zipCode"
                type="text"
                value={formData.zipCode}
                onChange={(event) => handleFieldChange("zipCode", event.target.value)}
                placeholder="78701"
                required
              />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionAdditional")}</h2>

          <div className="mt-5">
            <FormField label={t("customers.notes")} htmlFor="notes">
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(event) => handleFieldChange("notes", event.target.value)}
              placeholder="Add any customer-specific details, preferences, or project notes..."
              rows={5}
              className="min-h-28"
            />
            </FormField>
          </div>
        </section>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleCancel}
          >
            {t("customers.cancel")}
          </Button>

          <Button
            type="submit"
            size="lg"
            form="new-customer-form"
            disabled={isSubmitDisabled}
          >
            {isSaving ? t("customers.saving") : t("customers.saveCustomer")}
          </Button>
        </div>
        <RecordPhotoUpload ref={photoUploadRef} entityType="customer" />
      </form>
    </div>
  );
}
