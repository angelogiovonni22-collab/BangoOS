import { assignmentAssignee } from "./assignment-assignee";
import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import type { Database } from "@/types/database.types";
import type { AssignmentDraft, SchedulingPayload } from "./types";
import { createScheduleWindow } from "./time-zone";
import { loadScheduleTimeZone } from "./workspace-time-zone";

type WorkforceAssignmentRow = Database["public"]["Tables"]["workforce_assignments"]["Row"];

type RefreshScheduling = () => Promise<SchedulingPayload>;

function durationHours(startIso: string, endIso: string) {
  const hours = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 3_600_000;
  return Number(Math.max(0, hours).toFixed(2));
}

function mapDraftStatus(status: AssignmentDraft["status"]): WorkforceAssignmentRow["status"] {
  if (status === "draft") return "planned";
  if (status === "published") return "confirmed";
  return status;
}

async function resolveSchedulingWorkspace() {
  const supabase = createClient();
  if (!supabase) throw new Error("Unable to connect to Supabase for scheduling.");

  const workspace = await resolveWorkspaceContext(supabase);
  if (!workspace.context) {
    throw new Error(workspace.errorMessage || "Unable to resolve workspace for scheduling.");
  }

  const timeZone = await loadScheduleTimeZone(supabase, workspace.context.companyId);
  return { supabase, companyId: workspace.context.companyId, userId: workspace.context.userId, timeZone };
}

async function validateNoOverlap(params: {
  supabase: NonNullable<ReturnType<typeof createClient>>;
  companyId: string;
  startsAt: string;
  endsAt: string;
  employeeId: string | null;
  crewId: string | null;
  excludeAssignmentId: string;
}) {
  if (!params.employeeId && !params.crewId) return;

  let query = params.supabase
    .from("workforce_assignments")
    .select("id, starts_at, ends_at")
    .eq("company_id", params.companyId)
    .neq("id", params.excludeAssignmentId)
    .in("status", ["planned", "confirmed", "in_progress"]);

  if (params.employeeId) query = query.eq("employee_id", params.employeeId);
  if (params.crewId) query = query.eq("crew_id", params.crewId);

  const { data, error } = await query;
  if (error) throw error;

  const start = new Date(params.startsAt).getTime();
  const end = new Date(params.endsAt).getTime();
  const conflict = (data ?? []).some((row) => {
    const rowStart = new Date(row.starts_at).getTime();
    const rowEnd = new Date(row.ends_at).getTime();
    return start < rowEnd && rowStart < end;
  });

  if (conflict) {
    throw new Error("Assignment conflicts with an existing schedule for this resource.");
  }
}

export function createSchedulingCompletionService(refreshScheduling: RefreshScheduling) {
  return {
    async updateAssignment(assignmentId: string, draft: AssignmentDraft) {
      const { supabase, companyId, userId, timeZone } = await resolveSchedulingWorkspace();
      const { data: current, error: fetchError } = await supabase
        .from("workforce_assignments")
        .select("*")
        .eq("company_id", companyId)
        .eq("id", assignmentId)
        .maybeSingle<WorkforceAssignmentRow>();

      if (fetchError) throw fetchError;
      if (!current) throw new Error("Scheduling assignment not found.");

      const { startsAt, endsAt } = createScheduleWindow(draft.date, draft.startTime, draft.endTime, timeZone);
      const { crewId, employeeId, useEmployee } = assignmentAssignee(draft);

      await validateNoOverlap({
        supabase,
        companyId,
        startsAt,
        endsAt,
        employeeId,
        crewId,
        excludeAssignmentId: assignmentId,
      });

      const { error } = await supabase
        .from("workforce_assignments")
        .update({
          project_id: draft.projectId,
          title: draft.title.trim(),
          description: draft.notes.trim() || null,
          notes: draft.notes.trim() || null,
          starts_at: startsAt,
          ends_at: endsAt,
          planned_hours: durationHours(startsAt, endsAt),
          schedule_kind: draft.type,
          required_headcount: draft.requiredHeadcount,
          required_trade: draft.requiredTrade,
          status: mapDraftStatus(draft.status),
          assignment_type: useEmployee ? "employee" : "crew",
          employee_id: employeeId,
          crew_id: crewId,
          updated_by: userId,
        })
        .eq("company_id", companyId)
        .eq("id", assignmentId);

      if (error) throw error;

      const orion = createSupabaseOrionEventPublisher(supabase);
      await orion.publishEvent({
        company_id: companyId,
        actor_profile_id: userId,
        event_type: "schedule.updated",
        aggregate_type: "schedule",
        aggregate_id: assignmentId,
        source_module: "scheduling",
        payload: {
          schedule_id: assignmentId,
          project_id: draft.projectId,
          title: draft.title.trim(),
          starts_at: startsAt,
          ends_at: endsAt,
          crew_id: crewId,
          employee_id: employeeId,
          status: mapDraftStatus(draft.status),
          deep_link: `/schedule?project=${draft.projectId}`,
        },
        metadata: {
          event_category: "scheduling",
          event_severity: "info",
          deep_link: `/schedule?project=${draft.projectId}`,
        },
      });

      return refreshScheduling();
    },

    async cancelAssignment(assignmentId: string) {
      const { supabase, companyId, userId } = await resolveSchedulingWorkspace();
      const { data: current, error: fetchError } = await supabase
        .from("workforce_assignments")
        .select("id, project_id, title, status")
        .eq("company_id", companyId)
        .eq("id", assignmentId)
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!current) throw new Error("Scheduling assignment not found.");

      const { error } = await supabase
        .from("workforce_assignments")
        .update({ status: "cancelled", updated_by: userId })
        .eq("company_id", companyId)
        .eq("id", assignmentId);

      if (error) throw error;

      const orion = createSupabaseOrionEventPublisher(supabase);
      await orion.publishEvent({
        company_id: companyId,
        actor_profile_id: userId,
        event_type: "schedule.cancelled",
        aggregate_type: "schedule",
        aggregate_id: assignmentId,
        source_module: "scheduling",
        payload: {
          schedule_id: assignmentId,
          project_id: current.project_id,
          title: current.title,
          previous_status: current.status,
          deep_link: `/schedule?project=${current.project_id}`,
        },
        metadata: {
          event_category: "scheduling",
          event_severity: "warning",
          deep_link: `/schedule?project=${current.project_id}`,
        },
      });

      return refreshScheduling();
    },
  };
}
