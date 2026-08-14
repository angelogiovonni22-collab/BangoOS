import { RefreshCcw } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { CommandCenterFocusFilter, SummaryMetricTone } from "@/lib/operations";

type CommandCenterHeaderProps = {
  companyName: string;
  currentDateLabel: string;
  lastRefreshedLabel: string;
  operatingStatus: {
    label: string;
    tone: SummaryMetricTone;
  };
  healthIndicator: {
    score: number;
    label: string;
  };
  orionState: "ready" | "limited" | "attention" | null;
  focusFilter: CommandCenterFocusFilter;
  isRefreshing: boolean;
  onFocusFilterChange: (value: CommandCenterFocusFilter) => void;
  onRefresh: () => void;
};

const FILTERS: Array<{ id: CommandCenterFocusFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "today", label: "Today" },
  { id: "projects", label: "Projects" },
  { id: "workforce", label: "Workforce" },
  { id: "approvals", label: "Approvals" },
];

export function CommandCenterHeader({
  companyName,
  currentDateLabel,
  lastRefreshedLabel,
  operatingStatus,
  healthIndicator,
  orionState,
  focusFilter,
  isRefreshing,
  onFocusFilterChange,
  onRefresh,
}: CommandCenterHeaderProps) {
  return (
    <Card as="section" variant="elevated">
      <CardHeader className="bg-[var(--color-surface-subtle)]/45">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[var(--color-brand-700)]">Operations Overview</p>
            <div>
              <CardTitle className="text-h2">{companyName}</CardTitle>
              <p className="mt-2 text-body text-[var(--color-text-secondary)]">Live executive operations view for projects, workforce, schedule pressure, approvals, and activity.</p>
            </div>

            <div className="flex flex-wrap gap-2 text-sm text-[var(--color-text-secondary)]">
              <Badge tone={toneToBadge(operatingStatus.tone)}>{operatingStatus.label}</Badge>
              <Badge tone={healthIndicator.score >= 80 ? "success" : healthIndicator.score >= 65 ? "warning" : "danger"}>Company health {healthIndicator.score}/100</Badge>
              <Badge tone={orionState === "ready" ? "success" : orionState === "attention" ? "warning" : "info"}>Orion {formatOrionState(orionState)}</Badge>
            </div>
          </div>

          <div className="space-y-3 xl:w-[340px]">
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-white px-4 py-3 shadow-[var(--shadow-small)]">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Current date</p>
              <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{currentDateLabel}</p>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">Last refreshed {lastRefreshedLabel}</p>
            </div>

            <Button type="button" fullWidth onClick={onRefresh} disabled={isRefreshing}>
              <RefreshCcw className="h-4 w-4" />
              {isRefreshing ? "Refreshing..." : "Refresh"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Focus filter</p>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onFocusFilterChange(filter.id)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]",
                focusFilter === filter.id
                  ? "border-[var(--color-brand-600)] bg-[var(--color-brand-600)] text-white"
                  : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]",
              ].join(" ")}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function toneToBadge(tone: SummaryMetricTone) {
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
  return "info";
}

function formatOrionState(value: "ready" | "limited" | "attention" | null) {
  if (value === "ready") {
    return "Ready";
  }
  if (value === "attention") {
    return "Needs attention";
  }
  if (value === "limited") {
    return "Limited";
  }
  return "Unavailable";
}