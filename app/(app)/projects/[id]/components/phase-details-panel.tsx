"use client";

import { PhaseProgressBar } from "./phase-progress-bar";
import type { PhaseListItem } from "./workspace-types";

type PhaseDetailsPanelProps = {
  phase: PhaseListItem | null;
  phaseNameInput: string;
  phaseColorInput: string;
  isSaving: boolean;
  saveLabel: string;
  onNameChange: (value: string) => void;
  onColorChange: (value: string) => void;
  onSave: () => void;
  onDelete: () => void;
};

export function PhaseDetailsPanel({
  phase,
  phaseNameInput,
  phaseColorInput,
  isSaving,
  saveLabel,
  onNameChange,
  onColorChange,
  onSave,
  onDelete,
}: PhaseDetailsPanelProps) {
  if (!phase) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Phase Details</h2>
        <p className="mt-2 text-sm text-slate-500">
          Select a phase from the left panel to view and edit details.
        </p>

        <div className="mt-6 flex min-h-56 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm leading-7 text-slate-500">
            This project does not have any phases yet.
          </p>
        </div>
      </section>
    );
  }

  const normalizedProgress = Math.max(0, Math.min(100, Math.round(phase.progress)));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <p className="text-sm font-medium text-slate-500">Selected Phase</p>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{phase.name}</h2>
      </div>

      <div className="space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-2 sm:col-span-2">
            <span className="text-sm font-semibold text-slate-700">Phase Name</span>
            <input
              type="text"
              value={phaseNameInput}
              onChange={(event) => onNameChange(event.target.value)}
              placeholder="Enter phase name"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              disabled={isSaving}
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Color</span>
            <input
              type="color"
              value={phaseColorInput}
              onChange={(event) => onColorChange(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-300 bg-white px-2 py-2"
              disabled={isSaving}
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-semibold text-slate-700">Progress</span>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{normalizedProgress}%</p>
              <div className="mt-2">
                <PhaseProgressBar percentage={normalizedProgress} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700">Description</h3>
          <div className="mt-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm leading-7 text-slate-600">
            Phase descriptions are not stored in the current schema yet. Tasks and notes in this panel will be added in a future release.
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-700">Tasks</h3>
            <button
              type="button"
              disabled
              title="Tasks module coming soon"
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-500 opacity-80"
            >
              Add Task
            </button>
          </div>

          <div className="mt-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">Tasks placeholder</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Task cards and scheduling tools will appear here in the next module.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveLabel}
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Delete Phase
          </button>
        </div>
      </div>
    </section>
  );
}
