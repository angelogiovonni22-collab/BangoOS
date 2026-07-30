import { Activity, AlertTriangle, CheckCircle2, FolderKanban } from "lucide-react";
import type { ReactNode } from "react";
import { SummaryCard } from "@/components/ui";

type ProjectMetric = {
  label: string;
  value: number;
  context: string;
  icon: ReactNode;
  tone: "info" | "brand" | "success" | "warning";
};

type ProjectMetricsProps = {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  overdueProjects: number;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectMetrics({
  totalProjects,
  activeProjects,
  completedProjects,
  overdueProjects,
  t,
}: ProjectMetricsProps) {
  const metrics: ProjectMetric[] = [
    {
      label: t("projects.summaryTotal"),
      value: totalProjects,
      context: t("projects.metricsAllProjects"),
      icon: <FolderKanban size={16} aria-hidden="true" />,
      tone: "info",
    },
    {
      label: t("projects.summaryActive"),
      value: activeProjects,
      context: t("projects.metricsInFlight"),
      icon: <Activity size={16} aria-hidden="true" />,
      tone: "brand",
    },
    {
      label: t("projects.summaryCompleted"),
      value: completedProjects,
      context: t("projects.metricsDelivered"),
      icon: <CheckCircle2 size={16} aria-hidden="true" />,
      tone: "success",
    },
    {
      label: t("projects.summaryOverdue"),
      value: overdueProjects,
      context: t("projects.metricsNeedsAttention"),
      icon: <AlertTriangle size={16} aria-hidden="true" />,
      tone: "warning",
    },
  ];

  return (
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("projects.metricsSection")}>
      {metrics.map((metric) => (
        <SummaryCard
          key={metric.label}
          icon={metric.icon}
          label={metric.label}
          value={String(metric.value)}
          context={metric.context}
          tone={metric.tone}
        />
      ))}
    </section>
  );
}
