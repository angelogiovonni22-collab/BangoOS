"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { useI18n } from "@/lib/i18n/provider";

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

      const { data, error: insertError } = await supabase.from("customers").insert({
        company_id: workspace.context.companyId,
        customer_type: formData.customerType,
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        company_name: formData.companyName.trim() || null,
        email: formData.email.trim(),
        phone: formData.phoneNumber.trim() || null,
        address_line_1: formData.streetAddress.trim() || null,
        address_line_2: null,
        city: formData.city.trim() || null,
        state: formData.state.trim() || null,
        postal_code: formData.zipCode.trim() || null,
        notes: formData.notes.trim() || null,
        created_by: workspace.context.userId,
      })
        .select("id")
        .single();

      if (insertError) {
        setErrorMessage(t("customers.errorSaveCustomer", { message: insertError.message }));
        return;
      }

      if (!data?.id) {
        setErrorMessage(t("customers.errorMissingCustomerLink"));
        return;
      }

      router.push(`/customers/${data.id}`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save customer error:", caughtError);
      setErrorMessage(t("customers.errorSaveUnexpected"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-medium text-slate-500">{t("customers.pageEyebrow")}</p>

        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">{t("customers.newTitle")}</h1>

        <p className="mt-2 text-slate-600">{t("customers.newDescription")}</p>
      </section>

      <form id="new-customer-form" onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionCustomerInfo")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="customerType">{t("customers.customerType")}</Label>
              <select
                id="customerType"
                value={formData.customerType}
                onChange={(event) => handleFieldChange("customerType", event.target.value as CustomerType)}
                className={inputClassName}
                required
              >
                <option value="residential">{t("customers.typeResidential")}</option>
                <option value="commercial">{t("customers.typeCommercial")}</option>
              </select>
            </Field>

            <Field>
              <Label htmlFor="companyName">{t("customers.companyNameOptional")}</Label>
              <input
                id="companyName"
                type="text"
                value={formData.companyName}
                onChange={(event) => handleFieldChange("companyName", event.target.value)}
                placeholder="Bango Construction LLC"
                className={inputClassName}
              />
            </Field>

            <Field>
              <Label htmlFor="firstName">{t("customers.firstName")}</Label>
              <input
                id="firstName"
                type="text"
                value={formData.firstName}
                onChange={(event) => handleFieldChange("firstName", event.target.value)}
                placeholder="Jordan"
                className={inputClassName}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="lastName">{t("customers.lastName")}</Label>
              <input
                id="lastName"
                type="text"
                value={formData.lastName}
                onChange={(event) => handleFieldChange("lastName", event.target.value)}
                placeholder="Smith"
                className={inputClassName}
                required
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionContactInfo")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="email">{t("customers.email")}</Label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(event) => handleFieldChange("email", event.target.value)}
                placeholder="customer@example.com"
                className={inputClassName}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="phoneNumber">{t("customers.phoneNumber")}</Label>
              <input
                id="phoneNumber"
                type="tel"
                value={formData.phoneNumber}
                onChange={(event) => handleFieldChange("phoneNumber", event.target.value)}
                placeholder="(555) 123-4567"
                className={inputClassName}
                required
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionAddress")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field className="md:col-span-2">
              <Label htmlFor="streetAddress">{t("customers.streetAddress")}</Label>
              <input
                id="streetAddress"
                type="text"
                value={formData.streetAddress}
                onChange={(event) => handleFieldChange("streetAddress", event.target.value)}
                placeholder="123 Main St"
                className={inputClassName}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="city">{t("customers.city")}</Label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(event) => handleFieldChange("city", event.target.value)}
                placeholder="Austin"
                className={inputClassName}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="state">{t("customers.state")}</Label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(event) => handleFieldChange("state", event.target.value)}
                placeholder="TX"
                className={inputClassName}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="zipCode">{t("customers.zipCode")}</Label>
              <input
                id="zipCode"
                type="text"
                value={formData.zipCode}
                onChange={(event) => handleFieldChange("zipCode", event.target.value)}
                placeholder="78701"
                className={inputClassName}
                required
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t("customers.sectionAdditional")}</h2>

          <Field className="mt-5">
            <Label htmlFor="notes">{t("customers.notes")}</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(event) => handleFieldChange("notes", event.target.value)}
              placeholder="Add any customer-specific details, preferences, or project notes..."
              rows={5}
              className={inputClassName}
            />
          </Field>
        </section>

        {errorMessage ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={handleCancel}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            {t("customers.cancel")}
          </button>

          <button
            type="submit"
            form="new-customer-form"
            disabled={isSubmitDisabled}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? t("customers.saving") : t("customers.saveCustomer")}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function Field({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}

function Label({
  children,
  htmlFor,
}: {
  children: React.ReactNode;
  htmlFor: string;
}) {
  return (
    <label htmlFor={htmlFor} className="mb-2 block text-sm font-medium text-slate-700">
      {children}
    </label>
  );
}
