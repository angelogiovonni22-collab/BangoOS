import type { WorkforceIntelligence } from "./intelligence-types";

type WorkforceTaskInput = {
  status: string;
  assigned_profile_id: string | null;
};

/**
 * Derives workforce intelligence from already-loaded task data.
 * No Supabase queries are performed here.
 */
export function buildWorkforceIntelligence(
  tasks: WorkforceTaskInput[],
): WorkforceIntelligence {
  const totalTaskCount = tasks.length;

  // Count open (non-completed / non-cancelled) tasks
  const openTasks = tasks.filter((t) => !isCompletedOrCancelled(t.status));

  const unassignedTaskCount = openTasks.filter(
    (t) => !t.assigned_profile_id,
  ).length;

  // Unique workers with at least one task assigned (any status)
  const assignedProfileIds = new Set(
    tasks
      .map((t) => t.assigned_profile_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  // Open-task workload per worker
  const workloadByProfileId: Record<string, number> = {};
  for (const task of openTasks) {
    if (task.assigned_profile_id) {
      workloadByProfileId[task.assigned_profile_id] =
        (workloadByProfileId[task.assigned_profile_id] ?? 0) + 1;
    }
  }

  return {
    assignedWorkers: assignedProfileIds.size,
    unassignedTaskCount,
    totalTaskCount,
    workloadByProfileId,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isCompletedOrCancelled(status: string) {
  const s = status.trim().toLowerCase();
  return s === "completed" || s === "cancelled";
}
