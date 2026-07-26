export const ESTIMATE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "revision_requested", label: "Revision Requested" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "expired", label: "Expired" },
  { value: "void", label: "Void" },
  { value: "superseded", label: "Superseded" },
] as const;

export function getEstimateStatusBadgeClass(statusValue: string) {
  const styles: Record<string, string> = {
    draft: "bg-slate-100 text-slate-700 ring-slate-500/20",
    ready: "bg-blue-50 text-blue-700 ring-blue-600/20",
    sent: "bg-indigo-50 text-indigo-700 ring-indigo-600/20",
    viewed: "bg-cyan-50 text-cyan-700 ring-cyan-600/20",
    revision_requested: "bg-amber-50 text-amber-700 ring-amber-600/20",
    approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
    expired: "bg-orange-50 text-orange-700 ring-orange-600/20",
    void: "bg-zinc-100 text-zinc-700 ring-zinc-500/20",
    superseded: "bg-purple-50 text-purple-700 ring-purple-600/20",
  };

  return styles[statusValue] || styles.draft;
}
