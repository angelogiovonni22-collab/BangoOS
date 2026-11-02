"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { Button, FormField, Input, Select } from "@/components/ui";
import type { Employee, EmploymentStatus, AvailabilityStatus, UpsertEmployeeInput } from "@/lib/employees";

type EmployeeFormProps = {
  mode: "create" | "edit";
  initialValue?: Employee;
  supervisorOptions: Array<{ id: string; label: string }>;
  isSaving: boolean;
  onSubmit: (value: UpsertEmployeeInput) => Promise<void>;
  onCancel: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function EmployeeForm({ mode, initialValue, supervisorOptions, isSaving, onSubmit, onCancel, t }: EmployeeFormProps) {
  const [state, setState] = useState(() => ({
    employeeNumber: initialValue?.employeeNumber || "",
    fullName: initialValue?.fullName || "",
    position: initialValue?.positionTitle || "",
    trade: initialValue?.trade || "",
    supervisorProfileId: initialValue?.supervisorProfileId || "",
    phone: initialValue?.phone || "",
    email: initialValue?.email || "",
    employmentStatus: initialValue?.employmentStatus || "active" as EmploymentStatus,
    availabilityStatus: initialValue?.availabilityStatus || "available" as AvailabilityStatus,
    hiredOn: initialValue?.hireDate || "",
    terminationDate: initialValue?.terminationDate || "",
    notes: initialValue?.notes || "",
  }));
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const update = <K extends keyof typeof state>(key: K, value: typeof state[K]) => {
    setState((current) => ({ ...current, [key]: value }));
    setErrorMessage(null);
  };
  const requiredMissing = !state.employeeNumber.trim() || !state.fullName.trim() || !state.position.trim()
    || !state.hiredOn || (state.employmentStatus === "terminated" && !state.terminationDate);
  const supervisor = supervisorOptions.find((option) => option.id === state.supervisorProfileId);
  const unavailableSupervisor = state.supervisorProfileId && !supervisor;

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSaving) return;
    if (requiredMissing) { setErrorMessage(t("employees.validation.required")); return; }
    if (state.email && !state.email.includes("@")) { setErrorMessage(t("employees.validation.email")); return; }
    try {
      await onSubmit({
        employeeNumber: state.employeeNumber.trim(), fullName: state.fullName.trim(),
        position: state.position.trim(), trade: state.trade.trim(),
        supervisorProfileId: state.supervisorProfileId || null,
        supervisor: supervisor?.label || initialValue?.supervisorName || "",
        phone: state.phone.trim(), email: state.email.trim().toLowerCase(),
        employmentStatus: state.employmentStatus, availabilityStatus: state.availabilityStatus,
        hiredOn: state.hiredOn, terminationDate: state.employmentStatus === "terminated" ? state.terminationDate : null,
        notes: state.notes.trim(),
        // Memberships and assignments retain their canonical workflows.
        crew: initialValue?.primaryCrewName || "", currentAssignment: null, activeToday: false,
        birthDate: "", address: "", emergencyContact: { name: "", relationship: "", phone: "" },
        certifications: [], skills: [], assignedProjects: [], employmentHistory: [],
      });
    } catch {
      setErrorMessage(t("employees.errorSave"));
    }
  };
  const panel = "rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]";
  return <form className="space-y-6" onSubmit={handleSubmit}>
    <section className={panel}>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.personalSection")}</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("employees.form.recordDescription")}</p>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label={t("employees.form.employeeNumber")} required>
          <Input required value={state.employeeNumber} readOnly={mode === "edit"} onChange={(e) => update("employeeNumber", e.target.value)} />
        </Field>
        <Field label={t("employees.form.fullName")} required>
          <Input required maxLength={200} value={state.fullName} onChange={(e) => update("fullName", e.target.value)} />
        </Field>
        <Field label={t("employees.form.position")} required>
          <Input required value={state.position} onChange={(e) => update("position", e.target.value)} />
        </Field>
        <Field label={t("employees.form.trade")}>
          <Input value={state.trade} onChange={(e) => update("trade", e.target.value)} />
        </Field>
        <Field label={t("employees.form.supervisor")}>
          <Select value={state.supervisorProfileId} onChange={(e) => update("supervisorProfileId", e.target.value)}>
            <option value="">{t("employees.form.noSupervisor")}</option>
            {unavailableSupervisor ? <option value={state.supervisorProfileId} disabled translate="no" data-no-auto-translate>{initialValue?.supervisorName || t("employees.form.retainedSupervisor")}</option> : null}
            {supervisorOptions.map((option) => <option key={option.id} value={option.id} translate="no" data-no-auto-translate>{option.label}</option>)}
          </Select>
        </Field>
        <Field label={t("employees.form.hiredOn")} required>
          <Input required type="date" value={state.hiredOn} onChange={(e) => update("hiredOn", e.target.value)} />
        </Field>
      </div>
    </section>
    <section className={panel}>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.contactSection")}</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <Field label={t("employees.form.phone")}><Input maxLength={64} type="tel" value={state.phone} onChange={(e) => update("phone", e.target.value)} /></Field>
        <Field label={t("employees.form.email")}><Input maxLength={320} type="email" value={state.email} onChange={(e) => update("email", e.target.value)} /></Field>
        <Field label={t("employees.form.employmentStatus")}>
          <Select value={state.employmentStatus} onChange={(e) => update("employmentStatus", e.target.value as EmploymentStatus)}>
            {(["active", "leave", "inactive", "terminated"] as const).map((status) => <option key={status} value={status}>{t("employees.recordStatus." + status)}</option>)}
          </Select>
        </Field>
        <Field label={t("employees.form.availabilityStatus")}>
          <Select value={state.availabilityStatus} onChange={(e) => update("availabilityStatus", e.target.value as AvailabilityStatus)}>
            {(["available", "assigned", "unavailable", "restricted", "unknown"] as const).map((status) => <option key={status} value={status}>{t("employees.recordAvailability." + status)}</option>)}
          </Select>
        </Field>
        {state.employmentStatus === "terminated" ? <Field label={t("employees.form.terminationDate")} required><Input required type="date" value={state.terminationDate} onChange={(e) => update("terminationDate", e.target.value)} /></Field> : null}
      </div>
    </section>
    <section className={panel}>
      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("employees.form.crew")}</h2>
      <p className="mt-3 font-medium text-[var(--color-text-primary)]" translate="no" data-no-auto-translate>{initialValue?.primaryCrewName || t("employees.form.noCrew")}</p>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("employees.form.membershipHelp")}</p>
      <Link href="/crews" className="mt-3 inline-block text-sm font-semibold text-[var(--color-text-primary)] underline">{t("employees.form.manageMemberships")}</Link>
      <p className="mt-4 text-sm text-[var(--color-text-secondary)]">{t("employees.form.plannedFeatures")}</p>
    </section>
    <section className={panel}>
      <Field label={t("employees.profile.notes")}>
        <textarea value={state.notes} onChange={(e) => update("notes", e.target.value)} rows={5} className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)]" />
      </Field>
    </section>
    {errorMessage ? <div role="alert" className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">{errorMessage}</div> : null}
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSaving}>{t("employees.actions.cancel")}</Button>
      <Button type="submit" size="lg" disabled={isSaving || requiredMissing}>{isSaving ? t("employees.actions.saving") : mode === "create" ? t("employees.actions.create") : t("employees.actions.save")}</Button>
    </div>
  </form>;
}

function Field({ children, label, required = false }: { children: ReactNode; label: string; required?: boolean }) {
  return <FormField label={label} required={required}>{children}</FormField>;
}
