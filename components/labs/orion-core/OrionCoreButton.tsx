import type { OrionCoreScenario } from "@/lib/labs/orion-core";
import { OrionActivityRing } from "./OrionActivityRing";

type OrionCoreButtonProps = {
  panelId: string;
  open: boolean;
  scenario: OrionCoreScenario;
  reducedMotion: boolean;
  paused: boolean;
  onToggle: () => void;
};

function statusGlyph(state: OrionCoreScenario["id"]): string {
  if (state === "CRITICAL") {
    return "!";
  }

  if (state === "ATTENTION") {
    return "!";
  }

  if (state === "STALE_DATA") {
    return "~";
  }

  if (state === "UNAVAILABLE") {
    return "-";
  }

  return "•";
}

export function OrionCoreButton({ panelId, open, scenario, reducedMotion, paused, onToggle }: OrionCoreButtonProps) {
  return (
    <button
      type="button"
      className="oc-trigger"
      aria-haspopup="dialog"
      aria-controls={panelId}
      aria-expanded={open}
      aria-label={`Open Orion Core panel. State: ${scenario.ariaStateLabel}`}
      onClick={onToggle}
    >
      <span className="oc-mark-wrap">
        <OrionActivityRing scenario={scenario} reducedMotion={reducedMotion} paused={paused} />
        {scenario.hasPriorityIndicator ? <span className="oc-priority-dot" aria-hidden="true" /> : null}
      </span>
      <span className="oc-trigger-text">
        <span className="oc-orion-label">ORION</span>
        <span className="oc-state-line">
          <span className="oc-state-glyph" aria-hidden="true">{statusGlyph(scenario.id)}</span>
          <span>{scenario.stateLabel}</span>
        </span>
      </span>
    </button>
  );
}
