"use client";

import type { ReactNode } from "react";
import { StatusPulse } from "@/components/motion";
import type { TaskFormValues } from "./workspace-types";

const TASK_STATUS_OPTIONS = [
  "not_started",
  "ready",
  "in_progress",
  "blocked",
  "on_hold",
  "completed",
  "cancelled",
] as const;

const TASK_PRIORITY_OPTIONS = ["low", "medium", "high", "urgent"] as const;

type TaskDetailsPanelProps = {
  mode: "no_phase" | "no_task" | "task";
  phaseName: string | null;
  taskTitle: string | null;
  isOverdue: boolean;
  formValues: TaskFormValues & {
    assignedProfileId: string;
    notes: string;
  };
  assigneeOptions: Array<{ id: string; label: string }>;
  dependencySummary: {
    blockedByCount: number;
    blockingCount: number;
    isLoading: boolean;
  } | null;
  isSaving: boolean;
  isDirty: boolean;
  validationMessage: string | null;
  feedbackMessage: string | null;
  labels: {
    title: string;
    noTaskSelected: string;
    noPhaseSelectedTitle: string;
    noPhaseSelectedDescription: string;
    selectTaskTitle: string;
    selectTaskDescription: string;
    phaseLabel: string;
    overdueBadge: string;
    dependencyTitle: string;
    dependencyLoading: string;
    blockedByLabel: string;
    blockingLabel: string;
    fieldTitle: string;
    fieldDescription: string;
    fieldStatus: string;
    fieldPriority: string;
    fieldAssignee: string;
    fieldPlannedStart: string;
    fieldPlannedFinish: string;
    fieldActualStart: string;
    fieldActualFinish: string;
    fieldEstimatedHours: string;
    fieldActualHours: string;
    fieldCompletion: string;
    fieldNotes: string;
    save: string;
    saving: string;
    saveSuccess: string;
    close: string;
    statusNotStarted: string;
    statusReady: string;
    statusInProgress: string;
    statusBlocked: string;
    statusOnHold: string;
    statusCompleted: string;
    statusCancelled: string;
    priorityLow: string;
    priorityMedium: string;
    priorityHigh: string;
    priorityUrgent: string;
    assigneeUnassigned: string;
  };
  onChange: (field: keyof (TaskFormValues & { assignedProfileId: string; notes: string }), value: string) => void;
  onSave: () => void;
  onClose?: () => void;
};

export function TaskDetailsPanel({
  mode,
  phaseName,
  taskTitle,
  isOverdue,
  formValues,
  assigneeOptions,
  dependencySummary,
  isSaving,
  isDirty,
  validationMessage,
  feedbackMessage,
  labels,
  onChange,
  onSave,
  onClose,
}: TaskDetailsPanelProps) {
  const isTaskMode = mode === "task";

  if (mode === "no_phase") {
    return (
      <section className="rounded-[16px] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <div className="border-b border-[var(--color-border-subtle)] p-5">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{labels.title}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-navy-900)]">{labels.noTaskSelected}</h2>
        </div>

        <div className="p-5">
          <div className="rounded-[12px] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-6 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{labels.noPhaseSelectedTitle}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{labels.noPhaseSelectedDescription}</p>
          </div>
        </div>
      </section>
    );
  }

  if (mode === "no_task") {
    return (
      <section className="rounded-[16px] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <div className="border-b border-[var(--color-border-subtle)] p-5">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">{labels.title}</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--color-navy-900)]">{labels.noTaskSelected}</h2>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">{labels.phaseLabel}: {phaseName || labels.noTaskSelected}</p>
        </div>

        <div className="p-5">
          <div className="rounded-[12px] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-6 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{labels.selectTaskTitle}</p>
            <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{labels.selectTaskDescription}</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-[16px] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
      <div className="border-b border-[var(--color-border-subtle)] p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-[var(--color-text-secondary)]">{labels.title}</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--color-navy-900)]">{taskTitle || labels.noTaskSelected}</h2>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{labels.phaseLabel}: {phaseName || labels.noTaskSelected}</p>
          </div>

          {isOverdue ? (
            <span className="rounded-full border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-danger-700)]">
              {labels.overdueBadge}
            </span>
          ) : null}
        </div>

        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="mt-3 inline-flex rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] xl:hidden"
          >
            {labels.close}
          </button>
        ) : null}
      </div>

      <div className="space-y-4 p-5">
        {dependencySummary ? (
          <div className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/65 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{labels.dependencyTitle}</p>
            {dependencySummary.isLoading ? (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{labels.dependencyLoading}</p>
            ) : (
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                {labels.blockedByLabel}: {dependencySummary.blockedByCount} | {labels.blockingLabel}: {dependencySummary.blockingCount}
              </p>
            )}
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={labels.fieldTitle}>
            <input
              type="text"
              value={formValues.title}
              onChange={(event) => onChange("title", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldDescription} className="sm:col-span-2">
            <textarea
              rows={3}
              value={formValues.description}
              onChange={(event) => onChange("description", event.target.value)}
              className="w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldAssignee}>
            <select
              value={formValues.assignedProfileId}
              onChange={(event) => onChange("assignedProfileId", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            >
              <option value="">{labels.assigneeUnassigned}</option>
              {assigneeOptions.map((assignee) => (
                <option key={assignee.id} value={assignee.id}>{assignee.label}</option>
              ))}
            </select>
          </Field>

          <Field label={labels.fieldStatus}>
            <select
              value={formValues.status}
              onChange={(event) => onChange("status", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            >
              {TASK_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{statusLabel(option, labels)}</option>
              ))}
            </select>
          </Field>

          <Field label={labels.fieldPriority}>
            <select
              value={formValues.priority}
              onChange={(event) => onChange("priority", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            >
              {TASK_PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{priorityLabel(option, labels)}</option>
              ))}
            </select>
          </Field>

          <Field label={labels.fieldPlannedStart}>
            <input
              type="date"
              value={formValues.plannedStart}
              onChange={(event) => onChange("plannedStart", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldPlannedFinish}>
            <input
              type="date"
              value={formValues.plannedFinish}
              onChange={(event) => onChange("plannedFinish", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldActualStart}>
            <input
              type="date"
              value={formValues.actualStart}
              onChange={(event) => onChange("actualStart", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldActualFinish}>
            <input
              type="date"
              value={formValues.actualFinish}
              onChange={(event) => onChange("actualFinish", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldEstimatedHours}>
            <input
              type="number"
              min="0"
              step="0.25"
              value={formValues.estimatedHours}
              onChange={(event) => onChange("estimatedHours", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldActualHours}>
            <input
              type="number"
              min="0"
              step="0.25"
              value={formValues.actualHours}
              onChange={(event) => onChange("actualHours", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldCompletion} className="sm:col-span-2">
            <input
              type="number"
              min="0"
              max="100"
              value={formValues.completionPercentage}
              onChange={(event) => onChange("completionPercentage", event.target.value)}
              className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>

          <Field label={labels.fieldNotes} className="sm:col-span-2">
            <textarea
              rows={4}
              value={formValues.notes}
              onChange={(event) => onChange("notes", event.target.value)}
              className="w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
              disabled={isSaving || !isTaskMode}
            />
          </Field>
        </div>

        {validationMessage ? (
          <StatusPulse triggerKey={`validation-${validationMessage}`} tone="warning">
            <Message tone="danger" text={validationMessage} />
          </StatusPulse>
        ) : null}
        {feedbackMessage ? (
          <StatusPulse triggerKey={`feedback-${feedbackMessage}`} tone="success">
            <Message tone="success" text={feedbackMessage || labels.saveSuccess} />
          </StatusPulse>
        ) : null}

        <div className="border-t border-[var(--color-border-subtle)] pt-3">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving || !isDirty || !isTaskMode}
            className="inline-flex items-center justify-center rounded-[10px] bg-[var(--color-brand-700)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--shadow-small)] transition hover:bg-[var(--color-brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? labels.saving : labels.save}
          </button>
        </div>
      </div>
    </section>
  );
}

function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={className}>
      <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</span>
      {children}
    </label>
  );
}

function Message({ tone, text }: { tone: "danger" | "success"; text: string }) {
  const className =
    tone === "danger"
      ? "border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
      : "border-[var(--color-success-200)] bg-[var(--color-success-100)] text-[var(--color-success-700)]";

  return <p className={`rounded-[10px] border px-3 py-2 text-sm font-medium ${className}`}>{text}</p>;
}

function statusLabel(status: (typeof TASK_STATUS_OPTIONS)[number], labels: TaskDetailsPanelProps["labels"]) {
  const map: Record<(typeof TASK_STATUS_OPTIONS)[number], string> = {
    not_started: labels.statusNotStarted,
    ready: labels.statusReady,
    in_progress: labels.statusInProgress,
    blocked: labels.statusBlocked,
    on_hold: labels.statusOnHold,
    completed: labels.statusCompleted,
    cancelled: labels.statusCancelled,
  };

  return map[status];
}

function priorityLabel(priority: (typeof TASK_PRIORITY_OPTIONS)[number], labels: TaskDetailsPanelProps["labels"]) {
  const map: Record<(typeof TASK_PRIORITY_OPTIONS)[number], string> = {
    low: labels.priorityLow,
    medium: labels.priorityMedium,
    high: labels.priorityHigh,
    urgent: labels.priorityUrgent,
  };

  return map[priority];
}
