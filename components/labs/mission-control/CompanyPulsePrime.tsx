import { AnimatedProgress } from "@/components/motion";
import type { CompanyState } from "@/lib/labs/mission-control/types";
import { MissionStatusPill } from "./MissionStatusPill";
import { freshnessSeverity } from "./mission-theme";

type CompanyPulsePrimeProps = {
  companyState: CompanyState;
  reducedMotion: boolean;
};

export function CompanyPulsePrime({ companyState, reducedMotion }: CompanyPulsePrimeProps) {
  const completenessSeverity = companyState.completenessPercent < 85 ? "unknown" : companyState.completenessPercent < 92 ? "attention" : "healthy";
  const scoreSeverity =
    companyState.healthScore >= 85 ? "healthy" :
      companyState.healthScore >= 75 ? "info" :
        companyState.healthScore >= 65 ? "attention" : "critical";

  const summaryText = `Company Pulse ${companyState.healthScore} of 100. ${companyState.stateLabel}. Trend ${companyState.trend}. Freshness ${companyState.freshness}. Data completeness ${companyState.completenessPercent} percent.`;

  return (
    <section
      aria-labelledby="mc-company-pulse-heading"
      aria-label={summaryText}
      className="rounded-3xl border border-[color:color-mix(in_oklab,var(--mc-border)_74%,transparent)] bg-[linear-gradient(155deg,rgba(22,39,63,0.95),rgba(14,27,45,0.96))] p-5 sm:p-6"
    >
      <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--mc-text-muted)]">Company Pulse Prime</p>
          <h2 id="mc-company-pulse-heading" className="mt-2 text-4xl font-semibold tracking-tight text-[var(--mc-text)]">
            {companyState.healthScore}
            <span className="ml-2 text-lg font-medium text-[var(--mc-text-muted)]">/ 100</span>
          </h2>
          <p className="mt-2 text-base text-[var(--mc-text)]">{companyState.stateLabel}</p>
          <p className="mt-1 text-sm text-[var(--mc-text-muted)]">Trend: {companyState.trend}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <MissionStatusPill label={`Score`} severity={scoreSeverity} />
            <MissionStatusPill label={`Freshness: ${companyState.freshness}`} severity={freshnessSeverity(companyState.freshness)} />
            <MissionStatusPill label={`Completeness: ${companyState.completenessPercent}%`} severity={completenessSeverity} />
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--mc-text-muted)]">Pulse confidence envelope</p>
            <AnimatedProgress
              value={companyState.healthScore}
              durationMs={reducedMotion ? 0 : 260}
              className="rounded-full bg-[color:color-mix(in_oklab,var(--mc-surface-2)_68%,black)]"
              fillClassName="bg-[linear-gradient(90deg,var(--mc-healthy),var(--mc-info),var(--mc-attention))]"
            />
          </div>
        </div>

        <div className="space-y-3">
          {companyState.dimensions.map((dimension) => (
            <article key={dimension.id} className="rounded-2xl bg-[color:color-mix(in_oklab,var(--mc-surface-2)_72%,black)] px-3.5 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-[var(--mc-text)]">{dimension.label}</p>
                <MissionStatusPill label={dimension.status} severity={dimension.status} />
              </div>
              <p className="mt-1 text-sm font-semibold text-[var(--mc-text)]">{dimension.value}</p>
              <p className="mt-1 text-xs text-[var(--mc-text-muted)]">{dimension.trend} • Freshness: {dimension.freshness}</p>
            </article>
          ))}

          <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-attention)_50%,var(--mc-border))] bg-[color:color-mix(in_oklab,var(--mc-surface)_84%,black)] p-3">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--mc-attention)]">Known limitations</p>
            {companyState.limitations.length > 0 ? (
              <ul className="mt-2 space-y-1 text-sm text-[var(--mc-text-muted)]">
                {companyState.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-[var(--mc-text-muted)]">No active fixture limitations.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
