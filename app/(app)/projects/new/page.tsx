"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/projects/statuses";
import { useI18n } from "@/lib/i18n/provider";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  "id" | "first_name" | "last_name" | "company_name" | "customer_type"
>;

type ProjectFormData = {
  projectName: string;
  customerId: string;
  projectNumber: string;
  projectType: string;
  status: string;
  description: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  estimatedCost: string;
  contractAmount: string;
};

const initialFormData: ProjectFormData = {
  projectName: "",
  customerId: "",
  projectNumber: "",
  projectType: "",
  status: "lead",
  description: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  estimatedStartDate: "",
  estimatedEndDate: "",
  estimatedCost: "",
  contractAmount: "",
};

export default function NewProjectPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [customerOptions, setCustomerOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const loadCustomers = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        if (isSubscribed) {
          setErrorMessage(workspace.errorMessage);
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage(t("projects.errorConnect"));
          setIsLoading(false);
        }

        return;
      }

      try {
        const { data, error } = await client
          .from("customers")
          .select("id, first_name, last_name, company_name, customer_type")
          .eq("company_id", workspace.context.companyId)
          .order("created_at", { ascending: false });

        if (error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadProjectCustomers"));
          }

          return;
        }

        const mappedOptions = (data ?? []).map((customer) => ({
          id: customer.id,
          label: getCustomerDisplayName(customer, t("customers.unnamedCustomer")),
        }));

        if (isSubscribed) {
          setCustomerOptions(mappedOptions);
        }
      } catch (caughtError) {
        console.error("Load customer options error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(
            t("projects.errorUnexpectedProjectCustomers"),
          );
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadCustomers();

    return () => {
      isSubscribed = false;
    };
  }, [supabase, t]);

  function updateField<K extends keyof ProjectFormData>(
    field: K,
    value: ProjectFormData[K],
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!formData.projectName.trim()) {
      setErrorMessage(t("projects.validationProjectName"));
      return;
    }

    if (!formData.customerId) {
      setErrorMessage(t("projects.validationCustomer"));
      return;
    }

    if (!formData.projectType) {
      setErrorMessage(t("projects.validationProjectType"));
      return;
    }

    if (!formData.status) {
      setErrorMessage(t("projects.validationStatus"));
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        setErrorMessage(workspace.errorMessage || t("projects.errorLoadWorkspace"));
        return;
      }

      const client = supabase;

      if (!client) {
        setErrorMessage(t("projects.errorConnect"));
        return;
      }

      const { data, error } = await client
        .from("projects")
        .insert({
          company_id: workspace.context.companyId,
          created_by: workspace.context.userId,
          customer_id: formData.customerId,
          name: formData.projectName.trim(),
          project_number: formData.projectNumber.trim() || null,
          project_type: formData.projectType,
          status: formData.status,
          description: formData.description.trim() || null,
          address_line_1: formData.addressLine1.trim() || null,
          address_line_2: formData.addressLine2.trim() || null,
          city: formData.city.trim() || null,
          state: formData.state.trim() || null,
          postal_code: formData.postalCode.trim() || null,
          estimated_start_date: formData.estimatedStartDate || null,
          estimated_end_date: formData.estimatedEndDate || null,
          estimated_cost: parseCurrencyInput(formData.estimatedCost),
          contract_amount: parseCurrencyInput(formData.contractAmount),
        })
        .select("id")
        .single();

      if (error) {
        setErrorMessage(t("projects.errorSaveProject", { message: error.message }));
        return;
      }

      if (!data?.id) {
        setErrorMessage(t("projects.errorMissingProjectLink"));
        return;
      }

      setSuccessMessage(t("projects.projectCreated"));
      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save project error:", caughtError);
      setErrorMessage(t("projects.errorUnexpectedSave"));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">{t("projects.workspace")}</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            {t("projects.newTitle")}
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            {t("projects.newDescription")}
          </p>
        </div>

        <Link
          href="/projects"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          {t("projects.backToProjects")}
        </Link>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t("projects.sectionProjectInfo")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="projectName">{t("projects.projectName")}</Label>
              <input
                id="projectName"
                value={formData.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.projectNameExample")}
                required
              />
            </Field>

            <Field>
              <Label htmlFor="customerId">{t("projects.fieldCustomer")}</Label>
              <select
                id="customerId"
                value={formData.customerId}
                onChange={(event) => updateField("customerId", event.target.value)}
                className={inputClassName}
                required
                disabled={isLoading || customerOptions.length === 0}
              >
                <option value="">{t("projects.customerSelect")}</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </select>
              {!isLoading && customerOptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  {t("projects.customerRequiredInfo")}
                </p>
              ) : null}
            </Field>

            <Field>
              <Label htmlFor="projectNumber">{t("projects.projectNumberLabel")}</Label>
              <input
                id="projectNumber"
                value={formData.projectNumber}
                onChange={(event) => updateField("projectNumber", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.projectNumberExample")}
              />
            </Field>

            <Field>
              <Label htmlFor="projectType">{t("projects.projectType")}</Label>
              <select
                id="projectType"
                value={formData.projectType}
                onChange={(event) => updateField("projectType", event.target.value)}
                className={inputClassName}
                required
              >
                <option value="">{t("projects.projectTypeSelect")}</option>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getProjectTypeLabel(option.value, t)}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <Label htmlFor="status">{t("projects.status")}</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(event) => updateField("status", event.target.value)}
                className={inputClassName}
                required
              >
                {PROJECT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getProjectStatusLabel(option.value, t)}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <Label htmlFor="estimatedStartDate">{t("projects.estimatedStart")}</Label>
              <input
                id="estimatedStartDate"
                type="date"
                value={formData.estimatedStartDate}
                onChange={(event) => updateField("estimatedStartDate", event.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field>
              <Label htmlFor="estimatedEndDate">{t("projects.estimatedCompletion")}</Label>
              <input
                id="estimatedEndDate"
                type="date"
                value={formData.estimatedEndDate}
                onChange={(event) => updateField("estimatedEndDate", event.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field>
              <Label htmlFor="estimatedCost">{t("projects.estimatedCost")}</Label>
              <input
                id="estimatedCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(event) => updateField("estimatedCost", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.estimatedCostExample")}
              />
            </Field>

            <Field>
              <Label htmlFor="contractAmount">{t("projects.contractAmount")}</Label>
              <input
                id="contractAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.contractAmount}
                onChange={(event) => updateField("contractAmount", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.contractAmountExample")}
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{t("projects.sectionDescriptionAddress")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field className="md:col-span-2">
              <Label htmlFor="description">{t("projects.description")}</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(event) => updateField("description", event.target.value)}
                className={`${inputClassName} min-h-32`}
                placeholder={t("projects.descriptionExample")}
              />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="addressLine1">{t("projects.addressLine1")}</Label>
              <input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(event) => updateField("addressLine1", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.addressLine1Example")}
              />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="addressLine2">{t("projects.addressLine2")}</Label>
              <input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(event) => updateField("addressLine2", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.addressLine2Example")}
              />
            </Field>

            <Field>
              <Label htmlFor="city">{t("projects.city")}</Label>
              <input
                id="city"
                value={formData.city}
                onChange={(event) => updateField("city", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.cityExample")}
              />
            </Field>

            <Field>
              <Label htmlFor="state">{t("projects.state")}</Label>
              <input
                id="state"
                value={formData.state}
                onChange={(event) => updateField("state", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.stateExample")}
              />
            </Field>

            <Field>
              <Label htmlFor="postalCode">{t("projects.postalCode")}</Label>
              <input
                id="postalCode"
                value={formData.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                className={inputClassName}
                placeholder={t("projects.postalCodeExample")}
              />
            </Field>
          </div>
        </section>

        {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}
        {successMessage ? <FormAlert tone="success">{successMessage}</FormAlert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/projects"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
          >
            {t("projects.cancel")}
          </Link>

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? t("projects.savingProject") : t("projects.createProject")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`grid gap-2 ${className}`}>{children}</div>;
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor: string }) {
  return (
    <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-700">
      {children}
    </label>
  );
}

function FormAlert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const styles = tone === "error" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

const inputClassName =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100";

function parseCurrencyInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isNaN(numericValue) ? null : numericValue;
}

function getCustomerDisplayName(customer: CustomerSummaryRow, fallbackLabel = "Unnamed Customer") {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || fallbackLabel;
}

function getProjectStatusLabel(statusKey: string, t: (key: string) => string) {
  const statusLabelKey: Record<string, string> = {
    lead: "projects.statusLead",
    estimating: "projects.statusEstimating",
    approved: "projects.statusApproved",
    scheduled: "projects.statusScheduled",
    in_progress: "projects.statusInProgress",
    on_hold: "projects.statusOnHold",
    completed: "projects.statusCompleted",
    cancelled: "projects.statusCancelled",
  };

  return statusLabelKey[statusKey] ? t(statusLabelKey[statusKey]) : statusKey;
}

function getProjectTypeLabel(projectTypeKey: string, t: (key: string) => string) {
  const typeLabelKey: Record<string, string> = {
    residential: "projects.typeResidential",
    commercial: "projects.typeCommercial",
    maintenance: "projects.typeMaintenance",
    renovation: "projects.typeRenovation",
    new_construction: "projects.typeNewConstruction",
    other: "projects.typeOther",
  };

  return typeLabelKey[projectTypeKey] ? t(typeLabelKey[projectTypeKey]) : projectTypeKey;
}
