"use client";

import { useState } from "react";
import { PhaseProgressBar } from "./phase-progress-bar";
import type { PhaseListItem } from "./workspace-types";

type ProjectPhasesSidebarProps = {
  overallProgress: number;
  phases: PhaseListItem[];
  selectedPhaseId: string | null;
  phaseNameInput: string;
  phaseColorInput: string;
  isSaving: boolean;
  onAddPhase: () => void;
  onSelectPhase: (phaseId: string) => void;
  onPhaseNameChange: (value: string) => void;
  onPhaseColorChange: (value: string) => void;
  onSavePhase: () => void;
  onDeletePhase: () => void;
  onReorderPhases: (draggedPhaseId: string, targetPhaseId: string) => void;
};

export function ProjectPhasesSidebar({
  overallProgress,
  phases,
  selectedPhaseId,
  phaseNameInput,
  phaseColorInput,
  isSaving,
  onAddPhase,
  onSelectPhase,
  onPhaseNameChange,
  onPhaseColorChange,
  onSavePhase,
  onDeletePhase,
  onReorderPhases,
}: ProjectPhasesSidebarProps) {
  const [draggedPhaseId, setDraggedPhaseId] = useState<string | null>(null);

  const normalizedProgress = Math.max(0, Math.min(100, Math.round(overallProgress)));

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <p className="text-sm font-semibold text-slate-500">Overall Progress</p>

        <p className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {normalizedProgress}%
        </p>

        <div className="mt-4">
          <PhaseProgressBar percentage={normalizedProgress} />
        </div>

        <p className="mt-3 text-xs font-medium text-slate-500">
          {phases.length} {phases.length === 1 ? "phase" : "phases"}
        </p>
      </div>

      <div className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Project Phases</h2>

          <button
            type="button"
            onClick={onAddPhase}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Add Phase
          </button>
        </div>

        {phases.length > 0 ? (
          <>
            <ul className="space-y-3" aria-label="Project phases">
              {phases.map((phase) => {
                const isActive = selectedPhaseId === phase.id;

                return (
                  <li
                    key={phase.id}
                    draggable={!isSaving}
                    onDragStart={() => setDraggedPhaseId(phase.id)}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();

                      if (!draggedPhaseId || draggedPhaseId === phase.id) {
                        return;
                      }

                      onReorderPhases(draggedPhaseId, phase.id);
                      setDraggedPhaseId(null);
                    }}
                    onDragEnd={() => setDraggedPhaseId(null)}
                    className={`cursor-move rounded-2xl border p-4 transition ${
                      isActive
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPhase(phase.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">{phase.name}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {phase.completedTaskCount}/{phase.taskCount} tasks complete
                          </p>
                        </div>

                        <span
                          aria-hidden="true"
                          className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-white shadow-sm"
                          style={{ backgroundColor: phase.color || "#94a3b8" }}
                        />
                      </div>

                      <div className="mt-3">
                        <PhaseProgressBar percentage={phase.progress} />
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selectedPhaseId ? (
              <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Phase Settings
                </p>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Name</span>
                  <input
                    type="text"
                    value={phaseNameInput}
                    onChange={(event) => onPhaseNameChange(event.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    disabled={isSaving}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-slate-700">Color</span>
                  <input
                    type="color"
                    value={phaseColorInput}
                    onChange={(event) => onPhaseColorChange(event.target.value)}
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 py-2"
                    disabled={isSaving}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSavePhase}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save Phase"}
                  </button>

                  <button
                    type="button"
                    onClick={onDeletePhase}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-lg border border-rose-200 bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete Phase
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">No phases yet</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Add your first phase to start organizing project work.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
