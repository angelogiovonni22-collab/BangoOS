"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Button, Input, Select } from "@/components/ui";
import type {
  Crew,
  CrewAvailabilityStatus,
  CrewEmployeeOption,
  CrewMember,
  CrewStatus,
  UpsertCrewInput,
} from "@/lib/crews";
import { AlertTriangle, Plus, Users, Wrench } from "./crew-icons";

type CrewFormProps = {
  mode: "create" | "edit";
  initialValue?: Crew;
  employeeOptions: CrewEmployeeOption[];
  specialtyOptions: string[];
  projectOptions: string[];
  isSaving: boolean;
  onSubmit: (value: UpsertCrewInput) => Promise<void>;
  onCancel: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

type CrewFormState = {
  name: string;
  code: string;
  lead: string;
  supervisor: string;
  primarySpecialty: string;
  secondarySpecialties: string;
  status: CrewStatus;
  availability: CrewAvailabilityStatus;
  homeLocation: string;
  currentProject: string;
  notes: string;
};

export function CrewForm({
  mode,
  initialValue,
  employeeOptions,
  specialtyOptions,
  projectOptions,
  isSaving,
  onSubmit,
  onCancel,
  t,
}: CrewFormProps) {
  const [state, setState] = useState<CrewFormState>(() => ({
    name: initialValue?.name || "",
    code: initialValue?.code || "",
    lead: initialValue?.lead || "",
    supervisor: initialValue?.supervisor || "",
    primarySpecialty: initialValue?.primarySpecialty || specialtyOptions[0] || "",
    secondarySpecialties: (initialValue?.secondarySpecialties || []).join(", "),
    status: initialValue?.status || "active",
    availability: initialValue?.availability || "available",
    homeLocation: initialValue?.homeLocation || "",
    currentProject: initialValue?.currentProject || "",
    notes: initialValue?.notes || "",
  }));
  const [members, setMembers] = useState<CrewMember[]>(initialValue?.members || []);
  const [pickerId, setPickerId] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const requiredMissing = useMemo(
    () => !state.name.trim() || !state.code.trim() || !state.lead.trim() || !state.supervisor.trim() || !state.primarySpecialty.trim(),
    [state],
  );

  const selectedIds = useMemo(() => new Set(members.map((member) => member.employeeId)), [members]);

  const updateField = <K extends keyof CrewFormState>(field: K, value: CrewFormState[K]) => {
    setState((current) => ({ ...current, [field]: value }));
    if (errorMessage) {
      setErrorMessage(null);
    }
  };

  const addMember = () => {
    const employee = employeeOptions.find((item) => item.employeeId === pickerId);

    if (!employee) {
      return;
    }

    if (selectedIds.has(employee.employeeId)) {
      setErrorMessage(t("crews.validation.duplicateMember"));
      return;
    }

    setMembers((current) => [
      ...current,
      {
        employeeId: employee.employeeId,
        fullName: employee.fullName,
        role: "Crew Member",
        position: employee.position,
        employmentStatus: employee.employmentStatus,
        availabilityStatus: employee.availabilityStatus,
        assignedCrewId: employee.assignedCrewId || null,
        primaryCrew: current.length === 0,
        joinedOn: new Date().toISOString().slice(0, 10),
      },
    ]);

    if (!state.lead.trim()) {
      updateField("lead", employee.fullName);
    }

    setPickerId("");
  };

  const removeMember = (employeeId: string) => {
    setMembers((current) => {
      const next = current.filter((member) => member.employeeId !== employeeId);

      if (!next.some((member) => member.primaryCrew) && next[0]) {
        next[0] = { ...next[0], primaryCrew: true };
      }

      return next;
    });
  };

  const makePrimary = (employeeId: string) => {
    setMembers((current) => current.map((member) => ({ ...member, primaryCrew: member.employeeId === employeeId })));
  };

  const setRole = (employeeId: string, role: string) => {
    setMembers((current) => current.map((member) => (member.employeeId === employeeId ? { ...member, role } : member)));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    if (requiredMissing) {
      setErrorMessage(t("crews.validation.required"));
      return;
    }

    const normalizedMembers = members.map((member) => ({
      ...member,
      primaryCrew: member.primaryCrew,
    }));

    try {
      await onSubmit({
        name: state.name.trim(),
        code: state.code.trim().toUpperCase(),
        lead: state.lead.trim(),
        supervisor: state.supervisor.trim(),
        status: state.status,
        availability: state.availability,
        primarySpecialty: state.primarySpecialty.trim(),
        secondarySpecialties: state.secondarySpecialties.split(",").map((item) => item.trim()).filter(Boolean),
        homeLocation: state.homeLocation.trim(),
        currentProject: state.currentProject.trim() || null,
        notes: state.notes.trim(),
        members: normalizedMembers,
      });
    } catch {
      setErrorMessage(t("crews.errorSave"));
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("crews.form.crewDetails")}</h2>
        <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("crews.form.crewDetailsDescription")}</p>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label={t("crews.form.name")} required>
            <Input value={state.name} onChange={(event) => updateField("name", event.target.value)} required />
          </Field>
          <Field label={t("crews.form.code")} required>
            <Input value={state.code} onChange={(event) => updateField("code", event.target.value)} required />
          </Field>
          <Field label={t("crews.form.lead")} required>
            <Input value={state.lead} onChange={(event) => updateField("lead", event.target.value)} required />
          </Field>
          <Field label={t("crews.form.supervisor")} required>
            <Input value={state.supervisor} onChange={(event) => updateField("supervisor", event.target.value)} required />
          </Field>
          <Field label={t("crews.form.primarySpecialty")} required>
            <Select value={state.primarySpecialty} onChange={(event) => updateField("primarySpecialty", event.target.value)} required>
              {specialtyOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("crews.form.secondarySpecialties")}>
            <Input value={state.secondarySpecialties} onChange={(event) => updateField("secondarySpecialties", event.target.value)} placeholder={t("crews.form.commaSeparated")} />
          </Field>
          <Field label={t("crews.form.status")}>
            <Select value={state.status} onChange={(event) => updateField("status", event.target.value as CrewStatus)}>
              <option value="active">{t("crews.status.active")}</option>
              <option value="standby">{t("crews.status.standby")}</option>
              <option value="inactive">{t("crews.status.inactive")}</option>
            </Select>
          </Field>
          <Field label={t("crews.form.availability")}>
            <Select value={state.availability} onChange={(event) => updateField("availability", event.target.value as CrewAvailabilityStatus)}>
              <option value="available">{t("crews.availability.available")}</option>
              <option value="assigned">{t("crews.availability.assigned")}</option>
              <option value="off_shift">{t("crews.availability.off_shift")}</option>
              <option value="pto">{t("crews.availability.pto")}</option>
              <option value="training">{t("crews.availability.training")}</option>
              <option value="unavailable">{t("crews.availability.unavailable")}</option>
            </Select>
          </Field>
          <Field label={t("crews.form.homeLocation")}>
            <Input value={state.homeLocation} onChange={(event) => updateField("homeLocation", event.target.value)} />
          </Field>
          <Field label={t("crews.form.currentProject")} className="xl:col-span-2">
            <Select value={state.currentProject} onChange={(event) => updateField("currentProject", event.target.value)}>
              <option value="">{t("crews.unassigned")}</option>
              {projectOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </Select>
          </Field>
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <Users className="h-5 w-5" />
          {t("crews.form.memberManagement")}
        </h2>
        <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{t("crews.form.memberManagementDescription")}</p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Select value={pickerId} onChange={(event) => setPickerId(event.target.value)} className="sm:flex-1" aria-label={t("crews.form.addMember")}
          >
            <option value="">{t("crews.form.selectEmployee")}</option>
            {employeeOptions.map((employee) => (
              <option key={employee.employeeId} value={employee.employeeId}>
                {employee.fullName} - {employee.position}
              </option>
            ))}
          </Select>
          <Button type="button" onClick={addMember} disabled={!pickerId}>
            <Plus className="mr-1 h-4 w-4" />
            {t("crews.form.addMember")}
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {members.length === 0 ? (
            <p className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] p-4 text-sm font-medium text-[var(--color-text-secondary)]">
              {t("crews.empty.noMembers")}
            </p>
          ) : (
            members.map((member) => (
              <article key={member.employeeId} className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-semibold text-[var(--color-text-primary)]">{member.fullName}</p>
                    <p className="text-sm font-medium text-[var(--color-text-secondary)]">{member.position}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(`employees.employmentStatus.${member.employmentStatus}`)} - {t(`employees.availabilityStatus.${member.availabilityStatus}`)}</p>
                    {member.assignedCrewId && member.assignedCrewId !== initialValue?.id ? (
                      <p className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[var(--color-warning-700)]">
                        <AlertTriangle className="h-3 w-3" />
                        {t("crews.form.memberAssignedElsewhere")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      value={member.role}
                      onChange={(event) => setRole(member.employeeId, event.target.value)}
                      className="h-9 w-40"
                      aria-label={t("crews.form.memberRole")}
                    />
                    <Button type="button" variant={member.primaryCrew ? "primary" : "outline"} size="sm" onClick={() => makePrimary(member.employeeId)}>
                      {member.primaryCrew ? t("crews.profile.primaryCrew") : t("crews.form.makePrimary")}
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => removeMember(member.employeeId)}>
                      {t("crews.actions.remove")}
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-6 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--color-text-primary)]">
          <Wrench className="h-5 w-5" />
          {t("crews.form.notes")}
        </h2>
        <textarea
          value={state.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={4}
          className="mt-4 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-4 py-3 text-sm text-[var(--color-text-primary)] outline-none transition placeholder:text-[var(--color-text-secondary)] focus-visible:border-[var(--color-brand-500)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]"
          placeholder={t("crews.form.notesPlaceholder")}
        />
      </section>

      {errorMessage ? (
        <p className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-3 text-sm text-[var(--color-danger-700)]">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSaving}>
          {t("crews.actions.cancel")}
        </Button>
        <Button type="submit" size="lg" disabled={isSaving || requiredMissing}>
          {isSaving ? t("crews.actions.saving") : mode === "create" ? t("crews.actions.create") : t("crews.actions.save")}
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
