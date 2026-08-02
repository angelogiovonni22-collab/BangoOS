import type { QuantumPulseDimension as QuantumPulseDimensionData } from "@/lib/labs/quantum/types";
import { QuantumStatus } from "./QuantumStatus";

type QuantumPulseDimensionProps = {
  dimension: QuantumPulseDimensionData;
};

export function QuantumPulseDimension({ dimension }: QuantumPulseDimensionProps) {
  return (
    <article className="rounded-2xl bg-[color:color-mix(in_oklab,var(--q-surface-2)_74%,black)] px-3.5 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--q-text)]">{dimension.label}</p>
        <QuantumStatus tone={dimension.status} label={dimension.status} />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-[var(--q-text)]">{dimension.value}</span>
        <span className="text-[var(--q-text-muted)]">{dimension.trend}</span>
        <span className="text-[var(--q-text-muted)]">•</span>
        <span className="text-[var(--q-text-muted)]">Freshness: {dimension.freshness}</span>
      </div>
    </article>
  );
}
