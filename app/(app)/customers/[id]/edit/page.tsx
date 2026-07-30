"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Button, EmptyState, ErrorState, Input, Select, SkeletonLoader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";

type CustomerRow = Database["public"]["Tables"]["customers"]["Row"];
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

const emptyFormData: CustomerFormData = {
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

export default function EditCustomerPage() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useParams<{ id?: string | string[] }>();
  const customerId = Array.isArray(params?.id) ? params.id[0] : params?.id || "";
  const supabase = useMemo(() => createClient(), []);

  const [customer, setCustomer] = useState<CustomerRow | null>(null);
  const [formData, setFormData] = useState<CustomerFormData>(emptyFormData);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCustomer = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!supabase) {
        if (active) {
          setErrorMessage(t("customers.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      if (!customerId) {
        if (active) {
          setErrorMessage(t("customers.errorReadCustomerId"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const workspace = await resolveWorkspaceContext(supabase);

        if (workspace.errorMessage || !workspace.context) {
          if (active) {
            setErrorMessage(workspace.errorMessage || t("customers.errorLoadCustomerUnexpected"));
            setIsLoading(false);
          }

          return;
        }

        const { data, error } = await supabase
          .from("customers")
          .select("id, customer_type, company_name, first_name, last_name, email, phone, address_line_1, city, state, postal_code, notes, company_id")
          .eq("id", customerId)
          .eq("company_id", workspace.context.companyId)
          .maybeSingle<CustomerRow>();

        if (error) {
          if (active) {
            setErrorMessage(t("customers.errorLoadCustomer"));
            setIsLoading(false);
          }

          return;
        }

        if (!data) {
          if (active) {
            setNotFound(true);
            setIsLoading(false);
          }

          return;
        }

        if (active) {
          setCustomer(data);
          setFormData({
            customerType: normalizeCustomerType(data.customer_type),
            companyName: data.company_name || "",
            firstName: data.first_name || "",
            lastName: data.last_name || "",
            email: data.email || "",
            phoneNumber: data.phone || "",
            streetAddress: data.address_line_1 || "",
            city: data.city || "",
            state: data.state || "",
            zipCode: data.postal_code || "",
            notes: data.notes || "",
          });
          setIsLoading(false);
        }
      } catch (caughtError) {
        console.error("Load customer for edit error:", caughtError);

        if (active) {
          setErrorMessage(t("customers.errorLoadCustomerUnexpected"));
          setIsLoading(false);
        }
      }
    };

    void loadCustomer();

    return () => {
      active = false;
    };
  }, [customerId, supabase, t]);

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

  const handleFieldChange = <K extends keyof CustomerFormData>(field: K, value: CustomerFormData[K]) => {
    setFormData((previous) => ({ ...previous, [field]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (!customer || !supabase) {
      return;
    }

    if (isSaving) {
      return;
    }

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

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        setErrorMessage(workspace.errorMessage || t("customers.errorSaveUnexpected"));
        return;
      }

      const { error } = await supabase
        .from("customers")
        .update({
          customer_type: formData.customerType,
          company_name: formData.companyName.trim() || null,
          first_name: formData.firstName.trim(),
          last_name: formData.lastName.trim(),
          email: formData.email.trim(),
          phone: formData.phoneNumber.trim() || null,
          address_line_1: formData.streetAddress.trim() || null,
          address_line_2: null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          postal_code: formData.zipCode.trim() || null,
          notes: formData.notes.trim() || null,
        })
        .eq("id", customer.id)
        .eq("company_id", workspace.context.companyId);

      if (error) {
        setErrorMessage(t("customers.errorSaveCustomer", { message: error.message }));
        return;
      }

      router.push(`/customers/${customer.id}`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save customer error:", caughtError);
      setErrorMessage(t("customers.errorSaveUnexpected"));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <EditCustomerLoadingState />;
  }

  if (errorMessage) {
    return <ErrorState title={t("customers.errorCustomerTitle")} description={errorMessage} />;
  }

  if (notFound || !customer) {
    return (
      <EmptyState
        title={t("customers.customerNotFoundTitle")}
        description={t("customers.customerNotFoundDescription")}
        action={
          <Link href="/customers" className="inline-flex h-10 items-center rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
            {t("customers.backToCustomers")}
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
        <Link href="/customers" className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">Customers</Link>
        <span>/</span>
        <Link href={`/customers/${customer.id}`} className="text-[var(--color-brand-700)] transition hover:text-[var(--color-brand-800)]">{getCustomerName(customer)}</Link>
        <span>/</span>
        <span>Edit Customer</span>
      </div>

      <section>
        <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Edit Customer</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Update the customer record and keep the profile details aligned.</p>
      </section>

      <form id="edit-customer-form" onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Customer Information</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="customerType">Customer Type</Label>
              <Select id="customerType" value={formData.customerType} onChange={(event) => handleFieldChange("customerType", event.target.value as CustomerType)} required>
                <option value="residential">Residential</option>
                <option value="commercial">Commercial</option>
              </Select>
            </Field>

            <Field>
              <Label htmlFor="companyName">Company Name (optional)</Label>
              <Input id="companyName" type="text" value={formData.companyName} onChange={(event) => handleFieldChange("companyName", event.target.value)} placeholder="Bango Construction LLC" />
            </Field>

            <Field>
              <Label htmlFor="firstName">First Name</Label>
              <Input id="firstName" type="text" value={formData.firstName} onChange={(event) => handleFieldChange("firstName", event.target.value)} required />
            </Field>

            <Field>
              <Label htmlFor="lastName">Last Name</Label>
              <Input id="lastName" type="text" value={formData.lastName} onChange={(event) => handleFieldChange("lastName", event.target.value)} required />
            </Field>
          </div>
        </section>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Contact Information</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={formData.email} onChange={(event) => handleFieldChange("email", event.target.value)} required />
            </Field>

            <Field>
              <Label htmlFor="phoneNumber">Phone Number</Label>
              <Input id="phoneNumber" type="tel" value={formData.phoneNumber} onChange={(event) => handleFieldChange("phoneNumber", event.target.value)} required />
            </Field>
          </div>
        </section>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Address</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field className="md:col-span-2">
              <Label htmlFor="streetAddress">Street Address</Label>
              <Input id="streetAddress" type="text" value={formData.streetAddress} onChange={(event) => handleFieldChange("streetAddress", event.target.value)} required />
            </Field>

            <Field>
              <Label htmlFor="city">City</Label>
              <Input id="city" type="text" value={formData.city} onChange={(event) => handleFieldChange("city", event.target.value)} required />
            </Field>

            <Field>
              <Label htmlFor="state">State</Label>
              <Input id="state" type="text" value={formData.state} onChange={(event) => handleFieldChange("state", event.target.value)} required />
            </Field>

            <Field>
              <Label htmlFor="zipCode">ZIP Code</Label>
              <Input id="zipCode" type="text" value={formData.zipCode} onChange={(event) => handleFieldChange("zipCode", event.target.value)} required />
            </Field>
          </div>
        </section>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-small)] sm:p-6">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Additional Information</h2>

          <Field className="mt-5">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={formData.notes}
              onChange={(event) => handleFieldChange("notes", event.target.value)}
              rows={5}
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-white px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
            />
          </Field>
        </section>

        {errorMessage ? (
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-danger-100)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">{errorMessage}</div>
        ) : null}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" onClick={() => router.push(`/customers/${customer.id}`)}>
            Cancel
          </Button>
          <Button type="submit" size="lg" form="edit-customer-form" disabled={isSubmitDisabled}>
            {isSaving ? "Saving..." : "Save Customer"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function EditCustomerLoadingState() {
  return (
    <div className="space-y-6">
      <SkeletonLoader className="h-7 w-40" />
      <SkeletonLoader className="h-10 w-64" />
      <SkeletonLoader className="h-10 w-full" />
      <SkeletonLoader className="h-10 w-full" />
      <SkeletonLoader className="h-10 w-full" />
    </div>
  );
}

function Field({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={className}>{children}</div>;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return <label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-[var(--color-text-primary)]">{children}</label>;
}

function getCustomerName(row: CustomerRow) {
  const firstName = row.first_name?.trim() || "";
  const lastName = row.last_name?.trim() || "";
  const companyName = row.company_name?.trim() || "";
  const residentialName = [firstName, lastName].filter(Boolean).join(" ");

  return row.customer_type?.trim().toLowerCase() === "commercial"
    ? companyName || residentialName || "Unnamed Customer"
    : residentialName || companyName || "Unnamed Customer";
}

function normalizeCustomerType(value: string | null): CustomerType {
  return value?.trim().toLowerCase() === "commercial" ? "commercial" : "residential";
}