"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type DependencyType = "finish_to_start" | "start_to_start" | "finish_to_finish" | "start_to_finish";

type DependencyTask = {
  id: string;
  title: string;
  status: string;
};

type DependencyRow = {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: DependencyType;
};

type ProjectTaskDependenciesPanelProps = {
  selectedTaskId: string | null;
  tasks: DependencyTask[];
  t: TranslateFn;
};

const DEPENDENCY_TYPES: Array<{ value: DependencyType; label: string }> = [
  { value: "finish_to_start", label: "FS" },
  { value: "start_to_start", label: "SS" },
  { value: "finish_to_finish", label: "FF" },
  { value: "start_to_finish", label: "SF" },
];

export function ProjectTaskDependenciesPanel({ selectedTaskId, tasks, t }: ProjectTaskDependenciesPanelProps) {
  const supabase = useMemo(() => createClient(), []);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [rows, setRows] = useState<DependencyRow[]>([]);
  const [candidateId, setCandidateId] = useState("");
  const [dependencyType, setDependencyType] = useState<DependencyType>("finish_to_start");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const taskById = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const taskIds = useMemo(() => tasks.map((task) => task.id), [tasks]);

  useEffect(() => {
    let subscribed = true;

    const load = async () => {
      setCandidateId("");
      setErrorMessage(null);

      if (!selectedTaskId || taskIds.length === 0 || !supabase) {
        setCompanyId(null);
        setRows([]);
        return;
      }

      setIsLoading(true);

      const taskResponse = await supabase
        .from("tasks")
        .select("company_id")
        .eq("id", selectedTaskId)
        .single();

      if (!subscribed) return;

      if (taskResponse.error || !taskResponse.data?.company_id) {
        setCompanyId(null);
        setRows([]);
        setErrorMessage(t("projects.workTaskDetailsErrorSave"));
        setIsLoading(false);
        return;
      }

      const resolvedCompanyId = taskResponse.data.company_id;
      const dependenciesResponse = await supabase
        .from("task_dependencies")
        .select("id, task_id, depends_on_task_id, dependency_type")
        .eq("company_id", resolvedCompanyId)
        .in("task_id", taskIds);

      if (!subscribed) return;

      setCompanyId(resolvedCompanyId);
      setRows(dependenciesResponse.error ? [] : (dependenciesResponse.data || []) as DependencyRow[]);
      setErrorMessage(dependenciesResponse.error ? t("projects.workTaskDetailsErrorSave") : null);
      setIsLoading(false);
    };

    void load();

    return () => {
      subscribed = false;
    };
  }, [selectedTaskId, supabase, t, taskIds]);

  const prerequisiteRows = useMemo(
    () => rows.filter((row) => row.task_id === selectedTaskId),
    [rows, selectedTaskId],
  );
  const blockingRows = useMemo(
    () => rows.filter((row) => row.depends_on_task_id === selectedTaskId),
    [rows, selectedTaskId],
  );
  const existingPrerequisiteIds = useMemo(
    () => new Set(prerequisiteRows.map((row) => row.depends_on_task_id)),
    [prerequisiteRows],
  );
  const candidateTasks = useMemo(
    () => tasks.filter((task) => task.id !== selectedTaskId && !existingPrerequisiteIds.has(task.id)),
    [existingPrerequisiteIds, selectedTaskId, tasks],
  );

  const handleAdd = async () => {
    if (!selectedTaskId || !candidateId || !companyId || !supabase || isSaving) return;

    if (wouldCreateCycle(selectedTaskId, candidateId, rows)) {
      setErrorMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const response = await supabase
      .from("task_dependencies")
      .insert({
        company_id: companyId,
        task_id: selectedTaskId,
        depends_on_task_id: candidateId,
        dependency_type: dependencyType,
      })
      .select("id, task_id, depends_on_task_id, dependency_type")
      .single();

    setIsSaving(false);

    if (response.error || !response.data) {
      setErrorMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    setRows((current) => [...current, response.data as DependencyRow]);
    setCandidateId("");
  };

  const handleTypeChange = async (row: DependencyRow, nextType: DependencyType) => {
    if (!companyId || !supabase || isSaving || row.dependency_type === nextType) return;

    setIsSaving(true);
    setErrorMessage(null);

    const response = await supabase
      .from("task_dependencies")
      .update({ dependency_type: nextType })
      .eq("id", row.id)
      .eq("company_id", companyId);

    setIsSaving(false);

    if (response.error) {
      setErrorMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    setRows((current) => current.map((item) => item.id === row.id ? { ...item, dependency_type: nextType } : item));
  };

  const handleRemove = async (row: DependencyRow) => {
    if (!companyId || !supabase || isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    const response = await supabase
      .from("task_dependencies")
      .delete()
      .eq("id", row.id)
      .eq("company_id", companyId);

    setIsSaving(false);

    if (response.error) {
      setErrorMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    setRows((current) => current.filter((item) => item.id !== row.id));
  };

  if (!selectedTaskId) return null;

  return (
    <section className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/45 p-3" aria-label={t("projects.workTaskDetailsDependencyTitle")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-[var(--color-brand-700)]" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{t("projects.workTaskDetailsDependencyTitle")}</p>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {t("projects.workTaskDetailsBlockedByLabel")}: {prerequisiteRows.length} · {t("projects.workTaskDetailsBlockingLabel")}: {blockingRows.length}
        </p>
      </div>

      {isLoading ? <p className="mt-2 text-sm text-[var(--color-text-secondary)]">{t("projects.workTaskDetailsDependencyLoading")}</p> : null}

      {!isLoading ? (
        <div className="mt-3 space-y-3">
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_86px_auto]">
            <label className="sr-only" htmlFor="project-task-dependency-candidate">{t("projects.workTaskDetailsBlockedByLabel")}</label>
            <select
              id="project-task-dependency-candidate"
              value={candidateId}
              onChange={(event) => setCandidateId(event.target.value)}
              className="h-9 min-w-0 rounded-[9px] border border-[var(--color-border-subtle)] bg-white px-2.5 text-sm text-[var(--color-text-primary)]"
              disabled={isSaving || candidateTasks.length === 0}
            >
              <option value="">{t("projects.workTaskDetailsBlockedByLabel")}</option>
              {candidateTasks.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
            <select
              value={dependencyType}
              onChange={(event) => setDependencyType(event.target.value as DependencyType)}
              aria-label={t("projects.workTaskDetailsDependencyTitle")}
              className="h-9 rounded-[9px] border border-[var(--color-border-subtle)] bg-white px-2 text-xs font-semibold text-[var(--color-text-primary)]"
              disabled={isSaving}
            >
              {DEPENDENCY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
            </select>
            <button
              type="button"
              onClick={() => void handleAdd()}
              disabled={!candidateId || isSaving}
              className="h-9 rounded-[9px] bg-[var(--color-brand-700)] px-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSaving ? t("projects.workTaskDetailsSaving") : t("projects.workTaskDetailsSave")}
            </button>
          </div>

          {prerequisiteRows.map((row) => {
            const prerequisite = taskById.get(row.depends_on_task_id);
            const completed = prerequisite?.status.trim().toLowerCase() === "completed";
            return (
              <div key={row.id} className="flex flex-wrap items-center gap-2 rounded-[9px] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
                {completed ? <CheckCircle2 size={14} className="text-[var(--color-success-700)]" aria-hidden="true" /> : <AlertTriangle size={14} className="text-[var(--color-warning-700)]" aria-hidden="true" />}
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-text-primary)]">{prerequisite?.title || t("projects.notProvided")}</span>
                <select
                  value={row.dependency_type}
                  onChange={(event) => void handleTypeChange(row, event.target.value as DependencyType)}
                  aria-label={t("projects.workTaskDetailsDependencyTitle")}
                  className="h-8 rounded-[8px] border border-[var(--color-border-subtle)] bg-white px-2 text-xs font-semibold text-[var(--color-text-primary)]"
                  disabled={isSaving}
                >
                  {DEPENDENCY_TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => void handleRemove(row)}
                  aria-label={`${t("projects.workTaskDetailsClose")}: ${prerequisite?.title || t("projects.notProvided")}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-danger-50)] hover:text-[var(--color-danger-700)]"
                  disabled={isSaving}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              </div>
            );
          })}

          {blockingRows.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)]">{t("projects.workTaskDetailsBlockingLabel")}:</span>
              {blockingRows.map((row) => (
                <span key={row.id} className="rounded-full bg-white px-2 py-0.5 text-xs text-[var(--color-text-primary)] ring-1 ring-[var(--color-border-subtle)]">
                  {taskById.get(row.task_id)?.title || t("projects.notProvided")}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? <p className="mt-2 text-xs font-medium text-[var(--color-danger-700)]">{errorMessage}</p> : null}
    </section>
  );
}

function wouldCreateCycle(taskId: string, candidateId: string, rows: DependencyRow[]) {
  const graph = new Map<string, string[]>();

  for (const row of rows) {
    const dependencies = graph.get(row.task_id) || [];
    dependencies.push(row.depends_on_task_id);
    graph.set(row.task_id, dependencies);
  }

  const stack = [candidateId];
  const visited = new Set<string>();

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    if (current === taskId) return true;
    visited.add(current);
    stack.push(...(graph.get(current) || []));
  }

  return false;
}
