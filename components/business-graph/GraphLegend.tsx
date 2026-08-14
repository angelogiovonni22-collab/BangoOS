"use client";

const ITEMS = [
  { key: "company", label: "Company root", color: "bg-blue-100" },
  { key: "project", label: "Project chain", color: "bg-sky-100" },
  { key: "financial", label: "Financial dependency", color: "bg-orange-100" },
  { key: "documents", label: "Documents and photos", color: "bg-teal-100" },
] as const;

export function GraphLegend() {
  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white p-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ITEMS.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full border border-[var(--color-border-subtle)] ${item.color}`} aria-hidden="true" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">{item.label}</span>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--color-text-secondary)]">
        <span>Hover highlights connected paths.</span>
        <span>Click opens the read-only inspector.</span>
        <span>Dashed lines mark dependency-sensitive relationships.</span>
      </div>
    </div>
  );
}
