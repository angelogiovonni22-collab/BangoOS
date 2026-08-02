import type { QuantumInsight } from "@/lib/labs/quantum/types";
import { QuantumStatus } from "./QuantumStatus";

type QuantumInsightCardProps = {
  insight: QuantumInsight;
  reducedMotion: boolean;
};

export function QuantumInsightCard({ insight, reducedMotion }: QuantumInsightCardProps) {
  return (
    <article className="rounded-2xl border border-[color:color-mix(in_oklab,var(--q-orion)_55%,var(--q-border))] bg-[linear-gradient(160deg,rgba(30,38,71,0.94),rgba(20,34,58,0.96))] p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold uppercase tracking-[0.09em] text-[var(--q-text)]">Orion Priority</h3>
        <QuantumStatus tone={insight.status} label={insight.status} />
      </div>
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">Top Observation</dt>
          <dd className="mt-1 text-base font-medium text-[var(--q-text)]">{insight.topObservation}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">Why It Matters</dt>
          <dd className="mt-1 text-[var(--q-text)]">{insight.whyItMatters}</dd>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">Confidence</dt>
            <dd className="mt-1 text-[var(--q-text)]">{insight.confidence}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">Evidence Quality</dt>
            <dd className="mt-1 text-[var(--q-text)]">{insight.evidenceQuality}</dd>
          </div>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">Recommended Next Step</dt>
          <dd className="mt-1 text-[var(--q-text)]">{insight.nextStep}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">Limitations / Missing Data</dt>
          <dd className="mt-1">
            <ul className="space-y-1 text-[var(--q-text-muted)]">
              {insight.limitations.map((limitation) => (
                <li key={limitation}>{limitation}</li>
              ))}
            </ul>
          </dd>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--q-text-muted)]">
          <span
            aria-hidden="true"
            className={[
              "inline-block h-1.5 w-1.5 rounded-full bg-[var(--q-orion)]",
              reducedMotion ? "" : "animate-[quantum-breathe_7s_ease-in-out_infinite]",
            ].join(" ")}
          />
          <span>Orion status indicator: active inference view (fixture simulation)</span>
        </div>
      </dl>
    </article>
  );
}
