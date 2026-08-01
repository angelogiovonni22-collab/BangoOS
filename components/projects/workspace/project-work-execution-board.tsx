import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Filter, ShieldAlert } from "lucide-react";
import { FadeIn } from "@/components/motion";
import { CardContent, EmptyState, Input } from "@/components/ui";
import { PhaseProgressBar } from "@/app/(app)/projects/[id]/components/phase-progress-bar";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type WorkTaskBoardItem = {
  id: string;
  title: string;
  phase_id: string | null;
  status: string;
  priority: string;
  planned_finish: string | null;
  completion_percentage: number;
  assigned_profile_id: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
};

type ExecutionBoardFilters = {
  status: "all" | "not_started" | "in_progress" | "blocked" | "completed";
  assignee: "all" | string;
  search: string;
  sort: "due_date" | "priority" | "progress";
};

type ProjectWorkExecutionBoardProps = {
  selectedPhaseId: string | null;
  selectedTaskId: string | null;
  tasks: WorkTaskBoardItem[];
  profiles: Record<string, string>;
  filters: ExecutionBoardFilters;
  onFiltersChange: (next: ExecutionBoardFilters) => void;
  onSelectedTaskChange: (taskId: string | null) => void;
  t: TranslateFn;
};

type StatusBucketKey = "not_started" | "in_progress" | "blocked" | "completed";

type BoardTask = WorkTaskBoardItem & {
  statusBucket: StatusBucketKey;
  assignedLabel: string;
  isOverdue: boolean;
  isHighPriority: boolean;
  isBlocked: boolean;
  isCompleted: boolean;
};

const STATUS_BUCKET_ORDER: StatusBucketKey[] = ["not_started", "in_progress", "blocked", "completed"];

export function ProjectWorkExecutionBoard({
  selectedPhaseId,
  selectedTaskId,
  tasks,
  profiles,
  filters,
  onFiltersChange,
  onSelectedTaskChange,
  t,
}: ProjectWorkExecutionBoardProps) {
  const previousBucketByTaskId = useRef<Record<string, StatusBucketKey>>({});
  const [recentlyShiftedTaskIds, setRecentlyShiftedTaskIds] = useState<Record<string, number>>({});

  const phaseTasks = useMemo(() => {
    if (!selectedPhaseId) {
      return [] as BoardTask[];
    }

    return tasks
      .filter((task) => task.phase_id === selectedPhaseId)
      .map((task) => {
        const statusBucket = mapStatusToBucket(task.status);
        const assignedLabel = task.assigned_profile_id ? profiles[task.assigned_profile_id] || t("projects.notAssigned") : t("projects.notAssigned");
        const isCompleted = statusBucket === "completed";
        const isOverdue = Boolean(task.planned_finish) && String(task.planned_finish) < todayIso() && !isCompleted;

        return {
          ...task,
          statusBucket,
          assignedLabel,
          isOverdue,
          isHighPriority: isHighPriority(task.priority),
          isBlocked: statusBucket === "blocked",
          isCompleted,
        };
      });
  }, [profiles, selectedPhaseId, t, tasks]);

  useEffect(() => {
    const shifted: Record<string, number> = {};

    for (const task of phaseTasks) {
      const previous = previousBucketByTaskId.current[task.id];
      if (previous && previous !== task.statusBucket) {
        shifted[task.id] = Date.now();
      }

      previousBucketByTaskId.current[task.id] = task.statusBucket;
    }

    if (Object.keys(shifted).length > 0) {
      const activateTimeout = window.setTimeout(() => {
        setRecentlyShiftedTaskIds((current) => ({ ...current, ...shifted }));
      }, 0);

      const timeout = window.setTimeout(() => {
        setRecentlyShiftedTaskIds((current) => {
          const next = { ...current };
          for (const taskId of Object.keys(shifted)) {
            delete next[taskId];
          }

          return next;
        });
      }, 380);

      return () => {
        window.clearTimeout(activateTimeout);
        window.clearTimeout(timeout);
      };
    }

    return undefined;
  }, [phaseTasks]);

  const assigneeOptions = useMemo(() => {
    const uniqueEntries = Object.entries(
      Object.fromEntries(
        phaseTasks
          .filter((task) => task.assigned_profile_id)
          .map((task) => [task.assigned_profile_id as string, task.assignedLabel]),
      ),
    );

    return uniqueEntries.sort((a, b) => a[1].localeCompare(b[1]));
  }, [phaseTasks]);

  const filteredTasks = useMemo(() => {
    const normalizedSearch = filters.search.trim().toLowerCase();

    return phaseTasks.filter((task) => {
      if (filters.status !== "all" && task.statusBucket !== filters.status) {
        return false;
      }

      if (filters.assignee !== "all" && task.assigned_profile_id !== filters.assignee) {
        return false;
      }

      if (normalizedSearch && !task.title.toLowerCase().includes(normalizedSearch)) {
        return false;
      }

      return true;
    });
  }, [filters.assignee, filters.search, filters.status, phaseTasks]);

  const groupedTasks = useMemo(() => {
    const grouped = {
      not_started: [] as BoardTask[],
      in_progress: [] as BoardTask[],
      blocked: [] as BoardTask[],
      completed: [] as BoardTask[],
    };

    filteredTasks.forEach((task) => {
      grouped[task.statusBucket].push(task);
    });

    STATUS_BUCKET_ORDER.forEach((bucket) => {
      grouped[bucket].sort((a, b) => compareTasks(a, b, filters.sort));
    });

    return grouped;
  }, [filteredTasks, filters.sort]);

  const selectedTaskStillExists = selectedTaskId ? phaseTasks.some((task) => task.id === selectedTaskId) : false;

  useEffect(() => {
    if (selectedTaskId && !selectedTaskStillExists) {
      onSelectedTaskChange(null);
    }
  }, [selectedTaskId, selectedTaskStillExists, onSelectedTaskChange]);

  if (!selectedPhaseId) {
    return (
      <CardContent className="p-5">
        <EmptyState
          compact
          icon="P"
          title={t("projects.workExecutionPhaseUnselectedTitle")}
          description={t("projects.workExecutionPhaseUnselectedDescription")}
        />
      </CardContent>
    );
  }

  return (
    <CardContent className="space-y-4 p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workExecutionSearchLabel")}</span>
          <Input
            value={filters.search}
            onChange={(event) => onFiltersChange({ ...filters, search: event.target.value })}
            placeholder={t("projects.workExecutionSearchPlaceholder")}
            aria-label={t("projects.workExecutionSearchLabel")}
          />
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workExecutionFilterStatus")}</span>
          <select
            value={filters.status}
            onChange={(event) => onFiltersChange({ ...filters, status: event.target.value as ExecutionBoardFilters["status"] })}
            className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
            aria-label={t("projects.workExecutionFilterStatus")}
          >
            <option value="all">{t("projects.workExecutionFilterAll")}</option>
            <option value="not_started">{t("projects.workExecutionBucketNotStarted")}</option>
            <option value="in_progress">{t("projects.workExecutionBucketInProgress")}</option>
            <option value="blocked">{t("projects.workExecutionBucketBlocked")}</option>
            <option value="completed">{t("projects.workExecutionBucketCompleted")}</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workExecutionFilterAssignee")}</span>
          <select
            value={filters.assignee}
            onChange={(event) => onFiltersChange({ ...filters, assignee: event.target.value })}
            className="h-10 w-full rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]"
            aria-label={t("projects.workExecutionFilterAssignee")}
          >
            <option value="all">{t("projects.workExecutionFilterAll")}</option>
            {assigneeOptions.map(([assigneeId, assigneeLabel]) => (
              <option key={assigneeId} value={assigneeId}>{assigneeLabel}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/65 px-4 py-2.5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">
          <Filter size={13} className="mr-1 inline-block" aria-hidden="true" />
          {t("projects.workExecutionResultsLabel", { count: filteredTasks.length })}
        </p>
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-text-secondary)]">
          <span>{t("projects.workExecutionSortLabel")}</span>
          <select
            value={filters.sort}
            onChange={(event) => onFiltersChange({ ...filters, sort: event.target.value as ExecutionBoardFilters["sort"] })}
            className="h-8 rounded-[8px] border border-[var(--color-border-subtle)] bg-white px-2 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)]"
            aria-label={t("projects.workExecutionSortLabel")}
          >
            <option value="due_date">{t("projects.workExecutionSortDueDate")}</option>
            <option value="priority">{t("projects.workExecutionSortPriority")}</option>
            <option value="progress">{t("projects.workExecutionSortProgress")}</option>
          </select>
        </label>
      </div>

      <div className="space-y-4 md:hidden">
        {STATUS_BUCKET_ORDER.map((bucket) => {
          const bucketTasks = groupedTasks[bucket];
          return (
            <details key={bucket} open className="rounded-[12px] border border-[var(--color-border-subtle)] bg-white">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">{statusBucketLabel(bucket, t)}</span>
                <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">{bucketTasks.length}</span>
              </summary>
              <div className="space-y-3 border-t border-[var(--color-border-subtle)] p-3">
                {bucketTasks.length === 0 ? (
                  <EmptyState compact icon="-" title={t("projects.workExecutionEmptyBucketTitle")} description={t("projects.workExecutionEmptyBucketDescription")} />
                ) : (
                  bucketTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      selected={selectedTaskId === task.id}
                      shifted={Boolean(recentlyShiftedTaskIds[task.id])}
                      onSelect={onSelectedTaskChange}
                      t={t}
                    />
                  ))
                )}
              </div>
            </details>
          );
        })}
      </div>

      <div className="hidden gap-4 md:grid md:grid-cols-2 xl:grid-cols-4">
        {STATUS_BUCKET_ORDER.map((bucket, index) => {
          const bucketTasks = groupedTasks[bucket];
          return (
            <FadeIn key={bucket} delayMs={index * 35}>
              <section className="flex min-h-[400px] flex-col rounded-[12px] border border-[var(--color-border-subtle)] bg-white">
                <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-3 py-2.5">
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{statusBucketLabel(bucket, t)}</h3>
                  <span className="rounded-full bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xs font-semibold text-[var(--color-text-secondary)]">{bucketTasks.length}</span>
                </header>
                <div className="flex-1 space-y-3 overflow-y-auto p-3">
                  {bucketTasks.length === 0 ? (
                    <EmptyState compact icon="-" title={t("projects.workExecutionEmptyBucketTitle")} description={t("projects.workExecutionEmptyBucketDescription")} />
                  ) : (
                    bucketTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        selected={selectedTaskId === task.id}
                        shifted={Boolean(recentlyShiftedTaskIds[task.id])}
                        onSelect={onSelectedTaskChange}
                        t={t}
                      />
                    ))
                  )}
                </div>
              </section>
            </FadeIn>
          );
        })}
      </div>
    </CardContent>
  );
}

function TaskCard({
  task,
  selected,
  shifted,
  onSelect,
  t,
}: {
  task: BoardTask;
  selected: boolean;
  shifted: boolean;
  onSelect: (taskId: string | null) => void;
  t: TranslateFn;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className={`bf-selection-sync w-full rounded-[10px] border p-3 text-left shadow-[var(--shadow-small)] transition ${
        shifted ? "bf-fade-in" : ""
      } ${
        selected
          ? "border-[var(--color-brand-300)] bg-[var(--color-brand-50)]"
          : "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/35 hover:border-[var(--color-border-strong)] hover:bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">{task.title}</p>
        {task.isCompleted ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--color-success-700)]" aria-hidden="true" /> : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {task.isOverdue ? <Badge tone="danger" label={t("projects.workExecutionBadgeOverdue")} icon={<AlertTriangle size={11} aria-hidden="true" />} /> : null}
        {task.isHighPriority ? <Badge tone="warning" label={t("projects.workExecutionBadgeHighPriority")} icon={<ShieldAlert size={11} aria-hidden="true" />} /> : null}
        {task.isBlocked ? <Badge tone="warning" label={t("projects.workExecutionBadgeBlocked")} icon={<AlertTriangle size={11} aria-hidden="true" />} /> : null}
      </div>

      <dl className="mt-3 space-y-2 text-xs text-[var(--color-text-secondary)]">
        <InfoRow label={t("projects.workExecutionTaskPriority")} value={formatPriority(task.priority, t)} />
        <InfoRow label={t("projects.workExecutionTaskAssignee")} value={task.assignedLabel} />
        <InfoRow label={t("projects.workExecutionTaskDueDate")} value={task.planned_finish || t("projects.notProvided")} />
        <InfoRow label={t("projects.workExecutionTaskEstimatedHours")} value={formatHours(task.estimated_hours, t)} />
        <InfoRow label={t("projects.workExecutionTaskActualHours")} value={formatHours(task.actual_hours, t)} />
      </dl>

      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workExecutionTaskProgress")}</span>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">{Math.max(0, Math.min(100, Math.round(task.completion_percentage)))}%</span>
        </div>
        <PhaseProgressBar percentage={task.completion_percentage} />
      </div>
    </button>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="font-medium">{label}</dt>
      <dd className="text-right text-[var(--color-text-primary)]">{value}</dd>
    </div>
  );
}

function Badge({ tone, label, icon }: { tone: "danger" | "warning"; label: string; icon: ReactNode }) {
  const toneClass = tone === "danger"
    ? "border-[var(--color-danger-200)] bg-[var(--color-danger-50)] text-[var(--color-danger-700)]"
    : "border-[var(--color-warning-200)] bg-[var(--color-warning-100)] text-[var(--color-warning-700)]";

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] ${toneClass}`}>
      {icon}
      {label}
    </span>
  );
}

function compareTasks(a: BoardTask, b: BoardTask, sortBy: "due_date" | "priority" | "progress") {
  if (sortBy === "priority") {
    const priorityDiff = priorityScore(b.priority) - priorityScore(a.priority);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    return a.title.localeCompare(b.title);
  }

  if (sortBy === "progress") {
    const progressDiff = b.completion_percentage - a.completion_percentage;
    if (progressDiff !== 0) {
      return progressDiff;
    }

    return a.title.localeCompare(b.title);
  }

  const dueA = a.planned_finish || "9999-12-31";
  const dueB = b.planned_finish || "9999-12-31";
  if (dueA !== dueB) {
    return dueA.localeCompare(dueB);
  }

  return a.title.localeCompare(b.title);
}

function mapStatusToBucket(status: string): StatusBucketKey {
  const normalized = status.trim().toLowerCase();

  if (normalized === "completed") {
    return "completed";
  }

  if (normalized === "in_progress") {
    return "in_progress";
  }

  if (normalized === "blocked" || normalized === "on_hold" || normalized === "cancelled") {
    return "blocked";
  }

  return "not_started";
}

function statusBucketLabel(bucket: StatusBucketKey, t: TranslateFn) {
  if (bucket === "in_progress") {
    return t("projects.workExecutionBucketInProgress");
  }

  if (bucket === "blocked") {
    return t("projects.workExecutionBucketBlocked");
  }

  if (bucket === "completed") {
    return t("projects.workExecutionBucketCompleted");
  }

  return t("projects.workExecutionBucketNotStarted");
}

function isHighPriority(priority: string) {
  const normalized = priority.trim().toLowerCase();
  return normalized === "high" || normalized === "urgent";
}

function priorityScore(priority: string) {
  const normalized = priority.trim().toLowerCase();

  if (normalized === "urgent") {
    return 4;
  }

  if (normalized === "high") {
    return 3;
  }

  if (normalized === "medium") {
    return 2;
  }

  return 1;
}

function formatPriority(priority: string, t: TranslateFn) {
  const normalized = priority.trim().toLowerCase();

  if (normalized === "urgent") {
    return t("projects.workExecutionPriorityUrgent");
  }

  if (normalized === "high") {
    return t("projects.workExecutionPriorityHigh");
  }

  if (normalized === "medium") {
    return t("projects.workExecutionPriorityMedium");
  }

  return t("projects.workExecutionPriorityLow");
}

function formatHours(value: number | null, t: TranslateFn) {
  if (typeof value !== "number") {
    return t("projects.notProvided");
  }

  return `${value.toFixed(1)}h`;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
