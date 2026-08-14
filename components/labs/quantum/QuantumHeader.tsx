import { QuantumButton } from "./QuantumButton";

type QuantumHeaderProps = {
  title: string;
  subtitle: string;
};

export function QuantumHeader({ title, subtitle }: QuantumHeaderProps) {
  return (
    <header className="mb-5 rounded-2xl border border-[var(--q-border)] bg-[color:color-mix(in_oklab,var(--q-surface)_90%,black)] p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--q-info)]">Experimental Lab</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--q-text)] sm:text-3xl">{title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-[var(--q-text-muted)]">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <QuantumButton variant="secondary">View Storyboard</QuantumButton>
          <QuantumButton>Stage Snapshot</QuantumButton>
        </div>
      </div>
    </header>
  );
}
