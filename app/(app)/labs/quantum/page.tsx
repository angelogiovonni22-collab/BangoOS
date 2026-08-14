"use client";

import {
  CompanyPulse,
  QuantumActionCard,
  QuantumDigitalTwinPlaceholder,
  QuantumHero,
  QuantumMetricStrip,
  QuantumOrionPriority,
  QuantumPanel,
  QuantumShell,
  QuantumTimeline,
} from "@/components/labs/quantum";
import { useMotionPreferences } from "@/components/motion";
import {
  quantumActions,
  quantumCompanyState,
  quantumInsights,
  quantumMetrics,
  quantumTimeline,
  quantumTwinLinks,
  quantumTwinNodes,
} from "@/lib/labs/quantum/fixtures";
import styles from "./quantum-lab.module.css";

export default function QuantumLabPage() {
  const { reducedMotion } = useMotionPreferences();

  return (
    <div className={styles.root}>
      <div className={styles.gridGlow} aria-hidden="true" />

      <QuantumShell reducedMotion={reducedMotion}>
        <QuantumHero state={quantumCompanyState} />

        <div className="mb-5 rounded-xl border border-[var(--q-border)] bg-[color:color-mix(in_oklab,var(--q-surface)_88%,black)] p-3 text-sm text-[var(--q-text-muted)]">
          <p>
            Lab guardrails: fixture-only data, read-only interactions, no Supabase imports, and no writes. This surface is intentionally isolated from production modules.
          </p>
          <div className="mt-3">
            <div className={styles.kineticRail}>
              <div className={styles.kineticRailInner} />
            </div>
          </div>
        </div>

        <CompanyPulse state={quantumCompanyState} reducedMotion={reducedMotion} />

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
          <QuantumPanel
            title="Future Digital Twin"
            subtitle="Projects, crews, equipment, and operations links with selectable focus"
            variant="elevated"
          >
            <QuantumDigitalTwinPlaceholder nodes={quantumTwinNodes} links={quantumTwinLinks} />
          </QuantumPanel>

          <QuantumPanel
            title="Orion Priorities"
            subtitle="Top observation, impact, evidence quality, and recommended next step"
            variant="orion"
          >
            <QuantumOrionPriority insights={quantumInsights} reducedMotion={reducedMotion} />
          </QuantumPanel>
        </div>

        <div className="mt-5">
          <QuantumMetricStrip metrics={quantumMetrics} />
        </div>

        <div className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <QuantumPanel
            title="Operational Timeline"
            subtitle="Deterministic events rendered from static fixtures"
            variant="grouped"
          >
            <QuantumTimeline items={quantumTimeline} reducedMotion={reducedMotion} />
          </QuantumPanel>

          <QuantumPanel
            title="Priority Actions"
            subtitle="Action queue prototype for execution modeling"
            variant="focused"
          >
            <div className="space-y-3">
              {quantumActions.map((action) => (
                <QuantumActionCard key={action.id} action={action} />
              ))}
            </div>
          </QuantumPanel>
        </div>

        <style jsx global>{`
          @keyframes quantum-breathe {
            0% { opacity: 0.55; transform: scaleX(0.96); }
            50% { opacity: 1; transform: scaleX(1); }
            100% { opacity: 0.55; transform: scaleX(0.96); }
          }

          @keyframes quantum-rise {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </QuantumShell>
    </div>
  );
}
