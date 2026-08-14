import type { QuantumAction } from "@/lib/labs/quantum/types";
import { QuantumStatus } from "./QuantumStatus";

type QuantumActionCardProps = {
  action: QuantumAction;
};

export function QuantumActionCard({ action }: QuantumActionCardProps) {
  return (
    <article className="rounded-xl border border-[var(--q-border)] bg-[color:color-mix(in_oklab,var(--q-surface)_88%,black)] p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--q-text)]">{action.title}</h3>
        <QuantumStatus tone={action.status} label={action.status} />
      </div>
      <p className="mt-2 text-sm text-[var(--q-text-muted)]">{action.impact}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--q-text-muted)]">
        <div>
          <dt className="uppercase tracking-[0.08em]">Owner</dt>
          <dd className="mt-1 text-[var(--q-text)]">{action.owner}</dd>
        </div>
        <div>
          <dt className="uppercase tracking-[0.08em]">Due</dt>
          <dd className="mt-1 text-[var(--q-text)]">{action.due}</dd>
        </div>
      </dl>
    </article>
  );
}
