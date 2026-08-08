"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormField, Input, PageHeader, Select, Textarea } from "@/components/ui";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import { PROJECT_TYPE_OPTIONS } from "@/lib/projects";
import { PROJECT_STATUSES } from "@/lib/projects/statuses";
import { useI18n } from "@/lib/i18n/provider";

type CustomerSummaryRow = Pick<
  Database["public"]["Tables"]["customers"]["Row"],
  | "id"
  | "first_name"
  | "last_name"
  | "company_name"
  | "customer_type"
  | "email"
  | "phone"
  | "address_line_1"
  | "address_line_2"
  | "city"
  | "state"
  | "postal_code"
>;

type CustomerOption = {
  id: string;
  label: string;
  snapshot: {
    jobSiteName: string;
    primaryContactName: string;
    primaryContactPhone: string;
    primaryContactEmail: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    state: string;
    postalCode: string;
  };
};

type SnapshotTouchedState = {
  jobSiteName: boolean;
  primaryContactName: boolean;
  primaryContactPhone: boolean;
  primaryContactEmail: boolean;
  addressLine1: boolean;
  addressLine2: boolean;
  city: boolean;
  state: boolean;
  postalCode: boolean;
};

const initialSnapshotTouchedState: SnapshotTouchedState = {
  jobSiteName: false,
  primaryContactName: false,
  primaryContactPhone: false,
  primaryContactEmail: false,
  addressLine1: false,
  addressLine2: false,
  city: false,
  state: false,
  postalCode: false,
};

type ProjectFormData = {
  projectName: string;
  customerId: string;
  projectNumber: string;
  projectType: string;
  status: string;
  description: string;
  jobSiteName: string;
  primaryContactName: string;
  primaryContactPhone: string;
  primaryContactEmail: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  estimatedStartDate: string;
  estimatedEndDate: string;
  estimatedCost: string;
  contractAmount: string;
  requiredDownPayment: string;
};

const initialFormData: ProjectFormData = {
  projectName: "",
  customerId: "",
  projectNumber: "",
  projectType: "",
  status: "lead",
  description: "",
  jobSiteName: "",
  primaryContactName: "",
  primaryContactPhone: "",
  primaryContactEmail: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  estimatedStartDate: "",
  estimatedEndDate: "",
  estimatedCost: "",
  contractAmount: "",
  requiredDownPayment: "",
};

export default function NewProjectPage() {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const localeTag = locale === "es" ? "es-ES" : "en-US";
  const requestedCustomerId = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("customerId")?.trim() || "";
  }, []);

  const [formData, setFormData] = useState<ProjectFormData>(initialFormData);
  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([]);
  const [snapshotTouched, setSnapshotTouched] = useState<SnapshotTouchedState>(initialSnapshotTouchedState);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);

  useEffect(() => {
    let isSubscribed = true;

    const loadCustomers = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setPrefillMessage(null);

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
          .select("id, first_name, last_name, company_name, customer_type, email, phone, address_line_1, address_line_2, city, state, postal_code")
          .eq("company_id", workspace.context.companyId)
          .order("created_at", { ascending: false });

        if (error) {
          if (isSubscribed) {
            setErrorMessage(t("projects.errorLoadProjectCustomers"));
          }

          return;
        }

        const mappedOptions = (data ?? []).map((customer) => toCustomerOption(customer, t("customers.unnamedCustomer")));

        if (isSubscribed) {
          setCustomerOptions(mappedOptions);

          if (requestedCustomerId) {
            const matchedCustomer = mappedOptions.find((customer) => customer.id === requestedCustomerId);

            if (matchedCustomer) {
              setFormData((current) => applyCustomerSnapshot(current, matchedCustomer, initialSnapshotTouchedState));
              setSnapshotTouched(initialSnapshotTouchedState);
              setPrefillMessage(t("projects.prefillLoadedCustomer"));
            } else {
              setPrefillMessage(t("projects.prefillCustomerUnavailable"));
            }
          }
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
  }, [requestedCustomerId, supabase, t]);

  function updateField<K extends keyof ProjectFormData>(
    field: K,
    value: ProjectFormData[K],
    options?: { markSnapshotDirty?: boolean },
  ) {
    setFormData((current) => ({
      ...current,
      [field]: value,
    }));

    if ((field in initialSnapshotTouchedState) && options?.markSnapshotDirty !== false) {
      const snapshotField = field as keyof SnapshotTouchedState;
      setSnapshotTouched((current) => ({
        ...current,
        [snapshotField]: true,
      }));
    }
  }

  function handleCustomerChange(customerId: string) {
    const selectedCustomer = customerOptions.find((customer) => customer.id === customerId);

    if (!selectedCustomer) {
      updateField("customerId", customerId);
      return;
    }

    setFormData((current) => applyCustomerSnapshot(current, selectedCustomer, snapshotTouched));
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

      const maxAttempts = 3;
      let createdProjectId: string | null = null;
      let lastErrorCode: string | null = null;
      let lastErrorMessage: string | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const generatedProjectNumber = await generateNextProjectNumber(client, workspace.context.companyId);

        const { data, error } = await client
          .from("projects")
          .insert({
            company_id: workspace.context.companyId,
            created_by: workspace.context.userId,
            customer_id: formData.customerId,
            name: formData.projectName.trim(),
            job_site_name: formData.jobSiteName.trim() || null,
            primary_contact_name: formData.primaryContactName.trim() || null,
            primary_contact_phone: formData.primaryContactPhone.trim() || null,
            primary_contact_email: formData.primaryContactEmail.trim() || null,
            project_number: generatedProjectNumber,
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
            required_down_payment: parseCurrencyInput(formData.requiredDownPayment) ?? 0,
          })
          .select("id")
          .single();

        if (!error && data?.id) {
          createdProjectId = data.id;

          break;
        }

        lastErrorCode = error?.code ?? null;
        lastErrorMessage = error?.message ?? null;

        if (lastErrorCode === "23505") {
          continue;
        }

        setErrorMessage(t("projects.errorSaveProject", { message: error?.message || t("projects.errorUnexpectedSave") }));
        return;
      }

      if (!createdProjectId) {
        if (lastErrorCode === "23505") {
          setErrorMessage(t("projects.errorProjectNumberGeneration"));
          return;
        }

        setErrorMessage(t("projects.errorSaveProject", { message: lastErrorMessage || t("projects.errorUnexpectedSave") }));
        return;
      }

      const orion = createSupabaseOrionEventPublisher(client);
      await orion.publishEvent({
        company_id: workspace.context.companyId,
        actor_profile_id: workspace.context.userId,
        event_type: "project.created",
        aggregate_type: "project",
        aggregate_id: createdProjectId,
        source_module: "projects",
        payload: {
          name: formData.projectName.trim(),
          customer_id: formData.customerId,
          project_type: formData.projectType,
          status: formData.status,
          estimated_cost: parseCurrencyInput(formData.estimatedCost),
          contract_amount: parseCurrencyInput(formData.contractAmount),
          required_down_payment: parseCurrencyInput(formData.requiredDownPayment),
        },
        metadata: {
          event_category: "projects",
          event_severity: "info",
          deep_link: `/projects/${createdProjectId}`,
        },
      });

      if (formData.status !== "lead") {
        await orion.publishEvent({
          company_id: workspace.context.companyId,
          actor_profile_id: workspace.context.userId,
          event_type: "project.status_changed",
          aggregate_type: "project",
          aggregate_id: createdProjectId,
          source_module: "projects",
          payload: {
            project_id: createdProjectId,
            previous_status: "lead",
            next_status: formData.status,
          },
          metadata: {
            event_category: "projects",
            event_severity: "info",
            deep_link: `/projects/${createdProjectId}`,
          },
        });
      }

      if (formData.status === "in_progress") {
        await orion.publishEvent({
          company_id: workspace.context.companyId,
          actor_profile_id: workspace.context.userId,
          event_type: "project.started",
          aggregate_type: "project",
          aggregate_id: createdProjectId,
          source_module: "projects",
          payload: {
            project_id: createdProjectId,
            status: formData.status,
          },
          metadata: {
            event_category: "projects",
            event_severity: "info",
            deep_link: `/projects/${createdProjectId}`,
          },
        });
      }

      setSuccessMessage(t("projects.projectCreated"));
      router.push(`/projects/${createdProjectId}`);
      router.refresh();
    } catch (caughtError) {
      console.error("Save project error:", caughtError);
      setErrorMessage(t("projects.errorUnexpectedSave"));
    } finally {
      setIsSaving(false);
    }
  }

  const contractAmountValue = parseCurrencyInput(formData.contractAmount) ?? 0;
  const paymentsReceivedValue = 0;
  const remainingBalanceValue = Math.max(contractAmountValue - paymentsReceivedValue, 0);
  const paymentsReceivedLabel = formatProjectMoney(paymentsReceivedValue, localeTag);
  const remainingBalanceLabel = formatProjectMoney(remainingBalanceValue, localeTag);

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader
        compact
        eyebrow={t("projects.workspace")}
        title={t("projects.newTitle")}
        description={t("projects.newDescription")}
        secondaryActions={(
          <Link href="/projects">
            <Button variant="outline" size="md">{t("projects.backToProjects")}</Button>
          </Link>
        )}
      />

      <form onSubmit={handleSubmit} className="space-y-[var(--space-section)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("projects.sectionProjectInfo")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label={t("projects.projectName")} htmlFor="projectName" required>
              <Input
                id="projectName"
                value={formData.projectName}
                onChange={(event) => updateField("projectName", event.target.value)}
                placeholder={t("projects.projectNameExample")}
                required
              />
            </FormField>

            <FormField label={t("projects.fieldCustomer")} htmlFor="customerId" required>
              <Select
                id="customerId"
                value={formData.customerId}
                onChange={(event) => handleCustomerChange(event.target.value)}
                required
                disabled={isLoading || customerOptions.length === 0}
              >
                <option value="">{t("projects.customerSelect")}</option>
                {customerOptions.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.label}
                  </option>
                ))}
              </Select>
              {!isLoading && customerOptions.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">
                  {t("projects.customerRequiredInfo")}
                </p>
              ) : null}
            </FormField>

            <FormField label={t("projects.projectNumberLabel")} htmlFor="projectNumber">
              <Input
                id="projectNumber"
                value={formData.projectNumber}
                onChange={(event) => updateField("projectNumber", event.target.value)}
                placeholder={t("projects.projectNumberExample")}
              />
            </FormField>

            <FormField label={t("projects.projectType")} htmlFor="projectType" required>
              <Select
                id="projectType"
                value={formData.projectType}
                onChange={(event) => updateField("projectType", event.target.value)}
                required
              >
                <option value="">{t("projects.projectTypeSelect")}</option>
                {PROJECT_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getProjectTypeLabel(option.value, t)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t("projects.status")} htmlFor="status" required>
              <Select
                id="status"
                value={formData.status}
                onChange={(event) => updateField("status", event.target.value)}
                required
              >
                {PROJECT_STATUSES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {getProjectStatusLabel(option.value, t)}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label={t("projects.estimatedStart")} htmlFor="estimatedStartDate">
              <Input
                id="estimatedStartDate"
                type="date"
                value={formData.estimatedStartDate}
                onChange={(event) => updateField("estimatedStartDate", event.target.value)}
              />
            </FormField>

            <FormField label={t("projects.estimatedCompletion")} htmlFor="estimatedEndDate">
              <Input
                id="estimatedEndDate"
                type="date"
                value={formData.estimatedEndDate}
                onChange={(event) => updateField("estimatedEndDate", event.target.value)}
              />
            </FormField>

            <FormField label={t("projects.estimatedCost")} htmlFor="estimatedCost">
              <Input
                id="estimatedCost"
                type="number"
                min="0"
                step="0.01"
                value={formData.estimatedCost}
                onChange={(event) => updateField("estimatedCost", event.target.value)}
                placeholder={t("projects.estimatedCostExample")}
              />
            </FormField>

            <FormField label={t("projects.jobSiteName")} htmlFor="jobSiteName">
              <Input
                id="jobSiteName"
                value={formData.jobSiteName}
                onChange={(event) => updateField("jobSiteName", event.target.value)}
                placeholder={t("projects.jobSiteNameExample")}
              />
            </FormField>

            <FormField label={t("projects.primaryContactName")} htmlFor="primaryContactName">
              <Input
                id="primaryContactName"
                value={formData.primaryContactName}
                onChange={(event) => updateField("primaryContactName", event.target.value)}
                placeholder={t("projects.primaryContactNameExample")}
              />
            </FormField>

            <FormField label={t("projects.primaryContactPhone")} htmlFor="primaryContactPhone">
              <Input
                id="primaryContactPhone"
                value={formData.primaryContactPhone}
                onChange={(event) => updateField("primaryContactPhone", event.target.value)}
                placeholder={t("projects.primaryContactPhoneExample")}
              />
            </FormField>

            <FormField label={t("projects.primaryContactEmail")} htmlFor="primaryContactEmail">
              <Input
                id="primaryContactEmail"
                type="email"
                value={formData.primaryContactEmail}
                onChange={(event) => updateField("primaryContactEmail", event.target.value)}
                placeholder={t("projects.primaryContactEmailExample")}
              />
            </FormField>
          </div>

          <p className="mt-5 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            {t("projects.snapshotNotice")}
          </p>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("projects.sectionDescriptionAddress")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label={t("projects.description")} htmlFor="description" className="md:col-span-2">
              <Textarea
                id="description"
                value={formData.description}
                onChange={(event) => updateField("description", event.target.value)}
                className="min-h-32"
                placeholder={t("projects.descriptionExample")}
              />
            </FormField>

            <FormField label={t("projects.addressLine1")} htmlFor="addressLine1" className="md:col-span-2">
              <Input
                id="addressLine1"
                value={formData.addressLine1}
                onChange={(event) => updateField("addressLine1", event.target.value)}
                placeholder={t("projects.addressLine1Example")}
              />
            </FormField>

            <FormField label={t("projects.addressLine2")} htmlFor="addressLine2" className="md:col-span-2">
              <Input
                id="addressLine2"
                value={formData.addressLine2}
                onChange={(event) => updateField("addressLine2", event.target.value)}
                placeholder={t("projects.addressLine2Example")}
              />
            </FormField>

            <FormField label={t("projects.city")} htmlFor="city">
              <Input
                id="city"
                value={formData.city}
                onChange={(event) => updateField("city", event.target.value)}
                placeholder={t("projects.cityExample")}
              />
            </FormField>

            <FormField label={t("projects.state")} htmlFor="state">
              <Input
                id="state"
                value={formData.state}
                onChange={(event) => updateField("state", event.target.value)}
                placeholder={t("projects.stateExample")}
              />
            </FormField>

            <FormField label={t("projects.postalCode")} htmlFor="postalCode">
              <Input
                id="postalCode"
                value={formData.postalCode}
                onChange={(event) => updateField("postalCode", event.target.value)}
                placeholder={t("projects.postalCodeExample")}
              />
            </FormField>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <h2 className="text-lg font-semibold text-slate-950">{t("projects.sectionContractFinancials")}</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <FormField label={t("projects.contractAmount")} htmlFor="contractAmount">
              <Input
                id="contractAmount"
                type="number"
                min="0"
                step="0.01"
                value={formData.contractAmount}
                onChange={(event) => updateField("contractAmount", event.target.value)}
                placeholder={t("projects.contractAmountExample")}
              />
            </FormField>

            <FormField label={t("projects.requiredDownPayment")} htmlFor="requiredDownPayment">
              <Input
                id="requiredDownPayment"
                type="number"
                min="0"
                step="0.01"
                value={formData.requiredDownPayment}
                onChange={(event) => updateField("requiredDownPayment", event.target.value)}
                placeholder={t("projects.requiredDownPaymentExample")}
              />
            </FormField>

            <DisplayField
              label={t("projects.paymentsReceived")}
              value={paymentsReceivedLabel}
              helper={t("projects.availableAfterInvoices")}
            />

            <DisplayField
              label={t("projects.remainingBalance")}
              value={remainingBalanceLabel}
              helper={t("projects.availableAfterInvoices")}
            />
          </div>
        </section>

        {prefillMessage ? <FormAlert tone="info">{prefillMessage}</FormAlert> : null}

        {errorMessage ? <FormAlert tone="error">{errorMessage}</FormAlert> : null}
        {successMessage ? <FormAlert tone="success">{successMessage}</FormAlert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/projects">
            <Button variant="outline" size="lg">{t("projects.cancel")}</Button>
          </Link>

          <Button
            type="submit"
            size="lg"
            disabled={isSaving || isLoading}
          >
            {isSaving ? t("projects.savingProject") : t("projects.createProject")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function DisplayField({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-sm font-semibold text-slate-700">{label}</p>
      <p className="text-lg font-semibold text-slate-950">{value}</p>
      <p className="text-xs text-slate-500">{helper}</p>
    </div>
  );
}

function FormAlert({ tone, children }: { tone: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = tone === "error"
    ? "border-rose-200 bg-rose-50 text-rose-700"
    : tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border-sky-200 bg-sky-50 text-sky-700";

  return <div className={`rounded-2xl border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

async function generateNextProjectNumber(
  client: NonNullable<ReturnType<typeof createClient>>,
  companyId: string,
) {
  const { data, error } = await client
    .from("projects")
    .select("project_number")
    .eq("company_id", companyId)
    .not("project_number", "is", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(error.message || "Unable to read project numbers");
  }

  let maxSequence = 0;

  (data ?? []).forEach((row) => {
    const projectNumber = row.project_number?.trim();

    if (!projectNumber) {
      return;
    }

    const match = /^PRJ-(\d+)$/i.exec(projectNumber);

    if (!match) {
      return;
    }

    const sequence = Number(match[1]);

    if (!Number.isNaN(sequence) && sequence > maxSequence) {
      maxSequence = sequence;
    }
  });

  return `PRJ-${String(maxSequence + 1).padStart(4, "0")}`;
}

function parseCurrencyInput(value: string) {
  if (!value.trim()) {
    return null;
  }

  const numericValue = Number(value);

  return Number.isNaN(numericValue) ? null : numericValue;
}

function formatProjectMoney(value: number, localeTag: string) {
  return new Intl.NumberFormat(localeTag, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getPrimaryContactName(customer: CustomerSummaryRow) {
  const firstName = customer.first_name?.trim() || "";
  const lastName = customer.last_name?.trim() || "";
  return [firstName, lastName].filter(Boolean).join(" ");
}

function toCustomerOption(customer: CustomerSummaryRow, fallbackLabel: string): CustomerOption {
  return {
    id: customer.id,
    label: getCustomerDisplayName(customer, fallbackLabel),
    snapshot: {
      jobSiteName: getCustomerDisplayName(customer, fallbackLabel),
      primaryContactName: getPrimaryContactName(customer),
      primaryContactPhone: customer.phone?.trim() || "",
      primaryContactEmail: customer.email?.trim() || "",
      addressLine1: customer.address_line_1?.trim() || "",
      addressLine2: customer.address_line_2?.trim() || "",
      city: customer.city?.trim() || "",
      state: customer.state?.trim() || "",
      postalCode: customer.postal_code?.trim() || "",
    },
  };
}

function applyCustomerSnapshot(
  current: ProjectFormData,
  customer: CustomerOption,
  touched: SnapshotTouchedState,
): ProjectFormData {
  return {
    ...current,
    customerId: customer.id,
    jobSiteName: touched.jobSiteName ? current.jobSiteName : customer.snapshot.jobSiteName,
    primaryContactName: touched.primaryContactName ? current.primaryContactName : customer.snapshot.primaryContactName,
    primaryContactPhone: touched.primaryContactPhone ? current.primaryContactPhone : customer.snapshot.primaryContactPhone,
    primaryContactEmail: touched.primaryContactEmail ? current.primaryContactEmail : customer.snapshot.primaryContactEmail,
    addressLine1: touched.addressLine1 ? current.addressLine1 : customer.snapshot.addressLine1,
    addressLine2: touched.addressLine2 ? current.addressLine2 : customer.snapshot.addressLine2,
    city: touched.city ? current.city : customer.snapshot.city,
    state: touched.state ? current.state : customer.snapshot.state,
    postalCode: touched.postalCode ? current.postalCode : customer.snapshot.postalCode,
  };
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
