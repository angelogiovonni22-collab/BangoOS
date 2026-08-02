import type { QuantumCompanyState } from "@/lib/labs/quantum/types";
import { QuantumStatus } from "./QuantumStatus";

type QuantumHeroProps = {
  state: QuantumCompanyState;
};

export function QuantumHero({ state }: QuantumHeroProps) {
  return (
    <section aria-labelledby="quantum-hero-heading" className="rounded-3xl bg-[linear-gradient(165deg,rgba(24,41,66,0.96),rgba(13,25,42,0.96))] px-5 py-6 sm:px-7 sm:py-7">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--q-info)]">B.O.S. Quantum Lab · Executive View</p>
      <p className="mt-1 text-xs font-medium tracking-[0.12em] text-[var(--q-text-muted)]">Bango Operating System</p>
      <h1 id="quantum-hero-heading" className="mt-2 text-3xl font-semibold tracking-tight text-[var(--q-text)] sm:text-4xl">
        {state.executiveGreeting}
      </h1>
      <p className="mt-2 text-base text-[var(--q-text)]">{state.companyName}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <QuantumStatus tone="orion" label="Fixture-only simulation" />
        <QuantumStatus tone="info" label="Read-only surface" />
      </div>
      <p className="mt-4 max-w-3xl text-sm text-[var(--q-text-muted)]">
        Lab guardrails: fixture-only data, no Supabase imports, no production service integration, and no writes.
      </p>
    </section>
  );
}
