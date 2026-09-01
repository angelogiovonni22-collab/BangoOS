"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Ruler, SquareDashed } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadBlueprintTakeoffSummary, type BlueprintTakeoffSummary } from "@/lib/blueprints/takeoff-register";

const empty: BlueprintTakeoffSummary = { distances: 0, areas: 0, linearFeet: 0, squareFeet: 0, linked: 0, unlinked: 0 };

export function BlueprintTakeoffRegister({ companyId, projectId }: { companyId: string; projectId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [summary, setSummary] = useState(empty);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void loadBlueprintTakeoffSummary(supabase, { companyId, projectId })
      .then((next) => { if (active) setSummary(next); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Could not load Blueprint takeoffs."); });
    return () => { active = false; };
  }, [companyId, projectId, supabase]);

  if (error) {
    return <p role="alert" className="rounded-[var(--radius-lg)] border border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-2 text-xs font-semibold text-[var(--color-danger-700)]">{error}</p>;
  }

  const cards = [
    { label: "Distance takeoffs", value: summary.distances, detail: `${summary.linearFeet.toFixed(2)} linear ft`, icon: Ruler },
    { label: "Area takeoffs", value: summary.areas, detail: `${summary.squareFeet.toFixed(2)} sq ft`, icon: SquareDashed },
    { label: "Estimate coverage", value: summary.linked, detail: summary.unlinked ? `${summary.unlinked} awaiting estimate linkage` : "All takeoffs linked", icon: Calculator },
  ];

  return (
    <section aria-label="Blueprint takeoff register" data-orion-region="blueprint-takeoff-register" className="grid gap-3 sm:grid-cols-3">
      {cards.map((card) => (
        <article key={card.label} className="rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3.5 shadow-[var(--shadow-small)]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--color-brand-500)]/35 bg-[var(--color-brand-500)]/10 text-[var(--orion-cyan)]">
              <card.icon size={16} aria-hidden="true" />
            </span>
            <strong className="text-lg text-[var(--color-text-primary)]">{card.value}</strong>
          </div>
          <p className="mt-2 text-xs font-bold text-[var(--color-text-primary)]">{card.label}</p>
          <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">{card.detail}</p>
        </article>
      ))}
    </section>
  );
}
