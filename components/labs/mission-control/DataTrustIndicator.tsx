import type { CompanyState } from "@/lib/labs/mission-control/types";
import { MissionStatusPill } from "./MissionStatusPill";
import { freshnessSeverity } from "./mission-theme";

type DataTrustIndicatorProps = {
  companyState: CompanyState;
};

export function DataTrustIndicator({ companyState }: DataTrustIndicatorProps) {
  const confidenceTone = companyState.completenessPercent < 85 ? "unknown" : companyState.completenessPercent < 92 ? "attention" : "healthy";

  return (
    <section
      className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-border)_76%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface)_72%,black)] p-3"
      aria-label="Data trust summary"
    >
      <div className="flex flex-wrap items-center gap-2">
        <MissionStatusPill label={`Freshness: ${companyState.freshness}`} severity={freshnessSeverity(companyState.freshness)} />
        <MissionStatusPill label={`Completeness: ${companyState.completenessPercent}%`} severity={confidenceTone} />
        <MissionStatusPill label="Fixture-only" severity="orion" />
      </div>
      <p className="mt-2 text-sm text-[var(--mc-text-muted)]">
        This operations overview pilot is deterministic fixture data with read-only advisory interactions.
      </p>
    </section>
  );
}
