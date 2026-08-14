"use client";

import { useEffect, useMemo, useState } from "react";
import { useMotionPreferences } from "@/components/motion";
import { orionCoreScenarios, orionCoreScenarioOrder, type OrionCoreStateId } from "@/lib/labs/orion-core";
import { OrionCoreButton } from "./OrionCoreButton";
import { OrionCorePanel } from "./OrionCorePanel";
import { OrionParticleSphere } from "./OrionParticleSphere";
import { OrionCoreScenarioSwitcher } from "./OrionCoreScenarioSwitcher";
import { OrionStateLegend } from "./OrionStateLegend";

const DEFAULT_SCENARIO: OrionCoreStateId = "READY";

export function OrionCore() {
  const { reducedMotion } = useMotionPreferences();
  const [scenarioId, setScenarioId] = useState<OrionCoreStateId>(DEFAULT_SCENARIO);
  const [open, setOpen] = useState(false);
  const [isPageVisible, setIsPageVisible] = useState(true);

  const panelId = "orion-core-panel";

  useEffect(() => {
    const onVisibility = () => {
      setIsPageVisible(document.visibilityState !== "hidden");
    };

    onVisibility();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (scenarioId !== "NEW_INSIGHT") {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setScenarioId("READY");
    }, 1900);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [scenarioId]);

  const scenario = useMemo(() => orionCoreScenarios[scenarioId], [scenarioId]);
  const previewReducedMotion = scenarioId === "REDUCED_MOTION";
  const effectiveReducedMotion = reducedMotion || previewReducedMotion;

  return (
    <section className="oc-demo" aria-labelledby="orion-core-demo-heading">
      <div className="oc-showcase" data-live={scenario.id}>
        <h2 id="orion-core-demo-heading">Orion Core Showcase</h2>
        <p>
          Orion Core presents living intelligence cues through calm motion, semantic ring states,
          and a compact review panel.
        </p>

        <OrionParticleSphere
          scenario={scenario}
          reducedMotion={effectiveReducedMotion}
          paused={!isPageVisible}
        />

        <div className="oc-trigger-row">
          <OrionCoreButton
            panelId={panelId}
            open={open}
            scenario={scenario}
            reducedMotion={effectiveReducedMotion}
            paused={!isPageVisible}
            onToggle={() => setOpen((current) => !current)}
          />
          <div className="oc-trigger-support">
            <p className="oc-eyebrow">Current state</p>
            <p className="oc-state-label">{scenario.stateLabel}</p>
            <p className="oc-state-note">{scenario.motionHint}</p>
            <p aria-live="polite" className="oc-sr-announcement">
              Orion state update: {scenario.ariaStateLabel}
            </p>
          </div>
        </div>

        <OrionCorePanel panelId={panelId} open={open} scenario={scenario} onClose={() => setOpen(false)} />
      </div>

      <div className="oc-side-grid">
        <OrionCoreScenarioSwitcher selected={scenarioId} onChange={setScenarioId} />
        <OrionStateLegend />

        <section className="oc-notes" aria-label="Motion and accessibility notes">
          <h3>Motion and Accessibility Notes</h3>
          <ul>
            <li>Motion honors reduced-motion preference and includes a deterministic preview state.</li>
            <li>State meaning uses text, ring style, and symbols, not color alone.</li>
            <li>The panel supports keyboard focus flow and Escape-to-close behavior.</li>
          </ul>
        </section>

        <section className="oc-notes" aria-label="Fixture disclaimer">
          <h3>Fixture-Only Disclaimer</h3>
          <p>
            This lab prototype uses deterministic fixture scenarios only. It performs no network calls,
            no Supabase reads, and no write actions.
          </p>
          <p className="oc-order">Scenario order: {orionCoreScenarioOrder.join(" -> ")}</p>
        </section>
      </div>
    </section>
  );
}
