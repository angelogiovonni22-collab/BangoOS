"use client";

import type { TaskFormValues, TaskListItem } from "./workspace-types";

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
  phaseName: string | null;
  task: TaskListItem | null;
  formValues: TaskFormValues;
  isSaving: boolean;
  onChange: (field: keyof TaskFormValues, value: string) => void;
  onSave: () => void;
  onDelete: () => void;
  onNewTask: () => void;
};

export function TaskDetailsPanel({
  phaseName,
  task,
  formValues,
  isSaving,
  onChange,
  onSave,
  onDelete,
  onNewTask,
}: TaskDetailsPanelProps) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <p className="text-sm font-medium text-slate-500">Task Details</p>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          {task ? task.title : "No task selected"}
        </h2>
        <p className="mt-1 text-xs text-slate-500">{phaseName ? `${phaseName} phase` : "Select a phase"}</p>
      </div>

      <div className="space-y-5 p-6">
        {task ? (
          <>
            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Name</span>
              <input
                type="text"
                value={formValues.title}
                onChange={(event) => onChange("title", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                disabled={isSaving}
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-semibold text-slate-700">Description</span>
              <textarea
                value={formValues.description}
                onChange={(event) => onChange("description", event.target.value)}
                rows={4}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                disabled={isSaving}
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Status</span>
                <select
                  value={formValues.status}
                  onChange={(event) => onChange("status", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                >
                  {TASK_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Priority</span>
                <select
                  value={formValues.priority}
                  onChange={(event) => onChange("priority", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                >
                  {TASK_PRIORITY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatLabel(option)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Estimated Hours</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={formValues.estimatedHours}
                  onChange={(event) => onChange("estimatedHours", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Actual Hours</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={formValues.actualHours}
                  onChange={(event) => onChange("actualHours", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Planned Start</span>
                <input
                  type="date"
                  value={formValues.plannedStart}
                  onChange={(event) => onChange("plannedStart", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Planned Finish</span>
                <input
                  type="date"
                  value={formValues.plannedFinish}
                  onChange={(event) => onChange("plannedFinish", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Actual Start</span>
                <input
                  type="date"
                  value={formValues.actualStart}
                  onChange={(event) => onChange("actualStart", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm font-semibold text-slate-700">Actual Finish</span>
                <input
                  type="date"
                  value={formValues.actualFinish}
                  onChange={(event) => onChange("actualFinish", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>

              <label className="space-y-2 sm:col-span-2">
                <span className="text-sm font-semibold text-slate-700">Completion Percentage</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formValues.completionPercentage}
                  onChange={(event) => onChange("completionPercentage", event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  disabled={isSaving}
                />
              </label>
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">Select a task</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Pick a task from the center panel to edit details.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={!task || isSaving}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={!task || isSaving}
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete
          </button>

          <button
            type="button"
            onClick={onNewTask}
            disabled={!phaseName || isSaving}
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            New Task
          </button>
        </div>
      </div>
    </section>
  );
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
