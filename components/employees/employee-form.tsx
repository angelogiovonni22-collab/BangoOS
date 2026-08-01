"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button, Input, Select } from "@/components/ui";
import { EmployeeAvatar } from "./employee-avatar";
import { CameraIcon, UploadIcon } from "./employee-icons";
import type {
  AvailabilityStatus,
  Employee,
  EmploymentStatus,
  UpsertEmployeeInput,
} from "@/lib/employees";

type EmployeeFormProps = {
  mode: "create" | "edit";
  initialValue?: Employee;
  crewOptions: string[];
  isSaving: boolean;
  onSubmit: (value: UpsertEmployeeInput) => Promise<void>;
  onCancel: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type EmployeeFormState = {
  fullName: string;
  position: string;
  crew: string;
  supervisor: string;
  phone: string;
  email: string;
  employmentStatus: EmploymentStatus;
  availabilityStatus: AvailabilityStatus;
  currentAssignment: string;
  activeToday: boolean;
  hiredOn: string;
  birthDate: string;
  address: string;
  emergencyName: string;
  emergencyRelationship: string;
  emergencyPhone: string;
  certificationsText: string;
  skillsText: string;
  notes: string;
};

export function EmployeeForm({
  mode,
  initialValue,
  crewOptions,
  isSaving,
  onSubmit,
  onCancel,
  t,
}: EmployeeFormProps) {
  const [state, setState] = useState<EmployeeFormState>(() => ({
    fullName: initialValue?.fullName || "",
    position: initialValue?.position || "",
    crew: initialValue?.crew || crewOptions[0] || "",
    supervisor: initialValue?.supervisor || "",
    phone: initialValue?.phone || "",
    email: initialValue?.email || "",
    employmentStatus: initialValue?.employmentStatus || "active",
    availabilityStatus: initialValue?.availabilityStatus || "available",
    currentAssignment: initialValue?.currentAssignment || "",
    activeToday: initialValue?.activeToday || false,
    hiredOn: initialValue?.hiredOn || "",
    birthDate: initialValue?.birthDate || "",
    address: initialValue?.address || "",
    emergencyName: initialValue?.emergencyContact?.name || "",
    emergencyRelationship: initialValue?.emergencyContact?.relationship || "",
    emergencyPhone: initialValue?.emergencyContact?.phone || "",
    certificationsText: (initialValue?.certifications || []).map((item) => item.name).join(", "),
    skillsText: (initialValue?.skills || []).join(", "),
    notes: initialValue?.notes || "",
  }));
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialValue?.avatarUrl || null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isDisabled = isSaving;

  const requiredMissing = useMemo(
    () => (
      !state.fullName.trim()
      || !state.position.trim()
      || !state.crew.trim()
      || !state.supervisor.trim()
      || !state.phone.trim()
      || !state.email.trim()
      || !state.hiredOn.trim()
    ),
    [state],
  );

  const updateField = <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => {
    setState((current) => ({ ...current, [field]: value }));

    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const handleAvatarSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatarPreview(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (requiredMissing) {
      setErrorMessage(t("employees.validation.required"));
      return;
    }

    if (!state.email.includes("@")) {
      setErrorMessage(t("employees.validation.email"));
      return;
    }

    const skills = state.skillsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const certifications = state.certificationsText
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((name, index) => ({
        id: `cert-manual-${index}`,
        name,
        issuer: t("employees.form.manualEntry"),
        expiresAt: null,
      }));

    try {
      await onSubmit({
        fullName: state.fullName.trim(),
        position: state.position.trim(),
        crew: state.crew.trim(),
        supervisor: state.supervisor.trim(),
        phone: state.phone.trim(),
        email: state.email.trim().toLowerCase(),
        employmentStatus: state.employmentStatus,
        availabilityStatus: state.availabilityStatus,
        currentAssignment: state.currentAssignment.trim() || null,
        activeToday: state.activeToday,
        hiredOn: state.hiredOn,
        birthDate: state.birthDate,
        address: state.address.trim(),
        emergencyContact: {
          name: state.emergencyName.trim(),
          relationship: state.emergencyRelationship.trim(),
          phone: state.emergencyPhone.trim(),
        },
        certifications,
        skills,
        assignedProjects: initialValue?.assignedProjects || [],
        employmentHistory: initialValue?.employmentHistory || [],
        notes: state.notes.trim(),
        avatarUrl: avatarPreview,
      });
    } catch {
      setErrorMessage(t("employees.errorSave"));
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="grid gap-6 xl:grid-cols-[1.3fr_.7fr]">
        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.personalSection")}</h2>
          <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.form.personalSectionDescription")}</p>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label={t("employees.form.fullName")} required>
              <Input value={state.fullName} onChange={(event) => updateField("fullName", event.target.value)} required />
            </Field>
            <Field label={t("employees.form.position")} required>
              <Input value={state.position} onChange={(event) => updateField("position", event.target.value)} required />
            </Field>
            <Field label={t("employees.form.crew")} required>
              <Select value={state.crew} onChange={(event) => updateField("crew", event.target.value)} required>
                {crewOptions.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("employees.form.supervisor")} required>
              <Input value={state.supervisor} onChange={(event) => updateField("supervisor", event.target.value)} required />
            </Field>
            <Field label={t("employees.form.hiredOn")} required>
              <Input type="date" value={state.hiredOn} onChange={(event) => updateField("hiredOn", event.target.value)} required />
            </Field>
            <Field label={t("employees.form.birthDate")}>
              <Input type="date" value={state.birthDate} onChange={(event) => updateField("birthDate", event.target.value)} />
            </Field>
            <Field label={t("employees.form.address")} className="md:col-span-2">
              <Input value={state.address} onChange={(event) => updateField("address", event.target.value)} />
            </Field>
          </div>
        </section>

        <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
            <CameraIcon className="h-5 w-5" />
            {t("employees.form.photoSection")}
          </h2>
          <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.form.photoDescription")}</p>

          <div className="mt-5 flex flex-col items-center gap-4 rounded-[var(--radius-xl)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-subtle)] p-5 text-center">
            <EmployeeAvatar fullName={state.fullName || "Employee"} avatarUrl={avatarPreview} size="xl" />
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-700)]">
              <UploadIcon className="h-4 w-4" />
              {t("employees.form.uploadPhoto")}
              <input type="file" accept="image/*" className="sr-only" onChange={handleAvatarSelection} />
            </label>
            <p className="text-xs font-medium text-[var(--color-text-secondary)]">{t("employees.form.photoHint")}</p>
          </div>
        </section>
      </div>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.contactSection")}</h2>
        <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.form.contactSectionDescription")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={t("employees.form.phone")} required>
            <Input value={state.phone} onChange={(event) => updateField("phone", event.target.value)} required />
          </Field>
          <Field label={t("employees.form.email")} required>
            <Input type="email" value={state.email} onChange={(event) => updateField("email", event.target.value)} required />
          </Field>
          <Field label={t("employees.form.employmentStatus")}
          >
            <Select value={state.employmentStatus} onChange={(event) => updateField("employmentStatus", event.target.value as EmploymentStatus)}>
              <option value="active">{t("employees.employmentStatus.active")}</option>
              <option value="on_leave">{t("employees.employmentStatus.on_leave")}</option>
              <option value="inactive">{t("employees.employmentStatus.inactive")}</option>
            </Select>
          </Field>
          <Field label={t("employees.form.availabilityStatus")}
          >
            <Select value={state.availabilityStatus} onChange={(event) => updateField("availabilityStatus", event.target.value as AvailabilityStatus)}>
              <option value="available">{t("employees.availabilityStatus.available")}</option>
              <option value="assigned">{t("employees.availabilityStatus.assigned")}</option>
              <option value="off_shift">{t("employees.availabilityStatus.off_shift")}</option>
            </Select>
          </Field>
          <Field label={t("employees.form.currentAssignment")}>
            <Input
              value={state.currentAssignment}
              onChange={(event) => updateField("currentAssignment", event.target.value)}
              placeholder={t("employees.form.currentAssignmentPlaceholder")}
              className="placeholder:text-[var(--color-text-secondary)]"
            />
          </Field>
          <Field label={t("employees.form.activeToday")}
          >
            <label className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={state.activeToday}
                onChange={(event) => updateField("activeToday", event.target.checked)}
                className="h-4 w-4 rounded border-[var(--color-border-strong)]"
              />
              {t("employees.form.activeTodayLabel")}
            </label>
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.emergencySection")}</h2>
        <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.form.emergencySectionDescription")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <Field label={t("employees.form.emergencyName")}>
            <Input value={state.emergencyName} onChange={(event) => updateField("emergencyName", event.target.value)} />
          </Field>
          <Field label={t("employees.form.emergencyRelationship")}>
            <Input value={state.emergencyRelationship} onChange={(event) => updateField("emergencyRelationship", event.target.value)} />
          </Field>
          <Field label={t("employees.form.emergencyPhone")}>
            <Input value={state.emergencyPhone} onChange={(event) => updateField("emergencyPhone", event.target.value)} />
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.skillsAndCertifications")}</h2>
        <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("employees.form.skillsSectionDescription")}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label={t("employees.form.certifications")}>
            <Input
              value={state.certificationsText}
              onChange={(event) => updateField("certificationsText", event.target.value)}
              placeholder={t("employees.form.commaSeparated")}
              className="placeholder:text-[var(--color-text-secondary)]"
            />
          </Field>
          <Field label={t("employees.form.skills")}>
            <Input
              value={state.skillsText}
              onChange={(event) => updateField("skillsText", event.target.value)}
              placeholder={t("employees.form.commaSeparated")}
              className="placeholder:text-[var(--color-text-secondary)]"
            />
          </Field>
        </div>

        <Field label={t("employees.profile.notes")} className="mt-4">
          <textarea
            value={state.notes}
            onChange={(event) => updateField("notes", event.target.value)}
            rows={5}
            className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
          />
        </Field>
      </section>

      {errorMessage ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isDisabled}>
          {t("employees.actions.cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={isDisabled || requiredMissing}>
          {isSaving ? t("employees.actions.saving") : mode === "create" ? t("employees.actions.create") : t("employees.actions.save")}
        </Button>
      </div>
    </form>
  );
}

function Field({
  children,
  label,
  required = false,
  className = "",
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`space-y-2 ${className}`}>
      <span className="text-sm font-semibold text-[var(--color-text-primary)]">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}
