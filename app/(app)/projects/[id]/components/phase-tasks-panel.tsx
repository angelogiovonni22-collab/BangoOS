"use client";

import { useState } from "react";
import type { TaskListItem } from "./workspace-types";

type PhaseTasksPanelProps = {
  phaseName: string | null;
  tasks: TaskListItem[];
  selectedTaskId: string | null;
  isSaving: boolean;
  onSelectTask: (taskId: string) => void;
  onToggleTaskComplete: (taskId: string, isCompleted: boolean) => void;
  onNewTask: () => void;
  onReorderTasks: (draggedTaskId: string, targetTaskId: string) => void;
};

export function PhaseTasksPanel({
  phaseName,
  tasks,
  selectedTaskId,
  isSaving,
  onSelectTask,
  onToggleTaskComplete,
  onNewTask,
  onReorderTasks,
}: PhaseTasksPanelProps) {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">Tasks Workspace</p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {phaseName ? `${phaseName} Tasks` : "Tasks"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onNewTask}
            disabled={!phaseName || isSaving}
            className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            New Task
          </button>
        </div>
      </div>

      <div className="max-h-[65vh] overflow-y-auto p-4">
        {phaseName ? (
          tasks.length > 0 ? (
            <ul className="space-y-3" aria-label="Tasks for selected phase">
              {tasks.map((task) => {
                const isActive = selectedTaskId === task.id;
                const dueDateLabel = formatDueDate(task.plannedFinish);

                return (
                  <li
                    key={task.id}
                    draggable={!isSaving}
                    onDragStart={() => setDraggedTaskId(task.id)}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();

                      if (!draggedTaskId || draggedTaskId === task.id) {
                        return;
                      }

                      onReorderTasks(draggedTaskId, task.id);
                      setDraggedTaskId(null);
                    }}
                    onDragEnd={() => setDraggedTaskId(null)}
                    className={`rounded-2xl border p-4 transition ${
                      isActive
                        ? "border-blue-300 bg-blue-50 shadow-sm"
                        : "border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={task.status.trim().toLowerCase() === "completed"}
                        onChange={(event) => onToggleTaskComplete(task.id, event.target.checked)}
                        disabled={isSaving}
                        aria-label={`Mark ${task.title} complete`}
                      />

                      <button
                        type="button"
                        onClick={() => onSelectTask(task.id)}
                        className="min-w-0 flex-1 text-left"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{task.title}</p>
                          <span className={getStatusBadgeClass(task.status)}>{formatLabel(task.status)}</span>
                          <span className={getPriorityBadgeClass(task.priority)}>{formatLabel(task.priority)}</span>
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                          <span>Due {dueDateLabel}</span>
                          <span aria-hidden="true">•</span>
                          <span>{task.assignedProfileLabel}</span>
                          <span aria-hidden="true">•</span>
                          <span>{Math.round(task.completionPercentage)}% complete</span>
                        </div>
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-sm font-semibold text-slate-800">No tasks in this phase</p>
              <p className="mt-2 text-xs leading-6 text-slate-500">
                Create the first task to start tracking execution.
              </p>
            </div>
          )
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <p className="text-sm font-semibold text-slate-800">Select a phase first</p>
            <p className="mt-2 text-xs leading-6 text-slate-500">
              Choose a phase from the left panel to view its tasks.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function formatDueDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatLabel(value: string) {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function getStatusBadgeClass(status: string) {
  const normalized = status.trim().toLowerCase();

  if (normalized === "completed") {
    return "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold text-emerald-700";
  }

  if (normalized === "in_progress") {
    return "inline-flex rounded-full bg-blue-100 px-2 py-1 text-[10px] font-semibold text-blue-700";
  }

  if (normalized === "blocked") {
    return "inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700";
  }

  if (normalized === "on_hold") {
    return "inline-flex rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700";
  }

  return "inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700";
}

function getPriorityBadgeClass(priority: string) {
  const normalized = priority.trim().toLowerCase();

  if (normalized === "urgent") {
    return "inline-flex rounded-full bg-rose-100 px-2 py-1 text-[10px] font-semibold text-rose-700";
  }

  if (normalized === "high") {
    return "inline-flex rounded-full bg-orange-100 px-2 py-1 text-[10px] font-semibold text-orange-700";
  }

  if (normalized === "medium") {
    return "inline-flex rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-semibold text-indigo-700";
  }

  return "inline-flex rounded-full bg-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-700";
}
