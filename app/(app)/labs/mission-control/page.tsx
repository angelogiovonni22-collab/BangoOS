"use client";

import { useMemo, useState } from "react";
import { useMotionPreferences } from "@/components/motion";
import {
  CompanyPulsePrime,
  CompanyStateHero,
  MissionControlScenarioSwitcher,
  MissionControlShell,
  MissionDigitalTwin,
  MissionTimeline,
  OperationalMetricCluster,
  OrionPriorityRail,
  PriorityActionQueue,
} from "@/components/labs/mission-control";
import { missionControlScenarios, missionScenarioOrder } from "@/lib/labs/mission-control/fixtures";
import type { MissionScenarioId } from "@/lib/labs/mission-control/types";
import styles from "./mission-control.module.css";

export default function MissionControlPage() {
  const { reducedMotion } = useMotionPreferences();
  const [scenarioId, setScenarioId] = useState<MissionScenarioId>("normal-operations");

  const scenario = missionControlScenarios[scenarioId];
  const scenarioList = useMemo(() => missionScenarioOrder.map((id) => missionControlScenarios[id]), []);

  return (
    <div className={styles.root}>
      <div className={styles.gridGlow} aria-hidden="true" />

      <MissionControlShell reducedMotion={reducedMotion}>
        <div className={styles.firstViewport}>
          <MissionControlScenarioSwitcher selected={scenarioId} scenarios={scenarioList} onChange={setScenarioId} />

          <CompanyStateHero companyState={scenario.companyState} />

          <div className="rounded-xl border border-[var(--mc-border)] bg-[color:color-mix(in_oklab,var(--mc-surface)_88%,black)] p-3 text-sm text-[var(--mc-text-muted)]">
            <p>
              Lab guardrails: fixture-only data, read-only recommendations, no Supabase imports, no production services, and no write actions.
            </p>
            <div className="mt-3">
              <div className={styles.kineticRail} aria-hidden="true">
                <div className={styles.kineticRailInner} />
              </div>
            </div>
          </div>

          <div className={styles.primaryColumns}>
            <CompanyPulsePrime companyState={scenario.companyState} reducedMotion={reducedMotion} />
            <OrionPriorityRail priorities={scenario.priorities} reducedMotion={reducedMotion} />
          </div>
        </div>

        <div className="mt-5 space-y-5">
          <MissionDigitalTwin nodes={scenario.twinNodes} links={scenario.twinLinks} />

          <OperationalMetricCluster metrics={scenario.metrics} />

          <div className={styles.secondaryColumns}>
            <MissionTimeline events={scenario.timeline} reducedMotion={reducedMotion} />
            <PriorityActionQueue actions={scenario.actions} />
          </div>
        </div>

        <style jsx global>{`
          @keyframes mc-rise {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </MissionControlShell>
    </div>
  );
}
