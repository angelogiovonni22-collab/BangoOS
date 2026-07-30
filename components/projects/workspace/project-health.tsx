import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { WorkspaceHealthItem } from "./types";

type ProjectHealthProps = {
  items: WorkspaceHealthItem[];
  overallHealth: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectHealth({ items, overallHealth, t }: ProjectHealthProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/50">
        <CardTitle>{t("projects.workspaceProjectHealth")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-center justify-between gap-3 rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-4 py-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">
              {t("projects.workspaceOverallHealth")}
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t("projects.workspaceOverallHealthDescription")}</p>
          </div>
          <Badge tone="brand">{overallHealth}</Badge>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {items.map((item) => (
            <HealthTile key={item.label} item={item} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function HealthTile({ item }: { item: WorkspaceHealthItem }) {
  const toneClass: Record<WorkspaceHealthItem["tone"], string> = {
    success: "bg-[var(--color-success-50)] text-[var(--color-success-700)]",
    warning: "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]",
    danger: "bg-[var(--color-danger-50)] text-[var(--color-danger-700)]",
    neutral: "bg-[var(--color-neutral-100)] text-[var(--color-text-secondary)]",
  };

  return (
    <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{item.label}</p>
          <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">{item.value}</p>
        </div>
        <Badge tone={toBadgeTone(item.tone)}>{item.value}</Badge>
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
      <div className={`mt-3 h-2 rounded-full ${toneClass[item.tone]}`} aria-hidden="true" />
    </div>
  );
}

function toBadgeTone(tone: WorkspaceHealthItem["tone"]): "neutral" | "brand" | "success" | "warning" | "danger" | "info" {
  if (tone === "success") {
    return "success";
  }

  if (tone === "warning") {
    return "warning";
  }

  if (tone === "danger") {
    return "danger";
  }

  return "neutral";
}
