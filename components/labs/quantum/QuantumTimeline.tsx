import type { QuantumTimelineEvent } from "@/lib/labs/quantum/types";
import { QuantumStatus } from "./QuantumStatus";

type QuantumTimelineProps = {
  items: QuantumTimelineEvent[];
  reducedMotion: boolean;
};

export function QuantumTimeline({ items, reducedMotion }: QuantumTimelineProps) {
  return (
    <ol className="space-y-3" aria-label="Operational timeline">
      {items.map((item, index) => (
        <li
          key={item.id}
          className={[
            "rounded-xl border border-[var(--q-border)] bg-[color:color-mix(in_oklab,var(--q-surface)_86%,black)] p-3",
            reducedMotion ? "" : "animate-[quantum-rise_320ms_ease-out_both]",
          ].join(" ")}
          style={reducedMotion ? undefined : { animationDelay: `${index * 60}ms` }}
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-[var(--q-text)]">{item.title}</p>
              <p className="mt-1 text-sm text-[var(--q-text-muted)]">{item.detail}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--q-text-muted)]">{item.at}</p>
              <div className="mt-2">
                <QuantumStatus tone={item.status} label={item.status} />
              </div>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
