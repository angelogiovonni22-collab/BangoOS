"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import type { ProjectRow } from "@/lib/projects";
import { ProjectPhasesSidebar } from "./components/project-phases-sidebar";
import { PhaseTasksPanel } from "./components/phase-tasks-panel";
import { TaskDetailsPanel } from "./components/task-details-panel";
import type { PhaseListItem, TaskFormValues, TaskListItem } from "./components/workspace-types";

type ProjectSummary = Pick<ProjectRow, "id" | "name" | "project_number" | "company_id">;
type WorkspaceContext = { companyId: string; userId: string };
type ProjectPhaseRow = Database["public"]["Tables"]["project_phases"]["Row"];
type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];
type ProfileNameRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "first_name" | "last_name"
>;

const DEFAULT_PHASE_COLOR = "#2563eb";

export default function ProjectDetailsPage() {
  const params = useParams<{ id?: string | string[] }>();
  const projectId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const supabase = useMemo(() => createClient(), []);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [workspace, setWorkspace] = useState<WorkspaceContext | null>(null);
  const [project, setProject] = useState<ProjectSummary | null>(null);
  const [phaseRows, setPhaseRows] = useState<ProjectPhaseRow[]>([]);
  const [taskRows, setTaskRows] = useState<TaskRow[]>([]);
  const [profileNamesById, setProfileNamesById] = useState<Record<string, string>>({});

  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [phaseNameInput, setPhaseNameInput] = useState("");
  const [phaseColorInput, setPhaseColorInput] = useState(DEFAULT_PHASE_COLOR);
  const [taskFormValues, setTaskFormValues] = useState<TaskFormValues>(emptyTaskFormValues());

  useEffect(() => {
    let isSubscribed = true;

    const loadProjectWorkspace = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      setNotFound(false);

      if (!projectId) {
        if (isSubscribed) {
          setErrorMessage("We could not read the project ID from this link.");
          setIsLoading(false);
        }

        return;
      }

      const workspaceResult = await resolveWorkspaceContext(supabase);

      if (workspaceResult.errorMessage || !workspaceResult.context) {
        if (isSubscribed) {
          setErrorMessage(workspaceResult.errorMessage);
          setIsLoading(false);
        }

        return;
      }

      const client = supabase;

      if (!client) {
        if (isSubscribed) {
          setErrorMessage("Unable to connect right now. Please try again shortly.");
          setIsLoading(false);
        }

        return;
      }

      try {
        const { data: projectData, error: projectError } = await client
          .from("projects")
          .select("id, name, project_number, company_id")
          .eq("id", projectId)
          .eq("company_id", workspaceResult.context.companyId)
          .maybeSingle<ProjectSummary>();

        if (projectError) {
          if (isSubscribed) {
            setErrorMessage("Unable to load this project right now. Please try again shortly.");
          }

          return;
        }

        if (!projectData) {
          if (isSubscribed) {
            setNotFound(true);
          }

          return;
        }

        const [phasesResponse, tasksResponse, profilesResponse] = await Promise.all([
          client
            .from("project_phases")
            .select("id, company_id, project_id, name, color, sort_order, created_at, updated_at")
            .eq("project_id", projectId)
            .eq("company_id", workspaceResult.context.companyId)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: true }),
          client
            .from("tasks")
            .select(
              "id, company_id, project_id, assigned_profile_id, phase_id, task_number, title, description, priority, status, planned_start, planned_finish, estimated_completion_date, actual_start, actual_finish, estimated_hours, actual_hours, completion_percentage, sort_order, notes, created_by, created_at, updated_at",
            )
            .eq("project_id", projectId)
            .eq("company_id", workspaceResult.context.companyId)
            .order("sort_order", { ascending: true })
            .order("task_number", { ascending: true }),
          client
            .from("profiles")
            .select("id, first_name, last_name")
            .eq("company_id", workspaceResult.context.companyId),
        ]);

        if (phasesResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load project phases right now. Please try again shortly.");
          }

          return;
        }

        if (tasksResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load project tasks right now. Please try again shortly.");
          }

          return;
        }

        if (profilesResponse.error) {
          if (isSubscribed) {
            setErrorMessage("Unable to load team members right now. Please try again shortly.");
          }

          return;
        }

        const loadedPhaseRows = (phasesResponse.data ?? []) as ProjectPhaseRow[];
        const loadedTaskRows = (tasksResponse.data ?? []) as TaskRow[];
        const profileRows = (profilesResponse.data ?? []) as ProfileNameRow[];
        const profileNameMap = buildProfileNameMap(profileRows);

        if (isSubscribed) {
          setWorkspace(workspaceResult.context);
          setProject(projectData);
          setPhaseRows(loadedPhaseRows);
          setTaskRows(loadedTaskRows);
          setProfileNamesById(profileNameMap);

          const initialPhaseId = loadedPhaseRows[0]?.id ?? null;
          const initialPhase = loadedPhaseRows.find((phase) => phase.id === initialPhaseId) || null;
          const initialTask = loadedTaskRows.find((task) => task.phase_id === initialPhaseId) || null;

          setSelectedPhaseId(initialPhaseId);
          setPhaseNameInput(initialPhase?.name || "");
          setPhaseColorInput(initialPhase?.color || DEFAULT_PHASE_COLOR);
          setSelectedTaskId(initialTask?.id ?? null);
          setTaskFormValues(initialTask ? toTaskFormValues(initialTask) : emptyTaskFormValues());
        }
      } catch (caughtError) {
        console.error("Load project workspace error:", caughtError);

        if (isSubscribed) {
          setErrorMessage(
            "Something unexpected happened while loading this workspace. Please try again.",
          );
        }
      } finally {
        if (isSubscribed) {
          setIsLoading(false);
        }
      }
    };

    void loadProjectWorkspace();

    return () => {
      isSubscribed = false;
    };
  }, [projectId, supabase]);

  const phaseList = useMemo(
    () => mapPhasesWithProgress(phaseRows, taskRows),
    [phaseRows, taskRows],
  );

  const selectedPhase = useMemo(
    () => phaseList.find((phase) => phase.id === selectedPhaseId) || null,
    [phaseList, selectedPhaseId],
  );

  const phaseTasks = useMemo(
    () => mapTasksForPhase(taskRows, selectedPhaseId, profileNamesById),
    [taskRows, selectedPhaseId, profileNamesById],
  );

  const selectedTask = useMemo(
    () => phaseTasks.find((task) => task.id === selectedTaskId) || null,
    [phaseTasks, selectedTaskId],
  );

  const overallProgress = useMemo(() => {
    if (phaseList.length === 0) {
      return 0;
    }

    const totalTasks = phaseList.reduce((sum, phase) => sum + phase.taskCount, 0);

    if (totalTasks > 0) {
      const weightedProgress = phaseList.reduce(
        (sum, phase) => sum + phase.progress * phase.taskCount,
        0,
      );

      return weightedProgress / totalTasks;
    }

    return phaseList.reduce((sum, phase) => sum + phase.progress, 0) / phaseList.length;
  }, [phaseList]);

  const handleSelectPhase = (phaseId: string) => {
    const phase = phaseRows.find((row) => row.id === phaseId) || null;
    const firstTask = taskRows
      .filter((row) => row.phase_id === phaseId)
      .sort((a, b) => a.sort_order - b.sort_order || a.task_number - b.task_number)[0] || null;

    setSelectedPhaseId(phaseId);
    setPhaseNameInput(phase?.name || "");
    setPhaseColorInput(phase?.color || DEFAULT_PHASE_COLOR);
    setSelectedTaskId(firstTask?.id || null);
    setTaskFormValues(firstTask ? toTaskFormValues(firstTask) : emptyTaskFormValues());
    setErrorMessage(null);
  };

  const handleSelectTask = (taskId: string) => {
    const task = taskRows.find((row) => row.id === taskId);

    setSelectedTaskId(taskId);
    setTaskFormValues(task ? toTaskFormValues(task) : emptyTaskFormValues());
    setErrorMessage(null);
  };

  const handleTaskFormChange = (field: keyof TaskFormValues, value: string) => {
    setTaskFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const savePhaseOrder = async (orderedPhases: ProjectPhaseRow[]) => {
    if (!workspace || !projectId) {
      setErrorMessage("Unable to save phase order right now.");
      return false;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return false;
    }

    try {
      const updates = orderedPhases.map((phase, index) =>
        client
          .from("project_phases")
          .update({ sort_order: index + 1 })
          .eq("id", phase.id)
          .eq("company_id", workspace.companyId)
          .eq("project_id", projectId),
      );

      const results = await Promise.all(updates);
      const failedUpdate = results.find((result) => Boolean(result.error));

      if (failedUpdate?.error) {
        setErrorMessage("Unable to save the updated phase order. Please try again.");
        return false;
      }

      return true;
    } catch (caughtError) {
      console.error("Save phase order error:", caughtError);
      setErrorMessage("Unable to save the updated phase order. Please try again.");
      return false;
    }
  };

  const handleReorderPhases = async (draggedPhaseId: string, targetPhaseId: string) => {
    if (isSaving || draggedPhaseId === targetPhaseId) {
      return;
    }

    const draggedIndex = phaseRows.findIndex((phase) => phase.id === draggedPhaseId);
    const targetIndex = phaseRows.findIndex((phase) => phase.id === targetPhaseId);

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    const previousPhases = [...phaseRows];
    const reorderedPhases = [...phaseRows];
    const [draggedPhase] = reorderedPhases.splice(draggedIndex, 1);
    reorderedPhases.splice(targetIndex, 0, draggedPhase);

    const normalizedPhases = reorderedPhases.map((phase, index) => ({
      ...phase,
      sort_order: index + 1,
    }));

    setErrorMessage(null);
    setIsSaving(true);
    setPhaseRows(normalizedPhases);

    const didSave = await savePhaseOrder(normalizedPhases);

    if (!didSave) {
      setPhaseRows(previousPhases);
    }

    setIsSaving(false);
  };

  const handleAddPhase = async () => {
    if (!workspace || !projectId || isSaving) {
      return;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const nextSortOrder = phaseRows.length + 1;
      const newPhaseName = getNextPhaseName(phaseRows);
      const insertPayload: Database["public"]["Tables"]["project_phases"]["Insert"] = {
        company_id: workspace.companyId,
        project_id: projectId,
        name: newPhaseName,
        color: DEFAULT_PHASE_COLOR,
        sort_order: nextSortOrder,
      };

      const { data, error } = await client
        .from("project_phases")
        .insert(insertPayload)
        .select("id, company_id, project_id, name, color, sort_order, created_at, updated_at")
        .single<ProjectPhaseRow>();

      if (error || !data) {
        setErrorMessage("Unable to add a new phase right now. Please try again.");
        return;
      }

      const nextPhaseRows = [...phaseRows, data];
      setPhaseRows(nextPhaseRows);
      setSelectedPhaseId(data.id);
      setPhaseNameInput(data.name);
      setPhaseColorInput(data.color || DEFAULT_PHASE_COLOR);
      setSelectedTaskId(null);
      setTaskFormValues(emptyTaskFormValues());

      await savePhaseOrder(nextPhaseRows);
    } catch (caughtError) {
      console.error("Add phase error:", caughtError);
      setErrorMessage("Unable to add a new phase right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSavePhase = async () => {
    if (!workspace || !projectId || !selectedPhaseId || isSaving) {
      return;
    }

    const trimmedName = phaseNameInput.trim();

    if (!trimmedName) {
      setErrorMessage("Phase name is required.");
      return;
    }

    const normalizedColor = normalizeColorInput(phaseColorInput);
    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const { error } = await client
        .from("project_phases")
        .update({ name: trimmedName, color: normalizedColor })
        .eq("id", selectedPhaseId)
        .eq("company_id", workspace.companyId)
        .eq("project_id", projectId);

      if (error) {
        setErrorMessage("Unable to save phase changes right now. Please try again.");
        return;
      }

      setPhaseRows((currentRows) =>
        currentRows.map((phase) =>
          phase.id === selectedPhaseId ? { ...phase, name: trimmedName, color: normalizedColor } : phase,
        ),
      );
    } catch (caughtError) {
      console.error("Update phase error:", caughtError);
      setErrorMessage("Unable to save phase changes right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePhase = async () => {
    if (!workspace || !projectId || !selectedPhase || isSaving) {
      return;
    }

    const shouldDelete = window.confirm(
      `Delete phase \"${selectedPhase.name}\"? Tasks in this phase may be removed by database constraints.`,
    );

    if (!shouldDelete) {
      return;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const { error } = await client
        .from("project_phases")
        .delete()
        .eq("id", selectedPhase.id)
        .eq("company_id", workspace.companyId)
        .eq("project_id", projectId);

      if (error) {
        setErrorMessage("Unable to delete this phase right now. Please try again.");
        return;
      }

      const nextPhaseRows = phaseRows.filter((phase) => phase.id !== selectedPhase.id);
      const nextTaskRows = taskRows.filter((task) => task.phase_id !== selectedPhase.id);

      setPhaseRows(nextPhaseRows);
      setTaskRows(nextTaskRows);

      const nextSelectedPhase = nextPhaseRows[0] || null;
      const nextSelectedTask = nextTaskRows
        .filter((task) => task.phase_id === nextSelectedPhase?.id)
        .sort((a, b) => a.sort_order - b.sort_order || a.task_number - b.task_number)[0] || null;

      setSelectedPhaseId(nextSelectedPhase?.id || null);
      setPhaseNameInput(nextSelectedPhase?.name || "");
      setPhaseColorInput(nextSelectedPhase?.color || DEFAULT_PHASE_COLOR);
      setSelectedTaskId(nextSelectedTask?.id || null);
      setTaskFormValues(nextSelectedTask ? toTaskFormValues(nextSelectedTask) : emptyTaskFormValues());

      await savePhaseOrder(nextPhaseRows);
    } catch (caughtError) {
      console.error("Delete phase error:", caughtError);
      setErrorMessage("Unable to delete this phase right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveTaskOrder = async (phaseId: string, orderedTaskIds: string[]) => {
    if (!workspace || !projectId) {
      setErrorMessage("Unable to save task order right now.");
      return false;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return false;
    }

    try {
      const updates = orderedTaskIds.map((taskId, index) =>
        client
          .from("tasks")
          .update({ sort_order: index + 1 })
          .eq("id", taskId)
          .eq("company_id", workspace.companyId)
          .eq("project_id", projectId)
          .eq("phase_id", phaseId),
      );

      const results = await Promise.all(updates);
      const failedUpdate = results.find((result) => Boolean(result.error));

      if (failedUpdate?.error) {
        setErrorMessage("Unable to save task order right now. Please try again.");
        return false;
      }

      return true;
    } catch (caughtError) {
      console.error("Save task order error:", caughtError);
      setErrorMessage("Unable to save task order right now. Please try again.");
      return false;
    }
  };

  const handleReorderTasks = async (draggedTaskId: string, targetTaskId: string) => {
    if (!selectedPhaseId || isSaving || draggedTaskId === targetTaskId) {
      return;
    }

    const tasksInPhase = taskRows
      .filter((task) => task.phase_id === selectedPhaseId)
      .sort((a, b) => a.sort_order - b.sort_order || a.task_number - b.task_number);

    const draggedIndex = tasksInPhase.findIndex((task) => task.id === draggedTaskId);
    const targetIndex = tasksInPhase.findIndex((task) => task.id === targetTaskId);

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    const reordered = [...tasksInPhase];
    const [draggedTask] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, draggedTask);

    const normalized = reordered.map((task, index) => ({ ...task, sort_order: index + 1 }));
    const previousTaskRows = [...taskRows];

    setIsSaving(true);
    setErrorMessage(null);
    setTaskRows(mergePhaseTasks(taskRows, selectedPhaseId, normalized));

    const didSave = await saveTaskOrder(
      selectedPhaseId,
      normalized.map((task) => task.id),
    );

    if (!didSave) {
      setTaskRows(previousTaskRows);
    }

    setIsSaving(false);
  };

  const handleToggleTaskComplete = async (taskId: string, isCompleted: boolean) => {
    if (!workspace || !projectId || isSaving) {
      return;
    }

    const task = taskRows.find((row) => row.id === taskId);

    if (!task) {
      return;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    const nextStatus = isCompleted ? "completed" : "not_started";
    const nextCompletion = isCompleted ? 100 : 0;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await client
        .from("tasks")
        .update({ status: nextStatus, completion_percentage: nextCompletion })
        .eq("id", taskId)
        .eq("company_id", workspace.companyId)
        .eq("project_id", projectId);

      if (error) {
        setErrorMessage("Unable to update task status right now. Please try again.");
        return;
      }

      setTaskRows((currentRows) =>
        currentRows.map((row) =>
          row.id === taskId ? { ...row, status: nextStatus, completion_percentage: nextCompletion } : row,
        ),
      );
    } catch (caughtError) {
      console.error("Toggle task complete error:", caughtError);
      setErrorMessage("Unable to update task status right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleNewTask = async () => {
    if (!workspace || !projectId || !selectedPhaseId || isSaving) {
      return;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const nextTaskNumber = getNextTaskNumber(taskRows);
      const maxSortOrderInPhase = taskRows
        .filter((task) => task.phase_id === selectedPhaseId)
        .reduce((maxValue, task) => Math.max(maxValue, task.sort_order), 0);

      const { data, error } = await client
        .from("tasks")
        .insert({
          company_id: workspace.companyId,
          project_id: projectId,
          phase_id: selectedPhaseId,
          task_number: nextTaskNumber,
          title: `New Task ${nextTaskNumber}`,
          status: "not_started",
          priority: "medium",
          completion_percentage: 0,
          sort_order: maxSortOrderInPhase + 1,
        })
        .select(
          "id, company_id, project_id, assigned_profile_id, phase_id, task_number, title, description, priority, status, planned_start, planned_finish, estimated_completion_date, actual_start, actual_finish, estimated_hours, actual_hours, completion_percentage, sort_order, notes, created_by, created_at, updated_at",
        )
        .single<TaskRow>();

      if (error || !data) {
        setErrorMessage("Unable to create a task right now. Please try again.");
        return;
      }

      setTaskRows((currentRows) => [...currentRows, data]);
      setSelectedTaskId(data.id);
      setTaskFormValues(toTaskFormValues(data));
    } catch (caughtError) {
      console.error("Create task error:", caughtError);
      setErrorMessage("Unable to create a task right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveTask = async () => {
    if (!workspace || !projectId || !selectedTaskId || isSaving) {
      return;
    }

    const task = taskRows.find((row) => row.id === selectedTaskId);

    if (!task) {
      return;
    }

    const title = taskFormValues.title.trim();

    if (!title) {
      setErrorMessage("Task name is required.");
      return;
    }

    const completionValue = clampPercentage(taskFormValues.completionPercentage);

    if (completionValue === null) {
      setErrorMessage("Completion percentage must be between 0 and 100.");
      return;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    const payload: Database["public"]["Tables"]["tasks"]["Update"] = {
      title,
      description: normalizeText(taskFormValues.description),
      status: taskFormValues.status,
      priority: taskFormValues.priority,
      estimated_hours: parseNullableNumber(taskFormValues.estimatedHours),
      actual_hours: parseNullableNumber(taskFormValues.actualHours),
      planned_start: normalizeDateInput(taskFormValues.plannedStart),
      planned_finish: normalizeDateInput(taskFormValues.plannedFinish),
      actual_start: normalizeDateInput(taskFormValues.actualStart),
      actual_finish: normalizeDateInput(taskFormValues.actualFinish),
      completion_percentage: completionValue,
    };

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { data, error } = await client
        .from("tasks")
        .update(payload)
        .eq("id", task.id)
        .eq("company_id", workspace.companyId)
        .eq("project_id", projectId)
        .select(
          "id, company_id, project_id, assigned_profile_id, phase_id, task_number, title, description, priority, status, planned_start, planned_finish, estimated_completion_date, actual_start, actual_finish, estimated_hours, actual_hours, completion_percentage, sort_order, notes, created_by, created_at, updated_at",
        )
        .single<TaskRow>();

      if (error || !data) {
        setErrorMessage("Unable to save task changes right now. Please try again.");
        return;
      }

      setTaskRows((currentRows) => currentRows.map((row) => (row.id === data.id ? data : row)));
      setTaskFormValues(toTaskFormValues(data));
    } catch (caughtError) {
      console.error("Save task error:", caughtError);
      setErrorMessage("Unable to save task changes right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!workspace || !projectId || !selectedTask || isSaving) {
      return;
    }

    const shouldDelete = window.confirm(`Delete task \"${selectedTask.title}\"?`);

    if (!shouldDelete) {
      return;
    }

    const client = supabase;

    if (!client) {
      setErrorMessage("Unable to connect right now. Please try again shortly.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const { error } = await client
        .from("tasks")
        .delete()
        .eq("id", selectedTask.id)
        .eq("company_id", workspace.companyId)
        .eq("project_id", projectId);

      if (error) {
        setErrorMessage("Unable to delete this task right now. Please try again.");
        return;
      }

      const nextTaskRows = taskRows.filter((row) => row.id !== selectedTask.id);
      const samePhaseTasks = nextTaskRows
        .filter((row) => row.phase_id === selectedPhaseId)
        .sort((a, b) => a.sort_order - b.sort_order || a.task_number - b.task_number)
        .map((row, index) => ({ ...row, sort_order: index + 1 }));

      setTaskRows(mergePhaseTasks(nextTaskRows, selectedPhaseId, samePhaseTasks));
      setSelectedTaskId(samePhaseTasks[0]?.id || null);
      setTaskFormValues(samePhaseTasks[0] ? toTaskFormValues(samePhaseTasks[0]) : emptyTaskFormValues());

      if (selectedPhaseId) {
        await saveTaskOrder(
          selectedPhaseId,
          samePhaseTasks.map((row) => row.id),
        );
      }
    } catch (caughtError) {
      console.error("Delete task error:", caughtError);
      setErrorMessage("Unable to delete this task right now. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <ProjectLoadingState />;
  }

  if (errorMessage && !project && !phaseRows.length) {
    return <ProjectErrorState message={errorMessage} />;
  }

  if (notFound || !project) {
    return <ProjectNotFoundState />;
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3 text-sm font-medium text-slate-500">
            <Link href="/projects" className="text-blue-600 transition hover:text-blue-800">
              Back to Projects
            </Link>
            <span aria-hidden="true">/</span>
            <span>Project Workspace</span>
          </div>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {project.name.trim() || "Unnamed Project"}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            Project #{project.project_number?.trim() || "Not provided"}
          </p>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)_minmax(0,1fr)]">
        <ProjectPhasesSidebar
          overallProgress={overallProgress}
          phases={phaseList}
          selectedPhaseId={selectedPhaseId}
          phaseNameInput={phaseNameInput}
          phaseColorInput={phaseColorInput}
          isSaving={isSaving}
          onAddPhase={handleAddPhase}
          onSelectPhase={handleSelectPhase}
          onPhaseNameChange={setPhaseNameInput}
          onPhaseColorChange={setPhaseColorInput}
          onSavePhase={handleSavePhase}
          onDeletePhase={handleDeletePhase}
          onReorderPhases={handleReorderPhases}
        />

        <PhaseTasksPanel
          phaseName={selectedPhase?.name || null}
          tasks={phaseTasks}
          selectedTaskId={selectedTaskId}
          isSaving={isSaving}
          onSelectTask={handleSelectTask}
          onToggleTaskComplete={handleToggleTaskComplete}
          onNewTask={handleNewTask}
          onReorderTasks={handleReorderTasks}
        />

        <TaskDetailsPanel
          phaseName={selectedPhase?.name || null}
          task={selectedTask}
          formValues={taskFormValues}
          isSaving={isSaving}
          onChange={handleTaskFormChange}
          onSave={handleSaveTask}
          onDelete={handleDeleteTask}
          onNewTask={handleNewTask}
        />
      </div>
    </div>
  );
}

function buildProfileNameMap(rows: ProfileNameRow[]) {
  const entries = rows.map((row) => {
    const fullName = `${row.first_name?.trim() || ""} ${row.last_name?.trim() || ""}`.trim();
    return [row.id, fullName || "Unassigned"] as const;
  });

  return Object.fromEntries(entries);
}

function mapPhasesWithProgress(phases: ProjectPhaseRow[], tasks: TaskRow[]): PhaseListItem[] {
  return phases
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at))
    .map((phase) => {
      const relatedTasks = tasks.filter((task) => task.phase_id === phase.id);
      const taskCount = relatedTasks.length;

      if (taskCount === 0) {
        return {
          id: phase.id,
          name: phase.name,
          color: phase.color,
          progress: 0,
          taskCount: 0,
          completedTaskCount: 0,
        };
      }

      const completionSum = relatedTasks.reduce((sum, task) => {
        if (task.status.trim().toLowerCase() === "completed") {
          return sum + 100;
        }

        return sum + Math.max(0, Math.min(100, task.completion_percentage));
      }, 0);

      const completedTaskCount = relatedTasks.filter(
        (task) => task.status.trim().toLowerCase() === "completed" || task.completion_percentage >= 100,
      ).length;

      return {
        id: phase.id,
        name: phase.name,
        color: phase.color,
        progress: completionSum / taskCount,
        taskCount,
        completedTaskCount,
      };
    });
}

function mapTasksForPhase(
  tasks: TaskRow[],
  phaseId: string | null,
  profileNamesById: Record<string, string>,
): TaskListItem[] {
  if (!phaseId) {
    return [];
  }

  return tasks
    .filter((task) => task.phase_id === phaseId)
    .sort((a, b) => a.sort_order - b.sort_order || a.task_number - b.task_number)
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      plannedFinish: task.planned_finish,
      completionPercentage: task.completion_percentage,
      assignedProfileId: task.assigned_profile_id,
      assignedProfileLabel: task.assigned_profile_id
        ? profileNamesById[task.assigned_profile_id] || "Assigned user"
        : "Unassigned",
      sortOrder: task.sort_order,
      taskNumber: task.task_number,
    }));
}

function mergePhaseTasks(taskRows: TaskRow[], phaseId: string | null, phaseTasks: TaskRow[]) {
  if (!phaseId) {
    return taskRows;
  }

  const otherTasks = taskRows.filter((task) => task.phase_id !== phaseId);

  return [...otherTasks, ...phaseTasks].sort((a, b) => {
    if (a.phase_id === b.phase_id) {
      return a.sort_order - b.sort_order || a.task_number - b.task_number;
    }

    return a.created_at.localeCompare(b.created_at);
  });
}

function toTaskFormValues(task: TaskRow): TaskFormValues {
  return {
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    estimatedHours: task.estimated_hours?.toString() || "",
    actualHours: task.actual_hours?.toString() || "",
    plannedStart: task.planned_start || "",
    plannedFinish: task.planned_finish || "",
    actualStart: task.actual_start || "",
    actualFinish: task.actual_finish || "",
    completionPercentage: String(task.completion_percentage),
  };
}

function emptyTaskFormValues(): TaskFormValues {
  return {
    title: "",
    description: "",
    status: "not_started",
    priority: "medium",
    estimatedHours: "",
    actualHours: "",
    plannedStart: "",
    plannedFinish: "",
    actualStart: "",
    actualFinish: "",
    completionPercentage: "0",
  };
}

function normalizeColorInput(color: string) {
  const trimmedColor = color.trim();

  if (!trimmedColor) {
    return null;
  }

  return /^#[0-9a-fA-F]{6}$/.test(trimmedColor) ? trimmedColor : DEFAULT_PHASE_COLOR;
}

function getNextPhaseName(phases: ProjectPhaseRow[]) {
  const phaseNameSet = new Set(phases.map((phase) => phase.name.trim().toLowerCase()));

  let sequence = phases.length + 1;
  let nextName = `New Phase ${sequence}`;

  while (phaseNameSet.has(nextName.toLowerCase())) {
    sequence += 1;
    nextName = `New Phase ${sequence}`;
  }

  return nextName;
}

function getNextTaskNumber(tasks: TaskRow[]) {
  const maxTaskNumber = tasks.reduce((maxValue, task) => Math.max(maxValue, task.task_number), 0);
  return maxTaskNumber + 1;
}

function normalizeText(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeDateInput(value: string) {
  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function parseNullableNumber(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return null;
  }

  const parsed = Number(trimmedValue);

  if (Number.isNaN(parsed) || parsed < 0) {
    return null;
  }

  return parsed;
}

function clampPercentage(value: string) {
  const parsed = Number(value.trim());

  if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) {
    return null;
  }

  return Math.round(parsed);
}

function ProjectLoadingState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-2xl font-bold text-blue-600">
          P
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Loading project workspace...</h1>
        <p className="mt-2 leading-7 text-slate-500">Please wait while we load phases and tasks.</p>
      </div>
    </div>
  );
}

function ProjectErrorState({ message }: { message: string }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-2xl font-bold text-rose-600">
          !
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">We could not load this project</h1>
        <p className="mt-2 leading-7 text-slate-500">{message}</p>
        <Link
          href="/projects"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Back to Projects
        </Link>
      </div>
    </div>
  );
}

function ProjectNotFoundState() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-2xl font-bold text-slate-600">
          ?
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-slate-950">Project not found</h1>
        <p className="mt-2 leading-7 text-slate-500">
          This project may have been removed or may belong to a different company.
        </p>
        <Link
          href="/projects"
          className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
        >
          Back to Projects
        </Link>
      </div>
    </div>
  );
}
