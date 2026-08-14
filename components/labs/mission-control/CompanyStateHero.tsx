import type { CompanyState } from "@/lib/labs/mission-control/types";
import { DataTrustIndicator } from "./DataTrustIndicator";

type CompanyStateHeroProps = {
  companyState: CompanyState;
};

export function CompanyStateHero({ companyState }: CompanyStateHeroProps) {
  return (
    <section aria-labelledby="mc-hero-heading" className="rounded-3xl bg-[linear-gradient(160deg,rgba(25,44,70,0.95),rgba(14,28,46,0.97))] px-5 py-6 sm:px-7 sm:py-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--mc-info)]">B.O.S.</p>
      <p className="mt-1 text-xs font-medium tracking-[0.11em] text-[var(--mc-text-muted)]">Bango Operating System</p>
      <h1 id="mc-hero-heading" className="mt-3 text-3xl font-semibold tracking-tight text-[var(--mc-text)] sm:text-4xl">
        {companyState.greeting}
      </h1>
      <p className="mt-2 text-base font-medium text-[var(--mc-text)]">{companyState.companyName}</p>
      <p className="mt-3 text-lg font-semibold text-[var(--mc-text)]">{companyState.stateLabel}</p>
      <p className="mt-2 max-w-3xl text-sm text-[var(--mc-text-muted)]">{companyState.summary}</p>
      <div className="mt-4 rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-orion)_40%,var(--mc-border))] bg-[color:color-mix(in_oklab,var(--mc-surface)_82%,black)] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--mc-orion)]">Primary Orion Statement</p>
        <p className="mt-1 text-sm text-[var(--mc-text)]">{companyState.primaryOrionStatement}</p>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
        <p className="text-sm font-medium text-[var(--mc-text-muted)]">Scenario: {companyState.scenarioLabel}</p>
        <DataTrustIndicator companyState={companyState} />
      </div>
    </section>
  );
}
