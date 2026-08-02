import type { QuantumCompanyState } from "@/lib/labs/quantum/types";
import { QuantumPulseDimension } from "./QuantumPulseDimension";
import { QuantumStatus } from "./QuantumStatus";

type CompanyPulseProps = {
  state: QuantumCompanyState;
  reducedMotion: boolean;
};

function freshnessTone(freshness: QuantumCompanyState["freshness"]) {
  if (freshness === "live") {
    return "healthy";
  }

  if (freshness === "delayed") {
    return "attention";
  }

  if (freshness === "stale") {
    return "critical";
  }

  return "info";
}

export function CompanyPulse({ state, reducedMotion }: CompanyPulseProps) {
  return (
    <section
      aria-labelledby="quantum-company-pulse-heading"
      className="rounded-3xl border border-[color:color-mix(in_oklab,var(--q-border)_74%,transparent)] bg-[linear-gradient(155deg,rgba(23,40,66,0.95),rgba(14,28,47,0.96))] px-5 py-5 sm:px-6 sm:py-6"
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_1fr]">
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--q-text-muted)]">Company Pulse</p>
          <h2 id="quantum-company-pulse-heading" className="text-3xl font-semibold tracking-tight text-[var(--q-text)] sm:text-4xl">
            {state.healthScore}
            <span className="ml-2 text-lg font-medium text-[var(--q-text-muted)]">/ 100</span>
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <QuantumStatus tone={freshnessTone(state.freshness)} label={`Freshness: ${state.freshness}`} />
            <QuantumStatus tone="orion" label={state.healthLabel} />
          </div>

          <p className="text-base text-[var(--q-text)]">{state.directionalTrend}</p>

          <div className="rounded-full bg-[color:color-mix(in_oklab,var(--q-surface)_58%,black)] p-1.5" aria-hidden="true">
            <div className="h-2.5 rounded-full bg-[linear-gradient(90deg,var(--q-healthy),var(--q-info),var(--q-attention))]" style={{ width: `${state.healthScore}%` }} />
          </div>

          <div
            className={[
              "h-1.5 w-24 rounded-full bg-[linear-gradient(90deg,var(--q-info),var(--q-orion))]",
              reducedMotion ? "" : "animate-[quantum-breathe_6s_ease-in-out_infinite]",
            ].join(" ")}
            aria-hidden="true"
          />
        </div>

        <div className="space-y-3">
          {state.dimensions.map((dimension) => (
            <QuantumPulseDimension key={dimension.id} dimension={dimension} />
          ))}

          {state.limitations.length > 0 ? (
            <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--q-attention)_56%,var(--q-border))] bg-[color:color-mix(in_oklab,var(--q-surface)_84%,black)] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--q-attention)]">Known Limits in This Fixture Snapshot</p>
              <ul className="mt-2 space-y-1 text-sm text-[var(--q-text-muted)]">
                {state.limitations.map((limitation) => (
                  <li key={limitation}>{limitation}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
