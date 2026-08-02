import type { QuantumInsight } from "@/lib/labs/quantum/types";
import { QuantumInsightCard } from "./QuantumInsightCard";

type QuantumOrionPriorityProps = {
  insights: QuantumInsight[];
  reducedMotion: boolean;
};

export function QuantumOrionPriority({ insights, reducedMotion }: QuantumOrionPriorityProps) {
  const [topInsight, ...supportingInsights] = insights;

  if (!topInsight) {
    return null;
  }

  return (
    <section aria-labelledby="quantum-orion-heading" className="space-y-3">
      <header>
        <h2 id="quantum-orion-heading" className="text-lg font-semibold tracking-tight text-[var(--q-text)]">Orion Priorities</h2>
        <p className="text-sm text-[var(--q-text-muted)]">Intelligence layer for what needs attention and why.</p>
      </header>

      <QuantumInsightCard insight={topInsight} reducedMotion={reducedMotion} />

      {supportingInsights.length > 0 ? (
        <div className="rounded-xl bg-[color:color-mix(in_oklab,var(--q-surface)_72%,black)] p-3">
          <h3 className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--q-text-muted)]">Additional Signals</h3>
          <ul className="mt-2 space-y-2 text-sm">
            {supportingInsights.map((insight) => (
              <li key={insight.id} className="text-[var(--q-text)]">
                {insight.topObservation}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
