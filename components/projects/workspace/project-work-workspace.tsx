import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CalendarDays, ClipboardCheck, FilePlus2, ListChecks, Plus, X } from "lucide-react";
import { TaskDetailsPanel } from "@/app/(app)/projects/[id]/components/task-details-panel";
import type { TaskFormValues } from "@/app/(app)/projects/[id]/components/workspace-types";
import { FadeIn, SlidePanel, StaggerGroup, StatusPulse } from "@/components/motion";
import { BottomSheet, Card, CardHeader, CardTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import type { ProjectSuperintendentBriefing } from "@/lib/project-intelligence/briefing/briefing-types";
import { ProjectSuperintendentBriefingPanel } from "./project-superintendent-briefing";
import { ProjectWorkOperationsTimeline } from "./project-work-operations-timeline";
import { ProjectWorkSiteCamPanel } from "./project-work-sitecam-panel";
import { ProjectWorkActivePhasesPanel } from "./project-work-active-phases-panel";
import { ProjectWorkExecutionBoard } from "./project-work-execution-board";
import { ProjectMemoryCapturePanel } from "./project-memory-capture-panel";

type WorkTaskSummary = {
  id: string;
  title: string;
  phase_id: string | null;
  description: string | null;
  notes: string | null;
  status: string;
  priority: string;
  assigned_profile_id: string | null;
  completion_percentage: number;
  planned_start: string | null;
  planned_finish: string | null;
  actual_start: string | null;
  actual_finish: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
};

type ProjectWorkWorkspaceProps = {
  companyId: string;
  projectId: string;
  projectName: string;
  projectStatus: string;
  customerId: string | null;
  userId: string;
  locale: string;
  tasks: WorkTaskSummary[];
  profiles: Record<string, string>;
  briefing: ProjectSuperintendentBriefing;
  formatCurrency: (amount: number) => string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectWorkWorkspace({ companyId, projectId, projectName, projectStatus, customerId, userId, locale, tasks, profiles, briefing, formatCurrency, t }: ProjectWorkWorkspaceProps) {
  const supabase = useMemo(() => createClient(), []);
  const [workspaceTasks, setWorkspaceTasks] = useState(tasks);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isMobileDetailsOpen, setIsMobileDetailsOpen] = useState(false);
  const [isSavingTask, setIsSavingTask] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDueDate, setNewTaskDueDate] = useState("");
  const [taskDraftById, setTaskDraftById] = useState<Record<string, TaskDetailsDraft>>({});
  const [phaseNameById, setPhaseNameById] = useState<Record<string, string>>({});
  const [dependencySummary, setDependencySummary] = useState<DependencySummary | null>(null);
  const [executionFilters, setExecutionFilters] = useState<{
    status: "all" | "not_started" | "in_progress" | "blocked" | "completed";
    assignee: "all" | string;
    search: string;
    sort: "due_date" | "priority" | "progress";
  }>({
    status: "all",
    assignee: "all",
    search: "",
    sort: "due_date",
  });

  const handleSelectedPhaseChange = useCallback((phaseId: string | null) => {
    setSelectedPhaseId(phaseId);
    setSelectedTaskId(null);
    setIsMobileDetailsOpen(false);
    setSaveFeedback(null);
    setValidationMessage(null);
  }, []);

  const handleSelectedTaskChange = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    setSaveFeedback(null);
    setValidationMessage(null);

    if (taskId) {
      setIsMobileDetailsOpen(true);
    }
  }, []);

  const selectedTask = selectedTaskId ? workspaceTasks.find((task) => task.id === selectedTaskId) ?? null : null;
  const selectedTaskBaseDraft = selectedTask ? mapTaskToDraft(selectedTask) : EMPTY_TASK_DRAFT;
  const selectedTaskDraft = selectedTask ? taskDraftById[selectedTask.id] ?? selectedTaskBaseDraft : EMPTY_TASK_DRAFT;
  const isTaskDirty = selectedTask ? !isTaskDraftEqual(selectedTaskBaseDraft, selectedTaskDraft) : false;

  const selectedTaskMode: "no_phase" | "no_task" | "task" = !selectedPhaseId ? "no_phase" : selectedTask ? "task" : "no_task";
  const selectedPhaseLabel = selectedTask?.phase_id ? phaseNameById[selectedTask.phase_id] || null : selectedPhaseId ? phaseNameById[selectedPhaseId] || null : null;
  const selectedTaskIsOverdue = Boolean(selectedTask?.planned_finish) && String(selectedTask?.planned_finish) < todayIso() && normalizeStatus(selectedTask?.status || "") !== "completed";

  const assigneeOptions = useMemo(() => {
    return Object.entries(profiles)
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [profiles]);

  const taskDetailsLabels = {
    title: t("projects.workTaskDetailsTitle"),
    noTaskSelected: t("projects.workTaskDetailsNoTaskSelected"),
    noPhaseSelectedTitle: t("projects.workTaskDetailsNoPhaseTitle"),
    noPhaseSelectedDescription: t("projects.workTaskDetailsNoPhaseDescription"),
    selectTaskTitle: t("projects.workTaskDetailsSelectTaskTitle"),
    selectTaskDescription: t("projects.workTaskDetailsSelectTaskDescription"),
    phaseLabel: t("projects.workTaskDetailsPhaseLabel"),
    overdueBadge: t("projects.workTaskDetailsOverdueBadge"),
    dependencyTitle: t("projects.workTaskDetailsDependencyTitle"),
    dependencyLoading: t("projects.workTaskDetailsDependencyLoading"),
    blockedByLabel: t("projects.workTaskDetailsBlockedByLabel"),
    blockingLabel: t("projects.workTaskDetailsBlockingLabel"),
    fieldTitle: t("projects.workTaskDetailsFieldTitle"),
    fieldDescription: t("projects.workTaskDetailsFieldDescription"),
    fieldStatus: t("projects.workTaskDetailsFieldStatus"),
    fieldPriority: t("projects.workTaskDetailsFieldPriority"),
    fieldAssignee: t("projects.workTaskDetailsFieldAssignee"),
    fieldPlannedStart: t("projects.workTaskDetailsFieldPlannedStart"),
    fieldPlannedFinish: t("projects.workTaskDetailsFieldPlannedFinish"),
    fieldActualStart: t("projects.workTaskDetailsFieldActualStart"),
    fieldActualFinish: t("projects.workTaskDetailsFieldActualFinish"),
    fieldEstimatedHours: t("projects.workTaskDetailsFieldEstimatedHours"),
    fieldActualHours: t("projects.workTaskDetailsFieldActualHours"),
    fieldCompletion: t("projects.workTaskDetailsFieldCompletion"),
    fieldNotes: t("projects.workTaskDetailsFieldNotes"),
    save: t("projects.workTaskDetailsSave"),
    saving: t("projects.workTaskDetailsSaving"),
    saveSuccess: t("projects.workTaskDetailsSaveSuccess"),
    close: t("projects.workTaskDetailsClose"),
    statusNotStarted: t("projects.workTaskDetailsStatusNotStarted"),
    statusReady: t("projects.workTaskDetailsStatusReady"),
    statusInProgress: t("projects.workTaskDetailsStatusInProgress"),
    statusBlocked: t("projects.workTaskDetailsStatusBlocked"),
    statusOnHold: t("projects.workTaskDetailsStatusOnHold"),
    statusCompleted: t("projects.workTaskDetailsStatusCompleted"),
    statusCancelled: t("projects.workTaskDetailsStatusCancelled"),
    priorityLow: t("projects.workTaskDetailsPriorityLow"),
    priorityMedium: t("projects.workTaskDetailsPriorityMedium"),
    priorityHigh: t("projects.workTaskDetailsPriorityHigh"),
    priorityUrgent: t("projects.workTaskDetailsPriorityUrgent"),
    assigneeUnassigned: t("projects.workTaskDetailsAssigneeUnassigned"),
  };

  useEffect(() => {
    let isSubscribed = true;

    const loadPhaseLabels = async () => {
      const client = supabase;
      if (!client) {
        return;
      }

      const response = await client
        .from("project_phases")
        .select("id, name")
        .eq("company_id", companyId)
        .eq("project_id", projectId)
        .order("sort_order", { ascending: true });

      if (!isSubscribed || response.error || !response.data) {
        return;
      }

      setPhaseNameById(Object.fromEntries(response.data.map((row) => [row.id, row.name])));
    };

    void loadPhaseLabels();

    return () => {
      isSubscribed = false;
    };
  }, [companyId, projectId, selectedPhaseId, supabase]);

  useEffect(() => {
    let isSubscribed = true;

    const loadDependencySummary = async () => {
      if (!selectedTaskId) {
        setDependencySummary(null);
        return;
      }

      setDependencySummary({ blockedByCount: 0, blockingCount: 0, isLoading: true });

      const client = supabase;
      if (!client) {
        if (isSubscribed) {
          setDependencySummary({ blockedByCount: 0, blockingCount: 0, isLoading: false });
        }

        return;
      }

      const [blockedByResponse, blockingResponse] = await Promise.all([
        client
          .from("task_dependencies")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("task_id", selectedTaskId),
        client
          .from("task_dependencies")
          .select("id", { count: "exact", head: true })
          .eq("company_id", companyId)
          .eq("depends_on_task_id", selectedTaskId),
      ]);

      if (!isSubscribed) {
        return;
      }

      setDependencySummary({
        blockedByCount: blockedByResponse.error ? 0 : blockedByResponse.count || 0,
        blockingCount: blockingResponse.error ? 0 : blockingResponse.count || 0,
        isLoading: false,
      });
    };

    void loadDependencySummary();

    return () => {
      isSubscribed = false;
    };
  }, [companyId, selectedTaskId, supabase]);

  const handleTaskFieldChange = (field: keyof TaskDetailsDraft, value: string) => {
    if (!selectedTask) {
      return;
    }

    setValidationMessage(null);
    setSaveFeedback(null);
    setTaskDraftById((previous) => ({
      ...previous,
      [selectedTask.id]: {
        ...(previous[selectedTask.id] || mapTaskToDraft(selectedTask)),
        [field]: value,
      },
    }));
  };

  const handleSaveTask = async () => {
    if (!selectedTask || !isTaskDirty || isSavingTask) {
      return;
    }

    const validationError = validateTaskDraft(selectedTaskDraft, t);
    if (validationError) {
      setValidationMessage(validationError);
      return;
    }

    const client = supabase;
    if (!client) {
      setValidationMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    const payload = buildTaskUpdatePayload(selectedTaskDraft);

    setIsSavingTask(true);
    setValidationMessage(null);
    setSaveFeedback(null);

    const updateResponse = await client
      .from("tasks")
      .update(payload)
      .eq("id", selectedTask.id)
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .select("id, title, phase_id, description, notes, status, priority, assigned_profile_id, completion_percentage, planned_start, planned_finish, actual_start, actual_finish, estimated_hours, actual_hours, updated_at")
      .single();

    setIsSavingTask(false);

    if (updateResponse.error || !updateResponse.data) {
      setValidationMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    const updatedTask = updateResponse.data as WorkTaskSummary;

    setWorkspaceTasks((previous) => previous.map((task) => (task.id === updatedTask.id ? { ...task, ...updatedTask } : task)));
    setTaskDraftById((previous) => {
      const next = { ...previous };
      delete next[updatedTask.id];
      return next;
    });
    setSaveFeedback(t("projects.workTaskDetailsSaveSuccess"));
  };

  const handleCreateTask = async () => {
    const title = newTaskTitle.trim();
    const client = supabase;
    if (!selectedPhaseId || !title || isSavingTask || !client) {
      if (!selectedPhaseId) setValidationMessage(t("projects.workTaskDetailsNoPhaseDescription"));
      if (!client) setValidationMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    setIsSavingTask(true);
    setValidationMessage(null);
    setSaveFeedback(null);

    const latestTaskResponse = await client
      .from("tasks")
      .select("task_number, sort_order")
      .eq("company_id", companyId)
      .eq("project_id", projectId)
      .order("task_number", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestTaskResponse.error) {
      setValidationMessage(t("projects.workTaskDetailsErrorSave"));
      setIsSavingTask(false);
      return;
    }

    const nextTaskNumber = (latestTaskResponse.data?.task_number || 0) + 1;
    const nextSortOrder = (latestTaskResponse.data?.sort_order || 0) + 1;
    const insertResponse = await client
      .from("tasks")
      .insert({
        company_id: companyId,
        project_id: projectId,
        phase_id: selectedPhaseId,
        task_number: nextTaskNumber,
        sort_order: nextSortOrder,
        title,
        planned_finish: newTaskDueDate || null,
        priority: "medium",
        status: "not_started",
        completion_percentage: 0,
        created_by: userId,
      })
      .select("id, title, phase_id, description, notes, status, priority, assigned_profile_id, completion_percentage, planned_start, planned_finish, actual_start, actual_finish, estimated_hours, actual_hours, created_at, created_by, updated_at")
      .single();

    setIsSavingTask(false);

    if (insertResponse.error || !insertResponse.data) {
      setValidationMessage(t("projects.workTaskDetailsErrorSave"));
      return;
    }

    const createdTask = insertResponse.data as WorkTaskSummary;
    setWorkspaceTasks((previous) => [...previous, createdTask]);
    setSelectedTaskId(createdTask.id);
    setIsMobileDetailsOpen(true);
    setNewTaskTitle("");
    setNewTaskDueDate("");
    setIsCreateTaskOpen(false);
    setSaveFeedback(t("projects.workTaskDetailsSaveSuccess"));
  };

  return (
    <div className="space-y-6">
      <FadeIn delayMs={120} distancePx={5}>
        <section className="rounded-[16px] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.09em] text-[var(--color-text-muted)]">{t("projects.workspaceTabTasks")}</p>
              <h2 className="mt-1 text-lg font-bold text-[var(--color-navy-900)]">{projectName}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setIsCreateTaskOpen((value) => !value)} className="inline-flex items-center gap-2 rounded-[10px] bg-[var(--color-brand-700)] px-3 py-2 text-sm font-semibold text-white hover:bg-[var(--color-brand-800)]">
                {isCreateTaskOpen ? <X size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                {isCreateTaskOpen ? t("projects.workTaskDetailsClose") : t("projects.workCreateTask")}
              </button>
              <WorkspaceLink href={`/schedule?projectId=${projectId}`} icon={<CalendarDays size={15} aria-hidden="true" />} label={t("projects.workOpenSchedule")} />
              <WorkspaceLink href={`/daily-reports/new?projectId=${projectId}&projectName=${encodeURIComponent(projectName)}`} icon={<FilePlus2 size={15} aria-hidden="true" />} label={t("projects.workCreateDailyReport")} />
              <WorkspaceLink href={`/projects/${projectId}?tab=inspections`} icon={<ClipboardCheck size={15} aria-hidden="true" />} label={t("projects.workspaceTabInspections")} />
              <WorkspaceLink href={`/projects/${projectId}?tab=inspections#punch-list`} icon={<ListChecks size={15} aria-hidden="true" />} label={t("projects.workOpenPunchList")} />
            </div>
          </div>

          {isCreateTaskOpen ? (
            <div className="mt-4 grid gap-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-3 sm:grid-cols-[minmax(0,1fr)_180px_auto]">
              <input value={newTaskTitle} onChange={(event) => setNewTaskTitle(event.target.value)} placeholder={t("projects.workCreateTaskPlaceholder")} aria-label={t("projects.workTaskDetailsFieldTitle")} className="h-10 rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)] focus:ring-2 focus:ring-[var(--focus-ring-primary)]" />
              <input type="date" value={newTaskDueDate} onChange={(event) => setNewTaskDueDate(event.target.value)} aria-label={t("projects.workTaskDetailsFieldPlannedFinish")} className="h-10 rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-500)]" />
              <button type="button" disabled={!selectedPhaseId || !newTaskTitle.trim() || isSavingTask} onClick={() => void handleCreateTask()} className="h-10 rounded-[10px] bg-[var(--color-brand-700)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-55">
                {isSavingTask ? t("projects.workTaskDetailsSaving") : t("projects.workTaskDetailsSave")}
              </button>
            </div>
          ) : null}
        </section>
      </FadeIn>

      <FadeIn delayMs={170} distancePx={6}>
        <ProjectSuperintendentBriefingPanel
          briefing={briefing}
          projectId={projectId}
          locale={locale}
          projectName={projectName}
          t={(key, params) => t(`projects.${key}`, params)}
          formatCurrency={formatCurrency}
        />
      </FadeIn>

      <FadeIn delayMs={200} distancePx={6}>
        <ProjectMemoryCapturePanel
          projectId={projectId}
          projectName={projectName}
          projectStatus={projectStatus}
          customerId={customerId}
          tasks={workspaceTasks}
          phaseNameById={phaseNameById}
          t={t}
        />
      </FadeIn>

      <StaggerGroup className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)_340px]" startDelayMs={230} staggerMs={45} distancePx={8}>
        <StatusPulse triggerKey={`phase-selection-${selectedPhaseId ?? "none"}`}>
          <ProjectWorkActivePhasesPanel
            companyId={companyId}
            projectId={projectId}
            tasks={workspaceTasks}
            selectedPhaseId={selectedPhaseId}
            onSelectedPhaseChange={handleSelectedPhaseChange}
            t={t}
          />
        </StatusPulse>

        <div className="space-y-6">
          <StatusPulse triggerKey={`board-selection-${selectedPhaseId ?? "none"}`}>
            <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
              <CardHeader className="bg-[var(--color-surface-subtle)]/55">
                <CardTitle className="text-[1.1rem] font-bold text-[var(--color-navy-900)]">Execution Board</CardTitle>
              </CardHeader>
              <ProjectWorkExecutionBoard
                selectedPhaseId={selectedPhaseId}
                selectedTaskId={selectedTaskId}
                tasks={workspaceTasks}
                profiles={profiles}
                filters={executionFilters}
                onFiltersChange={setExecutionFilters}
                onSelectedTaskChange={handleSelectedTaskChange}
                t={t}
              />
            </Card>
          </StatusPulse>
        </div>

        <div className="space-y-6">
          <div className="xl:hidden">
            <button
              type="button"
              onClick={() => setIsMobileDetailsOpen((value) => !value)}
              className="inline-flex w-full items-center justify-between rounded-[12px] border border-[var(--color-border-subtle)] bg-white px-4 py-2.5 text-left shadow-[var(--shadow-small)]"
            >
              <span className="text-sm font-semibold text-[var(--color-navy-900)]">{t("projects.workTaskDetailsMobileToggle")}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">
                {isMobileDetailsOpen ? t("projects.workTaskDetailsMobileHide") : t("projects.workTaskDetailsMobileShow")}
              </span>
            </button>
          </div>

          <StatusPulse triggerKey={`task-selection-${selectedTaskId ?? "none"}`}>
          <div className="hidden xl:block">
            <SlidePanel open from="right" className="h-full">
              <TaskDetailsPanel
                mode={selectedTaskMode}
                phaseName={selectedPhaseLabel}
                taskTitle={selectedTask?.title || null}
                isOverdue={selectedTaskIsOverdue}
                formValues={selectedTaskDraft}
                assigneeOptions={assigneeOptions}
                dependencySummary={selectedTaskMode === "task" ? dependencySummary : null}
                isSaving={isSavingTask}
                isDirty={isTaskDirty}
                validationMessage={validationMessage}
                feedbackMessage={saveFeedback}
                labels={taskDetailsLabels}
                onChange={handleTaskFieldChange}
                onSave={handleSaveTask}
                onClose={() => setIsMobileDetailsOpen(false)}
              />
            </SlidePanel>
          </div>
          </StatusPulse>

          <ProjectWorkSiteCamPanel
            companyId={companyId}
            projectId={projectId}
            projectName={projectName}
            userId={userId}
            selectedPhaseId={selectedPhaseId}
            selectedPhaseName={selectedPhaseId ? phaseNameById[selectedPhaseId] || null : null}
            selectedTaskId={selectedTaskId}
            selectedTaskTitle={selectedTask?.title || null}
            profiles={profiles}
            t={t}
          />

          <ProjectWorkOperationsTimeline
            companyId={companyId}
            projectId={projectId}
            tasks={workspaceTasks}
            profiles={profiles}
            phaseNameById={phaseNameById}
            t={t}
          />
        </div>
      </StaggerGroup>

      <BottomSheet
        open={isMobileDetailsOpen}
        onClose={() => setIsMobileDetailsOpen(false)}
        ariaLabel={taskDetailsLabels.title}
        backdropLabel={taskDetailsLabels.close}
        panelClassName="shadow-[0_-24px_48px_-28px_rgba(15,23,42,0.5)]"
      >
        <TaskDetailsPanel
          mode={selectedTaskMode}
          phaseName={selectedPhaseLabel}
          taskTitle={selectedTask?.title || null}
          isOverdue={selectedTaskIsOverdue}
          formValues={selectedTaskDraft}
          assigneeOptions={assigneeOptions}
          dependencySummary={selectedTaskMode === "task" ? dependencySummary : null}
          isSaving={isSavingTask}
          isDirty={isTaskDirty}
          validationMessage={validationMessage}
          feedbackMessage={saveFeedback}
          labels={taskDetailsLabels}
          onChange={handleTaskFieldChange}
          onSave={handleSaveTask}
          onClose={() => setIsMobileDetailsOpen(false)}
        />
      </BottomSheet>
    </div>
  );
}

function WorkspaceLink({ href, icon, label }: { href: string; icon: ReactNode; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-subtle)]">
      {icon}
      {label}
    </Link>
  );
}

type TaskDetailsDraft = TaskFormValues & {
  assignedProfileId: string;
  notes: string;
};

type DependencySummary = {
  blockedByCount: number;
  blockingCount: number;
  isLoading: boolean;
};

const EMPTY_TASK_DRAFT: TaskDetailsDraft = {
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
  assignedProfileId: "",
  notes: "",
};

function mapTaskToDraft(task: WorkTaskSummary): TaskDetailsDraft {
  return {
    title: task.title || "",
    description: task.description || "",
    status: task.status || "not_started",
    priority: task.priority || "medium",
    estimatedHours: formatNullableNumber(task.estimated_hours),
    actualHours: formatNullableNumber(task.actual_hours),
    plannedStart: task.planned_start || "",
    plannedFinish: task.planned_finish || "",
    actualStart: task.actual_start || "",
    actualFinish: task.actual_finish || "",
    completionPercentage: String(clampNumber(task.completion_percentage, 0, 100)),
    assignedProfileId: task.assigned_profile_id || "",
    notes: task.notes || "",
  };
}

function isTaskDraftEqual(previous: TaskDetailsDraft, next: TaskDetailsDraft) {
  return (
    previous.title === next.title &&
    previous.description === next.description &&
    previous.status === next.status &&
    previous.priority === next.priority &&
    previous.estimatedHours === next.estimatedHours &&
    previous.actualHours === next.actualHours &&
    previous.plannedStart === next.plannedStart &&
    previous.plannedFinish === next.plannedFinish &&
    previous.actualStart === next.actualStart &&
    previous.actualFinish === next.actualFinish &&
    previous.completionPercentage === next.completionPercentage &&
    previous.assignedProfileId === next.assignedProfileId &&
    previous.notes === next.notes
  );
}

function validateTaskDraft(values: TaskDetailsDraft, t: (key: string, params?: Record<string, string | number>) => string) {
  if (!values.title.trim()) {
    return t("projects.workTaskDetailsErrorTitleRequired");
  }

  const completion = parseOptionalNumber(values.completionPercentage);
  if (completion === null || completion < 0 || completion > 100) {
    return t("projects.workTaskDetailsErrorCompletionRange");
  }

  const estimatedHours = parseOptionalNumber(values.estimatedHours);
  if (estimatedHours !== null && estimatedHours < 0) {
    return t("projects.workTaskDetailsErrorHoursNegative");
  }

  const actualHours = parseOptionalNumber(values.actualHours);
  if (actualHours !== null && actualHours < 0) {
    return t("projects.workTaskDetailsErrorHoursNegative");
  }

  if (values.plannedStart && values.plannedFinish && values.plannedFinish < values.plannedStart) {
    return t("projects.workTaskDetailsErrorPlannedDateOrder");
  }

  if (values.actualStart && values.actualFinish && values.actualFinish < values.actualStart) {
    return t("projects.workTaskDetailsErrorActualDateOrder");
  }

  return null;
}

function buildTaskUpdatePayload(values: TaskDetailsDraft) {
  const completion = parseOptionalNumber(values.completionPercentage);
  const estimatedHours = parseOptionalNumber(values.estimatedHours);
  const actualHours = parseOptionalNumber(values.actualHours);

  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    notes: values.notes.trim() || null,
    status: values.status,
    priority: values.priority,
    assigned_profile_id: values.assignedProfileId || null,
    planned_start: values.plannedStart || null,
    planned_finish: values.plannedFinish || null,
    actual_start: values.actualStart || null,
    actual_finish: values.actualFinish || null,
    estimated_hours: estimatedHours,
    actual_hours: actualHours,
    completion_percentage: completion === null ? 0 : Math.round(clampNumber(completion, 0, 100)),
  };
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatNullableNumber(value: number | null) {
  return typeof value === "number" ? String(value) : "";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeStatus(value: string) {
  return value.trim().toLowerCase();
}
