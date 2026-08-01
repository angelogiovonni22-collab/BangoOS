"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Layers3 } from "lucide-react";
import { ProjectPhasesSidebar } from "@/app/(app)/projects/[id]/components/project-phases-sidebar";
import type { PhaseListItem } from "@/app/(app)/projects/[id]/components/workspace-types";
import { Card, CardContent, CardHeader, CardTitle, ConfirmDialog } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database.types";

type ProjectPhaseRow = Database["public"]["Tables"]["project_phases"]["Row"];
type ProjectTaskRow = Pick<Database["public"]["Tables"]["tasks"]["Row"], "id" | "phase_id" | "status" | "planned_finish" | "completion_percentage">;

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type ProjectWorkActivePhasesPanelProps = {
  companyId: string;
  projectId: string;
  tasks: ProjectTaskRow[];
  selectedPhaseId: string | null;
  onSelectedPhaseChange: (phaseId: string | null) => void;
  t: TranslateFn;
};

export function ProjectWorkActivePhasesPanel({
  companyId,
  projectId,
  tasks,
  selectedPhaseId,
  onSelectedPhaseChange,
  t,
}: ProjectWorkActivePhasesPanelProps) {
  const [phases, setPhases] = useState<ProjectPhaseRow[]>([]);
  const [phaseNameInput, setPhaseNameInput] = useState("");
  const [phaseColorInput, setPhaseColorInput] = useState("#2563eb");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    let isSubscribed = true;

    const loadPhases = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      if (!supabase) {
        if (isSubscribed) {
          setErrorMessage(t("projects.workPhasesErrorLoad"));
          setIsLoading(false);
        }

        return;
      }

      const result = await supabase
        .from("project_phases")
        .select("id, company_id, project_id, name, color, sort_order, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (result.error) {
        if (isSubscribed) {
          setErrorMessage(t("projects.workPhasesErrorLoad"));
          setIsLoading(false);
        }

        return;
      }

      if (!isSubscribed) {
        return;
      }

      const loadedPhases = result.data ?? [];
      setPhases(loadedPhases);

      if (loadedPhases.length === 0) {
        onSelectedPhaseChange(null);
        setPhaseNameInput("");
        setPhaseColorInput("#2563eb");
      } else {
        const defaultPhase = pickDefaultPhase(loadedPhases, buildPhaseStates(loadedPhases, tasks));
        const selectedStillExists = selectedPhaseId ? loadedPhases.some((phase) => phase.id === selectedPhaseId) : false;
        const nextSelected = selectedStillExists ? selectedPhaseId : defaultPhase?.id ?? loadedPhases[0].id;
        const selectedPhase = loadedPhases.find((phase) => phase.id === nextSelected) ?? loadedPhases[0];

        onSelectedPhaseChange(nextSelected);
        setPhaseNameInput(selectedPhase.name);
        setPhaseColorInput(selectedPhase.color || "#2563eb");
      }

      setIsLoading(false);
    };

    void loadPhases();

    return () => {
      isSubscribed = false;
    };
  }, [companyId, projectId, selectedPhaseId, supabase, tasks, onSelectedPhaseChange, t]);

  const phaseStatesById = useMemo(() => buildPhaseStates(phases, tasks), [phases, tasks]);

  const phaseListItems = useMemo<PhaseListItem[]>(() => {
    return phases.map((phase) => {
      const state = phaseStatesById[phase.id];

      return {
        id: phase.id,
        name: phase.name,
        color: phase.color,
        progress: state.progress,
        taskCount: state.taskCount,
        completedTaskCount: state.completedTaskCount,
      };
    });
  }, [phases, phaseStatesById]);

  const overallProgress = useMemo(() => {
    if (phaseListItems.length === 0) {
      return 0;
    }

    const total = phaseListItems.reduce((sum, phase) => sum + phase.progress, 0);
    return Math.round(total / phaseListItems.length);
  }, [phaseListItems]);

  const labels = {
    overallProgress: t("projects.workPhasesOverallProgress"),
    phaseCountSingular: t("projects.workPhasesPhaseSingular"),
    phaseCountPlural: t("projects.workPhasesPhasePlural"),
    title: t("projects.workPhasesTitle"),
    addPhase: t("projects.workPhasesAdd"),
    noPhasesTitle: t("projects.workPhasesEmptyTitle"),
    noPhasesDescription: t("projects.workPhasesEmptyDescription"),
    phaseSettings: t("projects.workPhasesSettings"),
    nameLabel: t("projects.workPhasesNameLabel"),
    colorLabel: t("projects.workPhasesColorLabel"),
    savePhase: t("projects.workPhasesSave"),
    savingPhase: t("projects.workPhasesSaving"),
    deletePhase: t("projects.workPhasesDelete"),
    tasksCompletedLabel: t("projects.workPhasesCompletedLabel"),
    tasksOpenLabel: t("projects.workPhasesOpenLabel"),
    activeBadge: t("projects.workPhasesBadgeActive"),
    completedBadge: t("projects.workPhasesBadgeCompleted"),
    overdueBadge: t("projects.workPhasesBadgeOverdue"),
  };

  const handleSelectPhase = (phaseId: string) => {
    const selectedPhase = phases.find((phase) => phase.id === phaseId);
    if (!selectedPhase) {
      return;
    }

    onSelectedPhaseChange(phaseId);
    setPhaseNameInput(selectedPhase.name);
    setPhaseColorInput(selectedPhase.color || "#2563eb");
  };

  const handleAddPhase = async () => {
    if (isSaving || !supabase) {
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const sortOrder = phases.length === 0 ? 0 : Math.max(...phases.map((phase) => phase.sort_order)) + 1;
    const defaultName = t("projects.workPhasesDefaultName", { count: phases.length + 1 });

    const result = await supabase
      .from("project_phases")
      .insert({
        company_id: companyId,
        project_id: projectId,
        name: defaultName,
        color: "#2563eb",
        sort_order: sortOrder,
      })
      .select("id, company_id, project_id, name, color, sort_order, created_at, updated_at")
      .single();

    if (result.error || !result.data) {
      setErrorMessage(t("projects.workPhasesErrorAdd"));
      setIsSaving(false);
      return;
    }

    setPhases((previous) => [...previous, result.data]);
    onSelectedPhaseChange(result.data.id);
    setPhaseNameInput(result.data.name);
    setPhaseColorInput(result.data.color || "#2563eb");
    setIsSaving(false);
  };

  const handleSavePhase = async () => {
    if (!selectedPhaseId || isSaving || !supabase) {
      return;
    }

    const normalizedName = phaseNameInput.trim();
    if (!normalizedName) {
      setErrorMessage(t("projects.workPhasesErrorNameRequired"));
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    const result = await supabase
      .from("project_phases")
      .update({
        name: normalizedName,
        color: phaseColorInput,
      })
      .eq("id", selectedPhaseId)
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .select("id, company_id, project_id, name, color, sort_order, created_at, updated_at")
      .single();

    if (result.error || !result.data) {
      setErrorMessage(t("projects.workPhasesErrorSave"));
      setIsSaving(false);
      return;
    }

    setPhases((previous) => previous.map((phase) => (phase.id === result.data.id ? result.data : phase)));
    setIsSaving(false);
  };

  const handleDeletePhase = async () => {
    if (!selectedPhaseId || isSaving || !supabase) {
      return;
    }

    setIsDeleteDialogOpen(true);
  };

  const confirmDeletePhase = async () => {
    if (!selectedPhaseId || isSaving || !supabase) {
      return;
    }

    setIsDeleteDialogOpen(false);

    setIsSaving(true);
    setErrorMessage(null);

    const result = await supabase
      .from("project_phases")
      .delete()
      .eq("id", selectedPhaseId)
      .eq("company_id", companyId)
      .eq("project_id", projectId);

    if (result.error) {
      setErrorMessage(t("projects.workPhasesErrorDelete"));
      setIsSaving(false);
      return;
    }

    const updated = phases.filter((phase) => phase.id !== selectedPhaseId);
    setPhases(updated);

    if (updated.length === 0) {
      onSelectedPhaseChange(null);
      setPhaseNameInput("");
      setPhaseColorInput("#2563eb");
    } else {
      const defaultPhase = pickDefaultPhase(updated, buildPhaseStates(updated, tasks));
      const nextSelected = defaultPhase?.id ?? updated[0].id;
      const selectedPhase = updated.find((phase) => phase.id === nextSelected) ?? updated[0];

      onSelectedPhaseChange(nextSelected);
      setPhaseNameInput(selectedPhase.name);
      setPhaseColorInput(selectedPhase.color || "#2563eb");
    }

    setIsSaving(false);
  };

  const handleReorderPhases = async (draggedPhaseId: string, targetPhaseId: string) => {
    if (isSaving || !supabase || draggedPhaseId === targetPhaseId) {
      return;
    }

    const fromIndex = phases.findIndex((phase) => phase.id === draggedPhaseId);
    const toIndex = phases.findIndex((phase) => phase.id === targetPhaseId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const reordered = [...phases];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const withSortOrder = reordered.map((phase, index) => ({ ...phase, sort_order: index }));

    setPhases(withSortOrder);
    setIsSaving(true);
    setErrorMessage(null);

    const updates = await Promise.all(
      withSortOrder.map((phase) =>
        supabase
          .from("project_phases")
          .update({ sort_order: phase.sort_order })
          .eq("id", phase.id)
          .eq("company_id", companyId)
          .eq("project_id", projectId),
      ),
    );

    const hasError = updates.some((result) => Boolean(result.error));

    if (hasError) {
      setErrorMessage(t("projects.workPhasesErrorReorder"));

      const reload = await supabase
        .from("project_phases")
        .select("id, company_id, project_id, name, color, sort_order, created_at, updated_at")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (!reload.error) {
        setPhases(reload.data ?? []);
      }
    }

    setIsSaving(false);
  };

  const selectedExists = selectedPhaseId ? phaseListItems.some((phase) => phase.id === selectedPhaseId) : false;
  const selectedId = selectedExists ? selectedPhaseId : null;

  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <ConfirmDialog
        open={isDeleteDialogOpen}
        title={t("projects.workPhasesDelete")}
        description={t("projects.workPhasesDeleteConfirm")}
        cancelLabel={t("projects.cancel")}
        confirmLabel={isSaving ? t("projects.workPhasesSaving") : t("projects.workPhasesDelete")}
        isConfirming={isSaving}
        onCancel={() => setIsDeleteDialogOpen(false)}
        onConfirm={() => {
          void confirmDeletePhase();
        }}
      />

      <CardHeader className="bg-[var(--color-surface-subtle)]/55">
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] bg-[var(--color-primary-100)] text-[var(--color-brand-700)]">
            <Layers3 size={15} aria-hidden="true" />
          </span>
          <CardTitle className="text-[1.1rem] font-bold text-[var(--color-navy-900)]">{t("projects.workActivePhasesPanelTitle")}</CardTitle>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        {errorMessage ? (
          <div className="flex items-start gap-2 rounded-[12px] border border-[var(--color-warning-200)] bg-[var(--color-warning-100)] px-3 py-2 text-sm text-[var(--color-warning-800)]">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {isLoading ? (
          <div className="rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-6 text-sm text-[var(--color-text-secondary)]">
            {t("projects.workPhasesLoading")}
          </div>
        ) : (
          <ProjectPhasesSidebar
            overallProgress={overallProgress}
            phases={phaseListItems}
            phaseStatesById={phaseStatesById}
            selectedPhaseId={selectedId}
            phaseNameInput={phaseNameInput}
            phaseColorInput={phaseColorInput}
            isSaving={isSaving}
            labels={labels}
            onAddPhase={handleAddPhase}
            onSelectPhase={handleSelectPhase}
            onPhaseNameChange={setPhaseNameInput}
            onPhaseColorChange={setPhaseColorInput}
            onSavePhase={handleSavePhase}
            onDeletePhase={handleDeletePhase}
            onReorderPhases={handleReorderPhases}
          />
        )}
      </CardContent>
    </Card>
  );
}

function buildPhaseStates(phases: ProjectPhaseRow[], tasks: ProjectTaskRow[]) {
  const todayIso = new Date().toISOString().slice(0, 10);

  const rows = phases.map((phase) => {
    const phaseTasks = tasks.filter((task) => task.phase_id === phase.id);
    const completedTaskCount = phaseTasks.filter((task) => normalizeTaskStatus(task.status) === "completed").length;
    const openTaskCount = Math.max(0, phaseTasks.length - completedTaskCount);
    const hasOverdueTasks = phaseTasks.some(
      (task) => Boolean(task.planned_finish) && String(task.planned_finish) < todayIso && normalizeTaskStatus(task.status) !== "completed",
    );
    const progress =
      phaseTasks.length === 0
        ? 0
        : Math.round(
            phaseTasks.reduce((sum, task) => {
              if (normalizeTaskStatus(task.status) === "completed") {
                return sum + 100;
              }

              return sum + Math.max(0, Math.min(100, task.completion_percentage));
            }, 0) / phaseTasks.length,
          );

    return {
      id: phase.id,
      taskCount: phaseTasks.length,
      completedTaskCount,
      openTaskCount,
      hasOverdueTasks,
      progress,
    };
  });

  const firstOpenPhase = rows.find((row) => row.taskCount > 0 && row.completedTaskCount < row.taskCount);
  const activePhaseId = firstOpenPhase?.id ?? (rows[0]?.id ?? null);

  return Object.fromEntries(
    rows.map((row) => [
      row.id,
      {
        taskCount: row.taskCount,
        completedTaskCount: row.completedTaskCount,
        openTaskCount: row.openTaskCount,
        hasOverdueTasks: row.hasOverdueTasks,
        progress: row.progress,
        isCompletedPhase: row.taskCount > 0 && row.completedTaskCount === row.taskCount,
        isActivePhase: activePhaseId === row.id,
      },
    ]),
  );
}

function pickDefaultPhase(phases: ProjectPhaseRow[], phaseStatesById: ReturnType<typeof buildPhaseStates>) {
  if (phases.length === 0) {
    return null;
  }

  const active = phases.find((phase) => phaseStatesById[phase.id]?.isActivePhase);
  return active ?? phases[0];
}

function normalizeTaskStatus(status: string) {
  return status.trim().toLowerCase();
}
