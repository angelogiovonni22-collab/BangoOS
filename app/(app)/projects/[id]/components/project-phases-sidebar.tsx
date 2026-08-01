"use client";

import { useState } from "react";
import { StatusPulse } from "@/components/motion";
import { PhaseProgressBar } from "./phase-progress-bar";
import type { PhaseListItem } from "./workspace-types";

type PhaseVisualState = {
  openTaskCount: number;
  completedTaskCount: number;
  isActivePhase: boolean;
  isCompletedPhase: boolean;
  hasOverdueTasks: boolean;
};

type ProjectPhasesSidebarLabels = {
  overallProgress: string;
  phaseCountSingular: string;
  phaseCountPlural: string;
  title: string;
  addPhase: string;
  noPhasesTitle: string;
  noPhasesDescription: string;
  phaseSettings: string;
  nameLabel: string;
  colorLabel: string;
  savePhase: string;
  savingPhase: string;
  deletePhase: string;
  tasksCompletedLabel: string;
  tasksOpenLabel: string;
  activeBadge: string;
  completedBadge: string;
  overdueBadge: string;
};

type ProjectPhasesSidebarProps = {
  overallProgress: number;
  phases: PhaseListItem[];
  phaseStatesById: Record<string, PhaseVisualState>;
  selectedPhaseId: string | null;
  phaseNameInput: string;
  phaseColorInput: string;
  isSaving: boolean;
  labels: ProjectPhasesSidebarLabels;
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
  phaseStatesById,
  selectedPhaseId,
  phaseNameInput,
  phaseColorInput,
  isSaving,
  labels,
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
    <section className="rounded-[16px] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
      <div className="border-b border-[var(--color-border-subtle)] p-5">
        <p className="text-sm font-semibold text-[var(--color-text-secondary)]">{labels.overallProgress}</p>

        <p className="mt-2 text-3xl font-bold tracking-tight text-[var(--color-navy-900)]">
          {normalizedProgress}%
        </p>

        <div className="mt-4">
          <PhaseProgressBar percentage={normalizedProgress} />
        </div>

        <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
          {phases.length} {phases.length === 1 ? labels.phaseCountSingular : labels.phaseCountPlural}
        </p>
      </div>

      <div className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{labels.title}</h2>

          <button
            type="button"
            onClick={onAddPhase}
            disabled={isSaving}
            className="inline-flex items-center justify-center rounded-[10px] bg-[var(--color-brand-700)] px-3 py-2 text-xs font-semibold text-white shadow-[var(--shadow-small)] transition hover:bg-[var(--color-brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {labels.addPhase}
          </button>
        </div>

        {phases.length > 0 ? (
          <>
            <ul className="space-y-3" aria-label="Project phases">
              {phases.map((phase) => {
                const isActive = selectedPhaseId === phase.id;
                const phaseState = phaseStatesById[phase.id];

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
                    className={`bf-selection-sync cursor-move rounded-[12px] border p-4 transition ${
                      isActive
                        ? "border-[var(--color-brand-300)] bg-[var(--color-brand-50)] shadow-[var(--shadow-small)]"
                        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/65 hover:border-[var(--color-border-strong)] hover:bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectPhase(phase.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{phase.name}</p>
                          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                            {labels.tasksCompletedLabel}: {phaseState?.completedTaskCount ?? phase.completedTaskCount} | {labels.tasksOpenLabel}: {phaseState?.openTaskCount ?? Math.max(0, phase.taskCount - phase.completedTaskCount)}
                          </p>

                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {phaseState?.isActivePhase ? <StateBadge tone="info" label={labels.activeBadge} /> : null}
                            {phaseState?.isCompletedPhase ? (
                              <StatusPulse triggerKey={`${phase.id}-completed-${phaseState.completedTaskCount}`} tone="success">
                                <StateBadge tone="success" label={labels.completedBadge} />
                              </StatusPulse>
                            ) : null}
                            {phaseState?.hasOverdueTasks ? (
                              <StatusPulse triggerKey={`${phase.id}-overdue-${phaseState.openTaskCount}`} tone="warning">
                                <StateBadge tone="warning" label={labels.overdueBadge} />
                              </StatusPulse>
                            ) : null}
                          </div>
                        </div>

                        <span
                          aria-hidden="true"
                          className="mt-0.5 h-3 w-3 shrink-0 rounded-full border border-white shadow-[var(--shadow-small)]"
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
              <div className="space-y-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/65 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
                  {labels.phaseSettings}
                </p>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{labels.nameLabel}</span>
                  <input
                    type="text"
                    value={phaseNameInput}
                    onChange={(event) => onPhaseNameChange(event.target.value)}
                    className="w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
                    disabled={isSaving}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{labels.colorLabel}</span>
                  <input
                    type="color"
                    value={phaseColorInput}
                    onChange={(event) => onPhaseColorChange(event.target.value)}
                    className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-2 py-2"
                    disabled={isSaving}
                  />
                </label>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={onSavePhase}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-[10px] bg-[var(--color-brand-700)] px-3 py-2 text-xs font-semibold text-white shadow-[var(--shadow-small)] transition hover:bg-[var(--color-brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? labels.savingPhase : labels.savePhase}
                  </button>

                  <button
                    type="button"
                    onClick={onDeletePhase}
                    disabled={isSaving}
                    className="inline-flex items-center justify-center rounded-[10px] border border-[var(--color-danger-200)] bg-white px-3 py-2 text-xs font-semibold text-[var(--color-danger-700)] shadow-[var(--shadow-small)] transition hover:bg-[var(--color-danger-50)] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {labels.deletePhase}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="rounded-[12px] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-6 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">{labels.noPhasesTitle}</p>
            <p className="mt-2 text-xs leading-6 text-[var(--color-text-secondary)]">
              {labels.noPhasesDescription}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function StateBadge({ tone, label }: { tone: "info" | "success" | "warning"; label: string }) {
  const toneClass =
    tone === "success"
      ? "border-[var(--color-success-200)] bg-[var(--color-success-100)] text-[var(--color-success-700)]"
      : tone === "warning"
        ? "border-[var(--color-warning-200)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]"
        : "border-[var(--color-info-100)] bg-[var(--color-info-100)] text-[var(--color-info-700)]";

  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneClass}`}>{label}</span>;
}
