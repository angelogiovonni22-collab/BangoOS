"use client";

import { AlertTriangle, CheckCircle2, Clock3, FolderKanban } from "lucide-react";

type ProjectsPageKpiProps = {
  label: string;
  value: string;
  tone: "brand" | "warning" | "danger" | "success";
  selected?: boolean;
  onClick: () => void;
};

const iconByTone = {
  brand: FolderKanban,
  warning: Clock3,
  danger: AlertTriangle,
  success: CheckCircle2,
} as const;

const accentByTone = {
  brand: "bg-blue-500/15 text-blue-300 ring-blue-400/30",
  warning: "bg-amber-500/15 text-amber-300 ring-amber-400/30",
  danger: "bg-rose-500/15 text-rose-300 ring-rose-400/30",
  success: "bg-emerald-500/15 text-emerald-300 ring-emerald-400/30",
} as const;

export function ProjectsPageKpi({ label, value, tone, selected = false, onClick }: ProjectsPageKpiProps) {
  const Icon = iconByTone[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`group w-full rounded-[var(--radius-xl)] border bg-[var(--color-surface-card)] px-4 py-4 text-left shadow-[var(--shadow-small)] transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-brand-500)] hover:shadow-[var(--shadow-card)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)] ${selected ? "border-[var(--color-brand-500)] ring-1 ring-[var(--color-brand-500)]/35" : "border-[var(--color-border-subtle)]"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[var(--color-text-primary)]">{value}</p>
        </div>
        <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ${accentByTone[tone]}`} aria-hidden="true">
          <Icon size={19} />
        </span>
      </div>
      <p className="mt-3 text-xs font-medium text-[var(--color-text-secondary)] transition group-hover:text-[var(--color-text-primary)]">
        {selected ? "Showing matching projects" : "Click to filter projects"}
      </p>
    </button>
  );
}
