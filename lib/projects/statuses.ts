export const PROJECT_STATUSES = [
  { value: "lead", label: "Lead" },
  { value: "estimating", label: "Estimating" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function getProjectStatusBadgeClass(statusValue: string) {
  const styles: Record<string, string> = {
    lead: "bg-slate-100 text-slate-700 ring-slate-500/20",
    estimating: "bg-amber-50 text-amber-700 ring-amber-600/20",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    scheduled: "bg-blue-50 text-blue-700 ring-blue-600/20",
    in_progress: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    on_hold: "bg-yellow-50 text-yellow-700 ring-yellow-600/20",
    completed: "bg-green-50 text-green-700 ring-green-600/20",
    cancelled: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };

  return styles[statusValue] || styles.lead;
}