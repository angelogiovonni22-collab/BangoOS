"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/provider";

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

export default function OnboardingPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();

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

      if (Number(form.yearsInBusiness) < 0) {
        setError(t("onboarding.validationYearsInvalid"));
        return false;
      }

      if (!form.defaultTaxRate.trim()) {
        setError(t("onboarding.validationTaxRequired"));
        return false;
      }

      const taxRate = Number(form.defaultTaxRate);

      if (taxRate < 0 || taxRate > 100) {
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

      const companyData = {
        owner_id: user.id,
        name: form.companyName.trim(),
        email: form.businessEmail.trim() || null,
        phone: form.businessPhone.trim() || null,
        website: form.website.trim() || null,
        address_line_1: addressLine1,
        city,
        state,
        postal_code: postalCode,
        contractor_license: form.contractorLicense.trim() || null,
        insurance_provider: form.insuranceProvider.trim() || null,
        years_in_business: form.yearsInBusiness
          ? Number(form.yearsInBusiness)
          : null,
        default_tax_rate: form.defaultTaxRate
          ? Number(form.defaultTaxRate)
          : null,
        owner_name: form.ownerName.trim() || null,
        business_type: form.businessType,
      };

      const { data: existingCompany, error: lookupError } = await supabase
        .from("companies")
        .select("id")
        .eq("owner_id", user.id)
        .maybeSingle();

      if (lookupError) {
        setError(t("onboarding.errorWorkspaceLookup", { message: lookupError.message }));
        return;
      }

      if (existingCompany) {
        const { error: updateError } = await supabase
          .from("companies")
          .update(companyData)
          .eq("id", existingCompany.id);

        if (updateError) {
          setError(t("onboarding.errorWorkspaceUpdate", { message: updateError.message }));
          return;
        }
      } else {
        const { error: insertError } = await supabase
          .from("companies")
          .insert(companyData);

        if (insertError) {
          setError(t("onboarding.errorWorkspaceCreate", { message: insertError.message }));
          return;
        }
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
    <main className="min-h-screen bg-slate-100 px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="overflow-hidden rounded-3xl bg-white shadow-xl">
          <header className="bg-slate-950 px-8 py-10 text-white sm:px-12">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">
              {t("onboarding.eyebrow")}
            </p>

            <h1 className="mt-4 text-4xl font-bold sm:text-5xl">
              {t("onboarding.title")}
            </h1>

            <p className="mt-4 max-w-2xl text-lg text-slate-300">
              {t("onboarding.description")}
            </p>
          </header>

          <section className="px-8 py-8 sm:px-12 sm:py-10">
            <div className="mb-10">
              <div className="flex items-center justify-between gap-4 text-sm font-semibold">
                <span className="text-slate-900">{t("onboarding.step", { current: step, total: 4 })}</span>

                <span className="text-right text-slate-500">
                  {step === 1 && t("onboarding.stepCompany")}
                  {step === 2 && t("onboarding.stepBusiness")}
                  {step === 3 && t("onboarding.stepOwner")}
                  {step === 4 && t("onboarding.stepReview")}
                </span>
              </div>

              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-300"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>

            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">{t("onboarding.companyInfoTitle")}</h2>

                  <p className="mt-2 text-slate-600">{t("onboarding.companyInfoDescription")}</p>
                </div>

                <Field
                  label={t("onboarding.companyName")}
                  value={form.companyName}
                  placeholder="Bango Construction"
                  onChange={(value) => updateField("companyName", value)}
                  required
                />

                <Field
                  label={t("onboarding.businessEmail")}
                  type="email"
                  value={form.businessEmail}
                  placeholder="office@yourcompany.com"
                  onChange={(value) => updateField("businessEmail", value)}
                  required
                />

                <Field
                  label={t("onboarding.businessPhone")}
                  type="tel"
                  value={form.businessPhone}
                  placeholder="(614) 555-1234"
                  onChange={(value) => updateField("businessPhone", value)}
                />

                <Field
                  label={t("onboarding.companyAddress")}
                  value={form.companyAddress}
                  placeholder="123 Main Street, Columbus, Ohio, 43215"
                  helperText={t("onboarding.helperAddress")}
                  onChange={(value) => updateField("companyAddress", value)}
                />

                <Field
                  label={t("onboarding.website")}
                  type="url"
                  value={form.website}
                  placeholder="https://yourcompany.com"
                  onChange={(value) => updateField("website", value)}
                />
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">{t("onboarding.businessDetailsTitle")}</h2>

                  <p className="mt-2 text-slate-600">{t("onboarding.businessDetailsDescription")}</p>
                </div>

                <Field
                  label={t("onboarding.contractorLicense")}
                  value={form.contractorLicense}
                  placeholder={t("onboarding.optional")}
                  onChange={(value) => updateField("contractorLicense", value)}
                />

                <Field
                  label={t("onboarding.insuranceProvider")}
                  value={form.insuranceProvider}
                  placeholder="Insurance company"
                  onChange={(value) => updateField("insuranceProvider", value)}
                />

                <Field
                  label={t("onboarding.yearsInBusiness")}
                  type="number"
                  min="0"
                  value={form.yearsInBusiness}
                  placeholder="5"
                  onChange={(value) => updateField("yearsInBusiness", value)}
                  required
                />

                <Field
                  label={t("onboarding.defaultTaxRate")}
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.defaultTaxRate}
                  placeholder="7.50"
                  onChange={(value) => updateField("defaultTaxRate", value)}
                  required
                />
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-950">{t("onboarding.ownerTypeTitle")}</h2>

                  <p className="mt-2 text-slate-600">{t("onboarding.ownerTypeDescription")}</p>
                </div>

                <Field
                  label={t("onboarding.ownerName")}
                  value={form.ownerName}
                  placeholder="Angelo Bango"
                  onChange={(value) => updateField("ownerName", value)}
                  required
                />

                <div>
                  <label className="block text-sm font-semibold text-slate-800">
                    {t("onboarding.businessType")}
                  </label>

                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <BusinessTypeButton
                      label={t("onboarding.residential")}
                      description={t("onboarding.residentialDesc")}
                      selected={form.businessType === "residential"}
                      onClick={() => updateField("businessType", "residential")}
                    />

                    <BusinessTypeButton
                      label={t("onboarding.commercial")}
                      description={t("onboarding.commercialDesc")}
                      selected={form.businessType === "commercial"}
                      onClick={() => updateField("businessType", "commercial")}
                    />

                    <BusinessTypeButton
                      label={t("onboarding.both")}
                      description={t("onboarding.bothDesc")}
                      selected={form.businessType === "both"}
                      onClick={() => updateField("businessType", "both")}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-slate-950">{t("onboarding.reviewTitle")}</h2>

                  <p className="mt-2 text-slate-600">{t("onboarding.reviewDescription")}</p>
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
            )}

            {error && (
              <div
                role="alert"
                className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
              >
                {error}
              </div>
            )}

            <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={isSaving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-6 py-4 text-lg font-bold text-slate-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t("onboarding.back")}
                </button>
              )}

              {step < 4 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200"
                >
                  {t("onboarding.continue")}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={isSaving}
                  className="w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? t("onboarding.creatingWorkspace") : t("onboarding.createWorkspace")}
                </button>
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
        className="block text-sm font-semibold text-slate-800"
      >
        {label}

        {required && <span className="ml-1 text-red-600">*</span>}
      </label>

      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        min={min}
        max={max}
        step={step}
        className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
      />

      {helperText && (
        <p className="mt-2 text-sm text-slate-500">{helperText}</p>
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
      className={`rounded-xl border px-4 py-4 text-left transition ${
        selected
          ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-100"
          : "border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50"
      }`}
    >
      <span className="block font-bold">{label}</span>

      <span
        className={`mt-1 block text-sm ${
          selected ? "text-blue-600" : "text-slate-500"
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
    <div className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <span className="text-sm font-semibold text-slate-500">{label}</span>

      <span className="break-words font-semibold text-slate-900 sm:text-right">
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
