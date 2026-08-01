import Link from "next/link";
import { SummaryCard } from "@/components/ui";
import type { OperationsSummaryMetric } from "@/lib/operations";
import { Activity, AlertTriangle, CalendarClock, Camera, ClipboardList, FolderKanban, Settings2, Truck, TriangleAlert, Users } from "lucide-react";

type OperationsSummaryProps = {
  metrics: OperationsSummaryMetric[];
};

const ICONS: Record<OperationsSummaryMetric["id"], React.ReactNode> = {
  activeProjects: <FolderKanban />,
  projectsAtRisk: <TriangleAlert />,
  tasksDueToday: <ClipboardList />,
  overdueTasks: <AlertTriangle />,
  assignedWorkforce: <Users />,
  unassignedWork: <Users />,
  scheduleEventsToday: <CalendarClock />,
  pendingApprovals: <ClipboardList />,
  newSitecamActivity: <Camera />,
  operationalAlerts: <Activity />,
  equipmentInUse: <Truck />,
  equipmentMaintenanceDue: <Settings2 />,
  equipmentConflicts: <AlertTriangle />,
};

export function OperationsSummary({ metrics }: OperationsSummaryProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <Link key={metric.id} href={metric.href} className="block focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)] rounded-[var(--radius-xl)]">
          <SummaryCard
            icon={ICONS[metric.id]}
            label={metric.label}
            value={metric.value === null ? "Unavailable" : String(metric.value)}
            context={metric.description}
            tone={toSummaryTone(metric.tone)}
            compact
          />
        </Link>
      ))}
    </section>
  );
}

function toSummaryTone(tone: OperationsSummaryMetric["tone"]) {
  if (tone === "success") {
    return "success";
  }
  if (tone === "warning") {
    return "warning";
  }
  if (tone === "danger") {
    return "danger";
  }
  if (tone === "muted") {
    return "neutral";
  }
  return "brand";
}