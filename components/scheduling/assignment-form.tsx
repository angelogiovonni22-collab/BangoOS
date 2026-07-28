"use client";

import { useState } from "react";
import { Button, Input, Select } from "@/components/ui";
import type { AssignmentDraft, AssignmentType } from "@/lib/scheduling";

type AssignmentFormProps = {
  projectOptions: Array<{ id: string; name: string }>;
  crewOptions: Array<{ id: string; name: string }>;
  employeeOptions: Array<{ id: string; name: string; trade: string }>;
  tradeOptions: string[];
  onSubmit: (draft: AssignmentDraft) => Promise<void>;
  onCancel: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function AssignmentForm({
  projectOptions,
  crewOptions,
  employeeOptions,
  tradeOptions,
  onSubmit,
  onCancel,
  t,
}: AssignmentFormProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<AssignmentDraft>({
    title: "",
    type: "project_work",
    projectId: projectOptions[0]?.id || "",
    location: "",
    date: new Date().toISOString().slice(0, 10),
    startTime: "07:00",
    endTime: "15:30",
    shift: "day",
    assignedCrewIds: [],
    assignedEmployeeIds: [],
    requiredTrade: tradeOptions[0] || "General Labor",
    requiredHeadcount: 1,
    supervisor: "",
    priority: "medium",
    status: "draft",
    notes: "",
    travelTimeMinutes: 30,
    recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
    equipment: { requiredEquipment: [], assignedEquipment: [], operatorRequired: false },
    safetyRequirement: "",
    certificationRequirement: "",
  });

  const update = <K extends keyof AssignmentDraft>(key: K, value: AssignmentDraft[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!form.title.trim() || !form.projectId || !form.requiredTrade) {
      setError(t("scheduling.validation.required"));
      return;
    }

    if (form.endTime <= form.startTime) {
      setError(t("scheduling.validation.timeOrder"));
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(form);
    } catch {
      setError(t("scheduling.errorSaveAssignment"));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label={t("scheduling.form.title")}>
          <Input value={form.title} onChange={(event) => update("title", event.target.value)} required />
        </Field>

        <Field label={t("scheduling.form.type")}>
          <Select value={form.type} onChange={(event) => update("type", event.target.value as AssignmentType)}>
            <option value="project_work">{t("scheduling.assignmentType.project_work")}</option>
            <option value="crew_mobilization">{t("scheduling.assignmentType.crew_mobilization")}</option>
            <option value="inspection">{t("scheduling.assignmentType.inspection")}</option>
            <option value="delivery">{t("scheduling.assignmentType.delivery")}</option>
            <option value="training">{t("scheduling.assignmentType.training")}</option>
            <option value="toolbox_talk">{t("scheduling.assignmentType.toolbox_talk")}</option>
            <option value="maintenance">{t("scheduling.assignmentType.maintenance")}</option>
            <option value="meeting">{t("scheduling.assignmentType.meeting")}</option>
            <option value="milestone">{t("scheduling.assignmentType.milestone")}</option>
            <option value="time_off">{t("scheduling.assignmentType.time_off")}</option>
            <option value="open_shift">{t("scheduling.assignmentType.open_shift")}</option>
          </Select>
        </Field>

        <Field label={t("scheduling.form.project")}>
          <Select value={form.projectId} onChange={(event) => update("projectId", event.target.value)}>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </Select>
        </Field>

        <Field label={t("scheduling.form.location")}>
          <Input value={form.location} onChange={(event) => update("location", event.target.value)} />
        </Field>

        <Field label={t("scheduling.form.date")}>
          <Input type="date" value={form.date} onChange={(event) => update("date", event.target.value)} />
        </Field>

        <Field label={t("scheduling.form.shift")}>
          <Select value={form.shift} onChange={(event) => update("shift", event.target.value as AssignmentDraft["shift"])}>
            <option value="day">{t("scheduling.shift.day")}</option>
            <option value="swing">{t("scheduling.shift.swing")}</option>
            <option value="night">{t("scheduling.shift.night")}</option>
          </Select>
        </Field>

        <Field label={t("scheduling.form.startTime")}>
          <Input type="time" value={form.startTime} onChange={(event) => update("startTime", event.target.value)} />
        </Field>

        <Field label={t("scheduling.form.endTime")}>
          <Input type="time" value={form.endTime} onChange={(event) => update("endTime", event.target.value)} />
        </Field>

        <Field label={t("scheduling.form.requiredTrade")}>
          <Select value={form.requiredTrade} onChange={(event) => update("requiredTrade", event.target.value)}>
            {tradeOptions.map((trade) => (
              <option key={trade} value={trade}>{trade}</option>
            ))}
          </Select>
        </Field>

        <Field label={t("scheduling.form.requiredHeadcount")}>
          <Input type="number" min={1} value={String(form.requiredHeadcount)} onChange={(event) => update("requiredHeadcount", Number(event.target.value || 1))} />
        </Field>

        <Field label={t("scheduling.form.assignedCrew")}>
          <Select value={form.assignedCrewIds[0] || ""} onChange={(event) => update("assignedCrewIds", event.target.value ? [event.target.value] : [])}>
            <option value="">{t("scheduling.common.none")}</option>
            {crewOptions.map((crew) => (
              <option key={crew.id} value={crew.id}>{crew.name}</option>
            ))}
          </Select>
        </Field>

        <Field label={t("scheduling.form.assignedEmployee")}>
          <Select value={form.assignedEmployeeIds[0] || ""} onChange={(event) => update("assignedEmployeeIds", event.target.value ? [event.target.value] : [])}>
            <option value="">{t("scheduling.common.none")}</option>
            {employeeOptions.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name} - {employee.trade}</option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label={t("scheduling.form.notes")}>
        <textarea
          rows={4}
          className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
          value={form.notes}
          onChange={(event) => update("notes", event.target.value)}
        />
      </Field>

      {error ? (
        <p className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-700)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>{t("scheduling.actions.cancel")}</Button>
        <Button type="button" variant="outline" disabled>{t("scheduling.actions.saveDraft")}</Button>
        <Button type="button" variant="outline" disabled>{t("scheduling.actions.duplicate")}</Button>
        <Button type="submit" disabled={isSaving}>{isSaving ? t("scheduling.actions.saving") : t("scheduling.actions.publish")}</Button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text-primary)]">
      <span>{label}</span>
      {children}
    </label>
  );
}
