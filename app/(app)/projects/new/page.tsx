"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/projects/statuses";

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
          setErrorMessage("Unable to connect right now. Please try again shortly.");
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
            setErrorMessage("Unable to load customers right now. Please try again shortly.");
          }

          return;
        }

        const mappedOptions = (data ?? []).map((customer) => ({
          id: customer.id,
          label: getCustomerDisplayName(customer),
        }));

        if (isSubscribed) {
          setCustomerOptions(mappedOptions);
        }
      } catch (caughtError) {
        console.error("Load customer options error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(
            "Something unexpected happened while loading project customers. Please try again.",
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
  }, [supabase]);

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
      setErrorMessage("Project name is required.");
      return;
    }

    if (!formData.customerId) {
      setErrorMessage("Customer is required.");
      return;
    }

    if (!formData.projectType) {
      setErrorMessage("Project type is required.");
      return;
    }

    if (!formData.status) {
      setErrorMessage("Status is required.");
      return;
    }

    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const workspace = await resolveWorkspaceContext(supabase);

      if (workspace.errorMessage || !workspace.context) {
        setErrorMessage(workspace.errorMessage);
        return;
      }

      const client = supabase;

      if (!client) {
        setErrorMessage("Unable to connect right now. Please try again shortly.");
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
        setErrorMessage(`Unable to save project: ${error.message}`);
        return;
      }

      if (!data?.id) {
        setErrorMessage("Project was saved, but we could not open its workspace.");
        return;
      }

      setSuccessMessage("Project created successfully.");
      router.push(`/projects/${data.id}`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save project error:", caughtError);
      setErrorMessage("Something unexpected happened while saving the project. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">Project Management</p>

          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
            New Project
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            Create a company-scoped project using the existing project workspace model.
          </p>
        </div>

        <Link
          href="/projects"
          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
        >
          Back to Projects
        </Link>
      </section>

      <form onSubmit={handleSubmit} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Project Information</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field>
              <Label htmlFor="projectName">Project Name</Label>
              <input
                id="projectName"
                value={formData.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
                className={inputClassName}
                placeholder="Kitchen renovation"
                required
              />
            </Field>

            <Field>
              <Label htmlFor="customerId">Customer</Label>
              <select
                id="customerId"
                value={formData.customerId}
                onChange={(event) => updateField("customerId", event.target.value)}
                className={inputClassName}
                required
                disabled={isLoading || customerOptions.length === 0}
              >
                <option value="">Select a customer</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </select>
              {!isLoading && customerOptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  You need at least one customer before creating a project.
                </p>
              ) : null}
            </Field>

            <Field>
              <Label htmlFor="projectNumber">Project Number</Label>
              <input
                id="projectNumber"
                value={formData.projectNumber}
                onChange={(event) => updateField("projectNumber", event.target.value)}
                className={inputClassName}
                placeholder="PRJ-1024"
              />
            </Field>

            <Field>
              <Label htmlFor="projectType">Project Type</Label>
              <select
                id="projectType"
                value={formData.projectType}
                onChange={(event) => updateField("projectType", event.target.value)}
                className={inputClassName}
                required
              >
                <option value="">Select project type</option>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(event) => updateField("status", event.target.value)}
                className={inputClassName}
                required
              >
                {PROJECT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <Label htmlFor="estimatedStartDate">Estimated Start</Label>
              <input
                id="estimatedStartDate"
                type="date"
                value={formData.estimatedStartDate}
                onChange={(event) => updateField("estimatedStartDate", event.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field>
              <Label htmlFor="estimatedEndDate">Estimated Completion</Label>
              <input
                id="estimatedEndDate"
                type="date"
                value={formData.estimatedEndDate}
                onChange={(event) => updateField("estimatedEndDate", event.target.value)}
                className={inputClassName}
              />
            </Field>

            <Field>
              <Label htmlFor="estimatedCost">Estimated Cost</Label>
              <input
                id="estimatedCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(event) => updateField("estimatedCost", event.target.value)}
                className={inputClassName}
                placeholder="125000"
              />
            </Field>

            <Field>
              <Label htmlFor="contractAmount">Contract Amount</Label>
              <input
                id="contractAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.contractAmount}
                onChange={(event) => updateField("contractAmount", event.target.value)}
                className={inputClassName}
                placeholder="150000"
              />
            </Field>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Description and Address</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <Field className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(event) => updateField("description", event.target.value)}
                className={`${inputClassName} min-h-32`}
                placeholder="Scope of work, notes, or special instructions"
              />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="addressLine1">Address Line 1</Label>
              <input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(event) => updateField("addressLine1", event.target.value)}
                className={inputClassName}
                placeholder="123 Main Street"
              />
            </Field>

            <Field className="md:col-span-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(event) => updateField("addressLine2", event.target.value)}
                className={inputClassName}
                placeholder="Unit 4B"
              />
            </Field>

            <Field>
              <Label htmlFor="city">City</Label>
              <input
                id="city"
                value={formData.city}
                onChange={(event) => updateField("city", event.target.value)}
                className={inputClassName}
                placeholder="Austin"
              />
            </Field>

            <Field>
              <Label htmlFor="state">State</Label>
              <input
                id="state"
                value={formData.state}
                onChange={(event) => updateField("state", event.target.value)}
                className={inputClassName}
                placeholder="TX"
              />
            </Field>

            <Field>
              <Label htmlFor="postalCode">Postal Code</Label>
              <input
                id="postalCode"
                value={formData.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                className={inputClassName}
                placeholder="78701"
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
            Cancel
          </Link>

          <button
            type="submit"
            disabled={isSaving || isLoading}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving Project..." : "Create Project"}
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

function getCustomerDisplayName(customer: CustomerSummaryRow) {
  const companyName = customer.company_name?.trim() || "";
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  const fallbackName = [firstName, lastName].filter(Boolean).join(" ");

  if (customer.customer_type?.trim().toLowerCase() === "commercial" && companyName) {
    return companyName;
  }

  return fallbackName || companyName || "Unnamed Customer";
}