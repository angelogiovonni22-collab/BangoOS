"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, FormField, Input, Select } from "@/components/ui";
import { useScheduling, type AssignmentDraft } from "@/lib/scheduling";

type CrewProjectAssignmentPanelProps = {
  crewId: string;
  crewName: string;
  activeMemberCount: number;
  supervisorName: string | null;
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CrewProjectAssignmentPanel({
  crewId,
  crewName,
  activeMemberCount,
  supervisorName,
}: CrewProjectAssignmentPanelProps) {
  const { payload, isLoading, errorMessage, createNewAssignment } = useScheduling();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [date, setDate] = useState(todayIso());
  const [shift, setShift] = useState<AssignmentDraft["shift"]>("day");
  const [startTime, setStartTime] = useState("07:00");
  const [endTime, setEndTime] = useState("15:30");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const projectOptions = payload?.projectOptions ?? [];
  const selectedProject = useMemo(
    () => projectOptions.find((project) => project.id === projectId) ?? null,
    [projectId, projectOptions],
  );

  const handleOpen = () => {
    setOpen(true);
    setLocalError(null);
    setSuccess(null);
    if (!projectId && projectOptions[0]?.id) {
      setProjectId(projectOptions[0].id);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    setSuccess(null);

    if (!projectId) {
      setLocalError("Select a project before assigning this crew.");
      return;
    }
    if (!date) {
      setLocalError("Select an assignment date.");
      return;
    }
    if (endTime <= startTime && shift !== "night") {
      setLocalError("End time must be after start time.");
      return;
    }

    const projectName = selectedProject?.name || "Project";
    const trade = payload?.tradeOptions[0] || "General Labor";
    const draft: AssignmentDraft = {
      title: `${crewName} - ${projectName}`,
      type: "project_work",
      projectId,
      location: "",
      date,
      startTime,
      endTime,
      shift,
      assignedCrewIds: [crewId],
      assignedEmployeeIds: [],
      requiredTrade: trade,
      requiredHeadcount: Math.max(1, activeMemberCount),
      supervisor: supervisorName || "",
      priority: "medium",
      status: "published",
      notes,
      travelTimeMinutes: 30,
      recurrence: { enabled: false, frequency: "weekly", interval: 1, endDate: null },
      equipment: { requiredEquipment: [], assignedEquipment: [], operatorRequired: false },
      safetyRequirement: "",
      certificationRequirement: "",
    };

    setSaving(true);
    try {
      const saved = await createNewAssignment(draft);
      if (!saved) {
        setLocalError("B.O.S. could not assign this crew. Check for a scheduling conflict and try again.");
        return;
      }
      setSuccess(`${crewName} is assigned to ${projectName} on ${date}.`);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-5 shadow-[var(--shadow-small)]">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Project Assignment</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Assign this crew to a project. The assignment is shared with Schedule and Dispatch Center.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={handleOpen} disabled={isLoading || projectOptions.length === 0}>
            Assign to Project
          </Button>
          <Link
            href={`/schedule?crew=${encodeURIComponent(crewId)}`}
            className="inline-flex h-10 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-brand-700)] transition hover:bg-[var(--color-surface-subtle)]"
          >
            View Schedule
          </Link>
        </div>
      </div>

      {projectOptions.length === 0 && !isLoading ? (
        <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2 text-sm text-[var(--color-warning-800)]">
          No projects are available to assign.
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-700)]">
          Scheduling data could not be loaded.
        </p>
      ) : null}

      {success ? (
        <p className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-3 py-2 text-sm font-medium text-[var(--color-success-800)]">
          {success}
        </p>
      ) : null}

      {open ? (
        <form onSubmit={handleSubmit} className="mt-5 space-y-4 border-t border-[var(--color-border-subtle)] pt-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FormField label="Project">
              <Select value={projectId} onChange={(event) => setProjectId(event.target.value)} required>
                <option value="">Select project</option>
                {projectOptions.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Assignment date">
              <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </FormField>
            <FormField label="Shift">
              <Select value={shift} onChange={(event) => setShift(event.target.value as AssignmentDraft["shift"])}>
                <option value="day">Day</option>
                <option value="swing">Swing</option>
                <option value="night">Night</option>
              </Select>
            </FormField>
            <FormField label="Start time">
              <Input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} required />
            </FormField>
            <FormField label="End time">
              <Input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} required />
            </FormField>
            <FormField label="Crew">
              <Input value={crewName} readOnly />
            </FormField>
          </div>

          <FormField label="Assignment notes">
            <textarea
              rows={3}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional instructions, scope, meeting point, or other crew notes"
              className="w-full rounded-[var(--radius-lg)] border border-[var(--color-border-strong)] bg-[var(--color-surface-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]"
            />
          </FormField>

          {localError ? (
            <p className="rounded-[var(--radius-md)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-sm text-[var(--color-danger-700)]">
              {localError}
            </p>
          ) : null}

          <p className="text-xs text-[var(--color-text-secondary)]">
            B.O.S. checks this crew for overlapping active assignments before saving. Conflicting assignments are blocked.
          </p>

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Assigning..." : "Assign Crew"}</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
