import type { RefObject } from "react";
import type { KeyboardEvent, PointerEvent, MouseEvent } from "react";
import type { PersistentOrionFixture, PersistentOrionVisualState } from "./types";
import { PersistentOrionMiniSphere } from "./PersistentOrionMiniSphere";
import { useOrionRealtimeRuntime } from "./OrionRealtimeRuntime";

type PersistentOrionButtonProps = {
  open: boolean;
  minimized: boolean;
  dragging: boolean;
  reducedMotion: boolean;
  micActive: boolean;
  voicePhase: string;
  fixture: PersistentOrionFixture;
  panelId: string;
  instructionsId: string;
  sphereState: PersistentOrionVisualState;
  voiceLevel: number;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLButtonElement>) => void;
  onPointerCancel: (event: PointerEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
};

export function PersistentOrionButton({
  open,
  minimized,
  dragging,
  reducedMotion,
  micActive,
  voicePhase,
  fixture,
  panelId,
  instructionsId,
  sphereState,
  voiceLevel,
  buttonRef,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  onClick,
}: PersistentOrionButtonProps) {
  const realtime = useOrionRealtimeRuntime();
  const effectiveSphereState = realtime.visualState ?? sphereState;
  const effectiveMicActive = realtime.active || micActive;
  const effectiveVoicePhase = realtime.active ? `realtime_${realtime.connectionState}` : voicePhase;
  const stateLabel = fixture.state
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());

  return (
    <button
      ref={buttonRef}
      type="button"
      className={[
        "persistentOrionButton",
        dragging ? "persistentOrionButtonDragging" : "",
        minimized ? "persistentOrionButtonMinimized" : "",
      ].filter(Boolean).join(" ")}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={panelId}
      aria-describedby={instructionsId}
      aria-label={`Open Orion. Current state: ${stateLabel}. Voice phase: ${effectiveVoicePhase}. Microphone ${effectiveMicActive ? "on" : "off"}. Workspace: ${fixture.workspace}.`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <span className="persistentOrionVisual" aria-hidden="true">
        <PersistentOrionMiniSphere state={effectiveSphereState} reducedMotion={reducedMotion} minimized={minimized} voiceLevel={voiceLevel} />
      </span>
      <span className="persistentOrionSr">
        Open Orion. Current state: {stateLabel}. {minimized ? "Orion is minimized." : "Orion is available."}
      </span>
    </button>
  );
}
