"use client";

import { useRef } from "react";
import { useFocusTrap } from "@/components/motion";
import type { OrionCoreScenario } from "@/lib/labs/orion-core";
import { OrionExecutiveSnapshot } from "./OrionExecutiveSnapshot";

type OrionCorePanelProps = {
  panelId: string;
  open: boolean;
  scenario: OrionCoreScenario;
  onClose: () => void;
};

export function OrionCorePanel({ panelId, open, scenario, onClose }: OrionCorePanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
  });

  if (!open) {
    return null;
  }

  return (
    <section
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Orion Core intelligence panel for ${scenario.stateLabel}`}
      tabIndex={-1}
      className="oc-panel"
    >
      <header className="oc-panel-header">
        <div>
          <p className="oc-eyebrow">Orion State</p>
          <h3>{scenario.stateLabel}</h3>
          <p className="oc-panel-description">{scenario.textCue}</p>
        </div>
        <button type="button" className="oc-close" onClick={onClose} aria-label="Close Orion panel">
          Close
        </button>
      </header>

      <OrionExecutiveSnapshot snapshot={scenario.executiveSnapshot} />

      <section className="oc-panel-section" aria-label="Recommended action boundary">
        <p className="oc-eyebrow">Recommended next step</p>
        <p>{scenario.executiveSnapshot.recommendedNextStep}</p>
        <p className="oc-eyebrow oc-space-top">Approval boundary</p>
        <p>{scenario.executiveSnapshot.approvalBoundary}</p>
      </section>

      <section className="oc-panel-section" aria-label="Known limitations">
        <p className="oc-eyebrow">Limitations</p>
        <ul>
          {scenario.executiveSnapshot.limitations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <div className="oc-panel-footer">
        <button type="button" className="oc-link-action" aria-disabled="true">
          View Executive Brief
        </button>
        <span>Prototype read-only action</span>
      </div>
    </section>
  );
}
