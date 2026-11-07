/** Preserve the stored completion-after-schedule constraint before any write or event. */
export function assertInspectionActionTime(input: { nextStatus: string; scheduledAt: string | null; completedAt?: unknown; now: string }) {
  if (!input.scheduledAt || !["in_progress", "passed", "failed"].includes(input.nextStatus)) return;
  const scheduled = Date.parse(input.scheduledAt);
  const action = Date.parse(input.nextStatus === "in_progress" ? input.now : typeof input.completedAt === "string" ? input.completedAt : input.now);
  if (!Number.isFinite(scheduled) || !Number.isFinite(action)) throw new Error("The inspection schedule is invalid. Correct its scheduled time before starting or completing it.");
  if (action < scheduled) throw new Error(input.nextStatus === "in_progress"
    ? "This inspection is scheduled for the future. Reschedule it to its actual start time before starting it."
    : "This inspection cannot be completed before its scheduled time. Review its schedule before recording a result.");
}
