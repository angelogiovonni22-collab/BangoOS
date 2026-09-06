import type { RefObject } from "react";
import type { KeyboardEvent, PointerEvent, MouseEvent } from "react";
import type { PersistentOrionFixture, PersistentOrionVisualState } from "./types";
import { PersistentOrionMiniSphere } from "./PersistentOrionMiniSphere";

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
  const normalizedVoicePhase = voicePhase.trim().toLowerCase();
  const stateLabel = normalizedVoicePhase === "idle"
    ? "Ready"
    : normalizedVoicePhase
      .replace(/_/g, " ")
      .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
  const availabilityLabel = minimized ? "Orion is minimized." : "Orion is available.";
  const statusSentence = `Open Orion. Current state: ${stateLabel}. Microphone ${micActive ? "on" : "off"}. Workspace: ${fixture.workspace}.`;

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
      aria-label={statusSentence}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={onKeyDown}
      onClick={onClick}
    >
      <span className="persistentOrionVisual" aria-hidden="true">
        <PersistentOrionMiniSphere state={sphereState} reducedMotion={reducedMotion} minimized={minimized} voiceLevel={voiceLevel} />
      </span>
      <span className="persistentOrionSr">
        {statusSentence} {availabilityLabel}
      </span>
    </button>
  );
}
