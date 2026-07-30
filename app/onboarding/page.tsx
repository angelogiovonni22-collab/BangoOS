"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import type { Database } from "@/types/database.types";

type BusinessType = "residential" | "commercial" | "both";

type OnboardingForm = {
  companyName: string;
  businessEmail: string;
  businessPhone: string;
  companyAddress: string;
  website: string;
  contractorLicense: string;
  insuranceProvider: string;
  yearsInBusiness: string;
  defaultTaxRate: string;
  ownerName: string;
  businessType: BusinessType;
};

const initialForm: OnboardingForm = {
  companyName: "",
  businessEmail: "",
  businessPhone: "",
  companyAddress: "",
  website: "",
  contractorLicense: "",
  insuranceProvider: "",
  yearsInBusiness: "",
  defaultTaxRate: "",
  ownerName: "",
  businessType: "both",
};

function splitOwnerName(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return { firstName: null, lastName: null, displayName: null };
  }

  const parts = trimmed.split(/\s+/).filter(Boolean);

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: null,
      displayName: parts[0],
    };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    displayName: trimmed,
  };
}

type CompanyInsert = Database["public"]["Tables"]["companies"]["Insert"];
type CompanyUpdate = Database["public"]["Tables"]["companies"]["Update"];

function trimToNull(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [step, setStep] = useState(1);
  const [form, setForm] = useState<OnboardingForm>(initialForm);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function updateField<K extends keyof OnboardingForm>(
    field: K,
    value: OnboardingForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    if (error) {
      setError("");
    }
  }

  function validateCurrentStep() {
    if (step === 1) {
      if (!form.companyName.trim()) {
        setError(t("onboarding.validationCompanyName"));
        return false;
      }

      if (!form.businessEmail.trim()) {
        setError(t("onboarding.validationBusinessEmail"));
        return false;
      }

      if (!form.businessEmail.includes("@")) {
        setError(t("onboarding.validationBusinessEmailInvalid"));
        return false;
      }
    }

    if (step === 2) {
      if (!form.yearsInBusiness.trim()) {
        setError(t("onboarding.validationYearsRequired"));
        return false;
      }

      const years = Number(form.yearsInBusiness);

      if (!Number.isFinite(years) || years < 0) {
        setError(t("onboarding.validationYearsInvalid"));
        return false;
      }

      if (!form.defaultTaxRate.trim()) {
        setError(t("onboarding.validationTaxRequired"));
        return false;
      }

      const taxRate = Number(form.defaultTaxRate);

      if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) {
        setError(t("onboarding.validationTaxInvalid"));
        return false;
      }
    }

    if (step === 3 && !form.ownerName.trim()) {
      setError(t("onboarding.validationOwnerRequired"));
      return false;
    }

    setError("");
    return true;
  }

  function handleNext() {
    if (!validateCurrentStep()) {
      return;
    }

    setStep((current) => Math.min(current + 1, 4));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleBack() {
    setError("");
    setStep((current) => Math.max(current - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleFinish() {
    setError("");
    setIsSaving(true);

    try {
      if (!supabase) {
        setError(t("onboarding.errorConnect"));
        return;
      }

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError(t("onboarding.errorLoginRequired"));
        return;
      }

      const addressParts = form.companyAddress
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);

      const addressLine1 = addressParts[0] || null;
      const city = addressParts[1] || null;
      const state = addressParts[2] || null;
      const postalCode = addressParts[3] || null;
      const owner = splitOwnerName(form.ownerName);

      const { error: profileSeedError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            role: "owner",
            first_name: owner.firstName,
            last_name: owner.lastName,
          },
          { onConflict: "id" },
        );

      if (profileSeedError) {
        setError(t("onboarding.errorWorkspaceUpdate", { message: profileSeedError.message }));
        return;
      }

      const { data: existingCompany, error: lookupError } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (lookupError) {
        setError(t("onboarding.errorWorkspaceLookup", { message: lookupError.message }));
        return;
      }

      let companyId = existingCompany?.id || null;
      const companyName = form.companyName.trim();

      const baseCompanyPayload = {
        owner_id: user.id,
        name: companyName,
        email: trimToNull(form.businessEmail),
        phone: trimToNull(form.businessPhone),
        address_line_1: addressLine1,
        address_line_2: null,
        city,
        state,
        postal_code: postalCode,
      } satisfies CompanyUpdate;

      if (existingCompany) {
        const companyUpdateData: CompanyUpdate = {
          ...baseCompanyPayload,
        };

        const { error: updateError } = await supabase
          .from("companies")
          .update(companyUpdateData)
          .eq("id", existingCompany.id);

        if (updateError) {
          setError(t("onboarding.errorWorkspaceUpdate", { message: updateError.message }));
          return;
        }
      } else {
        const companyInsertData: CompanyInsert = {
          ...baseCompanyPayload,
          name: companyName,
        };

        const { data: insertedCompany, error: insertError } = await supabase
          .from("companies")
          .insert(companyInsertData)
          .select("id")
          .single();

        if (insertError) {
          setError(t("onboarding.errorWorkspaceCreate", { message: insertError.message }));
          return;
        }

        companyId = insertedCompany.id;
      }

      if (!companyId) {
        setError(t("onboarding.errorUnexpected"));
        return;
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: user.id,
            company_id: companyId,
            role: "owner",
            first_name: owner.firstName,
            last_name: owner.lastName,
          },
          { onConflict: "id" },
        );

      if (profileError) {
        setError(t("onboarding.errorWorkspaceUpdate", { message: profileError.message }));
        return;
      }

      const { error: userProfileError } = await supabase
        .from("user_profiles")
        .upsert(
          {
            id: user.id,
            user_id: user.id,
            first_name: owner.firstName,
            last_name: owner.lastName,
            display_name: owner.displayName,
            phone: trimToNull(form.businessPhone),
          },
          { onConflict: "id" },
        );

      if (userProfileError) {
        setError(t("onboarding.errorWorkspaceUpdate", { message: userProfileError.message }));
        return;
      }

      const { error: clearPrimaryError } = await supabase
        .from("company_memberships")
        .update({ is_primary: false })
        .eq("user_id", user.id)
        .eq("is_primary", true);

      if (clearPrimaryError) {
        setError(t("onboarding.errorWorkspaceUpdate", { message: clearPrimaryError.message }));
        return;
      }

      const { error: membershipError } = await supabase
        .from("company_memberships")
        .upsert(
          {
            company_id: companyId,
            user_id: user.id,
            role: "owner",
            status: "active",
            is_primary: true,
            joined_at: new Date().toISOString(),
          },
          { onConflict: "company_id,user_id" },
        );

      if (membershipError) {
        setError(t("onboarding.errorWorkspaceUpdate", { message: membershipError.message }));
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch (caughtError) {
      console.error("Onboarding error:", caughtError);
      setError(t("onboarding.errorUnexpected"));
    } finally {
      setIsSaving(false);
    }
  }

  const progressWidth = `${step * 25}%`;

  return (
    <main className="min-h-screen bg-[var(--color-surface-app)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="overflow-hidden rounded-[var(--radius-3xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] shadow-[var(--shadow-large)]">
          <header className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-8 py-10 sm:px-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--color-brand-700)]">{t("onboarding.eyebrow")}</p>
            <h1 className="mt-4 text-4xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-5xl">{t("onboarding.title")}</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--color-text-secondary)]">{t("onboarding.description")}</p>
          </header>

          <section className="px-8 py-8 sm:px-12 sm:py-10">
            <div className="mb-10">
              <div className="flex items-center justify-between gap-4 text-sm font-semibold">
                <span className="text-[var(--color-text-primary)]">{t("onboarding.step", { current: step, total: 4 })}</span>
                <span className="text-right text-[var(--color-text-secondary)]">
                  {step === 1 && t("onboarding.stepCompany")}
                  {step === 2 && t("onboarding.stepBusiness")}
                  {step === 3 && t("onboarding.stepOwner")}
                  {step === 4 && t("onboarding.stepReview")}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--color-surface-muted)]">
                <div
                  className="h-full rounded-full bg-[var(--color-brand-600)] transition-all duration-300"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>

            {step === 1 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("onboarding.companyInfoTitle")}</h2>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{t("onboarding.companyInfoDescription")}</p>
                </div>
                <Field label={t("onboarding.companyName")} value={form.companyName} placeholder="Bango Construction" onChange={(value) => updateField("companyName", value)} required />
                <Field label={t("onboarding.businessEmail")} type="email" value={form.businessEmail} placeholder="office@yourcompany.com" onChange={(value) => updateField("businessEmail", value)} required />
                <Field label={t("onboarding.businessPhone")} type="tel" value={form.businessPhone} placeholder="(614) 555-1234" onChange={(value) => updateField("businessPhone", value)} />
                <Field label={t("onboarding.companyAddress")} value={form.companyAddress} placeholder="123 Main Street, Columbus, Ohio, 43215" helperText={t("onboarding.helperAddress")} onChange={(value) => updateField("companyAddress", value)} />
                <Field label={t("onboarding.website")} type="url" value={form.website} placeholder="https://yourcompany.com" onChange={(value) => updateField("website", value)} />
              </div>
            ) : null}

            {step === 2 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("onboarding.businessDetailsTitle")}</h2>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{t("onboarding.businessDetailsDescription")}</p>
                </div>
                <Field label={t("onboarding.contractorLicense")} value={form.contractorLicense} placeholder={t("onboarding.optional")} onChange={(value) => updateField("contractorLicense", value)} />
                <Field label={t("onboarding.insuranceProvider")} value={form.insuranceProvider} placeholder="Insurance company" onChange={(value) => updateField("insuranceProvider", value)} />
                <Field label={t("onboarding.yearsInBusiness")} type="number" min="0" value={form.yearsInBusiness} placeholder="5" onChange={(value) => updateField("yearsInBusiness", value)} required />
                <Field label={t("onboarding.defaultTaxRate")} type="number" min="0" max="100" step="0.01" value={form.defaultTaxRate} placeholder="7.50" onChange={(value) => updateField("defaultTaxRate", value)} required />
              </div>
            ) : null}

            {step === 3 ? (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("onboarding.ownerTypeTitle")}</h2>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{t("onboarding.ownerTypeDescription")}</p>
                </div>

                <Field label={t("onboarding.ownerName")} value={form.ownerName} placeholder="Angelo Bango" onChange={(value) => updateField("ownerName", value)} required />

                <div>
                  <label className="block text-sm font-semibold text-[var(--color-text-primary)]">{t("onboarding.businessType")}</label>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <BusinessTypeButton label={t("onboarding.residential")} description={t("onboarding.residentialDesc")} selected={form.businessType === "residential"} onClick={() => updateField("businessType", "residential")} />
                    <BusinessTypeButton label={t("onboarding.commercial")} description={t("onboarding.commercialDesc")} selected={form.businessType === "commercial"} onClick={() => updateField("businessType", "commercial")} />
                    <BusinessTypeButton label={t("onboarding.both")} description={t("onboarding.bothDesc")} selected={form.businessType === "both"} onClick={() => updateField("businessType", "both")} />
                  </div>
                </div>
              </div>
            ) : null}

            {step === 4 ? (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{t("onboarding.reviewTitle")}</h2>
                  <p className="mt-2 text-[var(--color-text-secondary)]">{t("onboarding.reviewDescription")}</p>
                </div>

                <ReviewRow label={t("onboarding.reviewCompany")} value={form.companyName} />
                <ReviewRow label={t("onboarding.businessEmail")} value={form.businessEmail} />
                <ReviewRow label={t("onboarding.businessPhone")} value={form.businessPhone} />
                <ReviewRow label={t("onboarding.reviewAddress")} value={form.companyAddress} />
                <ReviewRow label={t("onboarding.website")} value={form.website} />
                <ReviewRow label={t("onboarding.contractorLicense")} value={form.contractorLicense} />
                <ReviewRow label={t("onboarding.insuranceProvider")} value={form.insuranceProvider} />
                <ReviewRow label={t("onboarding.yearsInBusiness")} value={form.yearsInBusiness} />
                <ReviewRow label={t("onboarding.reviewTaxRate")} value={form.defaultTaxRate ? `${form.defaultTaxRate}%` : ""} />
                <ReviewRow label={t("onboarding.reviewOwner")} value={form.ownerName} />
                <ReviewRow label={t("onboarding.reviewBusinessType")} value={formatBusinessType(form.businessType, t)} />
              </div>
            ) : null}

            {error ? (
              <div role="alert" className="mt-6 rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm font-medium text-[var(--color-danger-700)]">
                {error}
              </div>
            ) : null}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
              {step > 1 ? (
                <Button type="button" onClick={handleBack} disabled={isSaving} variant="outline" size="lg" fullWidth>
                  {t("onboarding.back")}
                </Button>
              ) : null}

              {step < 4 ? (
                <Button type="button" onClick={handleNext} size="lg" fullWidth>
                  {t("onboarding.continue")}
                </Button>
              ) : (
                <Button type="button" onClick={handleFinish} disabled={isSaving} size="lg" fullWidth>
                  {isSaving ? t("onboarding.creatingWorkspace") : t("onboarding.createWorkspace")}
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

type FieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  type?: string;
  required?: boolean;
  min?: string;
  max?: string;
  step?: string;
  onChange: (value: string) => void;
};

function Field({
  label,
  value,
  placeholder,
  helperText,
  type = "text",
  required = false,
  min,
  max,
  step,
  onChange,
}: FieldProps) {
  const id = label.toLowerCase().replaceAll(" ", "-").replaceAll("(", "").replaceAll(")", "");

  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-semibold text-[var(--color-text-primary)]"
      >
        {label}

        {required && <span className="ml-1 text-[var(--color-danger-700)]">*</span>}
      </label>

      <Input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
      />

      {helperText && (
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{helperText}</p>
      )}
    </div>
  );
}

type BusinessTypeButtonProps = {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
};

function BusinessTypeButton({
  label,
  description,
  selected,
  onClick,
}: BusinessTypeButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`rounded-[var(--radius-xl)] border px-4 py-4 text-left transition ${
        selected
          ? "border-[var(--color-brand-600)] bg-[var(--color-primary-50)] text-[var(--color-brand-700)] ring-2 ring-[var(--focus-ring-primary)]"
          : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:bg-[var(--color-surface-subtle)]"
      }`}
    >
      <span className="block font-semibold text-[var(--color-text-primary)]">{label}</span>

      <span
        className={`mt-1 block text-sm ${
          selected ? "text-[var(--color-brand-700)]" : "text-[var(--color-text-muted)]"
        }`}
      >
        {description}
      </span>
    </button>
  );
}

function ReviewRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-4 shadow-[var(--shadow-small)] sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-sm font-semibold text-[var(--color-text-secondary)]">{label}</span>

      <span className="break-words font-semibold text-[var(--color-text-primary)] sm:text-right">
        {value || t("onboarding.notProvided")}
      </span>
    </div>
  );
}

function formatBusinessType(type: BusinessType, t: (key: string) => string) {
  if (type === "residential") {
    return t("onboarding.residential");
  }

  if (type === "commercial") {
    return t("onboarding.commercial");
  }

  return t("onboarding.residentialAndCommercial");
}
