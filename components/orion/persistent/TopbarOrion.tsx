"use client";

import { usePathname } from "next/navigation";
import { useMemo, useRef, useState, type CSSProperties } from "react";
import { useMotionPreferences } from "@/components/motion";
import { useOrionUnifiedVoice } from "@/components/orion/voice";
import { getPersistentOrionFixture } from "./fixtures";
import { PersistentOrionMiniSphere } from "./PersistentOrionMiniSphere";
import { PersistentOrionPanel } from "./PersistentOrionPanel";
import type { PersistentOrionVisualState } from "./types";
import styles from "./persistent-orion.module.css";

type TopbarOrionProps = {
  onOpenCommandCenter: () => void;
  onHide: () => void;
};

function mapVoicePhaseToSphereState(phase: string, enabled: boolean): PersistentOrionVisualState {
  if (!enabled || phase === "disabled" || phase === "unsupported" || phase === "permission_denied") return "disabled";
  if (phase === "awaiting_wake_command" || phase === "listening") return "listening";
  if (phase === "waiting_for_wake" || phase === "starting" || phase === "wake_detected") return "waiting";
  if (phase === "understanding" || phase === "finalizing") return "thinking";
  if (phase === "executing") return "executing";
  if (phase === "speaking") return "speaking";
  if (phase === "clarification_required" || phase === "confirmation_required") return "confirmation";
  if (phase === "success") return "success";
  if (phase === "error" || phase === "no_match" || phase === "reactivation_required") return "error";
  return "idle";
}

export function TopbarOrion({ onOpenCommandCenter, onHide }: TopbarOrionProps) {
  const pathname = usePathname();
  const { reducedMotion } = useMotionPreferences();
  const voice = useOrionUnifiedVoice();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const fixture = useMemo(() => getPersistentOrionFixture(pathname || "/dashboard"), [pathname]);
  const sphereState = useMemo(() => mapVoicePhaseToSphereState(voice.phase, voice.settings.enabled), [voice.phase, voice.settings.enabled]);

  const openPanel = () => setOpen((current) => !current);
  const panelStyle: CSSProperties | undefined = open && buttonRef.current
    ? (() => {
        const rect = buttonRef.current!.getBoundingClientRect();
        const width = Math.min(560, window.innerWidth - 24);
        const left = Math.min(Math.max(12, rect.right - width), window.innerWidth - width - 12);
        return { position: "fixed", top: rect.bottom + 10, left };
      })()
    : undefined;

  const rootStyle = {
    position: "relative",
    right: "auto",
    bottom: "auto",
    zIndex: 40,
    "--po-full-size": "48px",
    "--po-min-size": "48px",
  } as CSSProperties;

  return (
    <div className={styles.persistentOrionRoot} style={rootStyle} aria-label="Topbar Orion surface">
      <button
        ref={buttonRef}
        type="button"
        className="persistentOrionButton"
        aria-label="Open Orion settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="topbar-orion-panel"
        title="Open Orion"
        onClick={openPanel}
      >
        <span className="persistentOrionVisual" aria-hidden="true">
          <PersistentOrionMiniSphere state={sphereState} reducedMotion={reducedMotion} minimized={false} voiceLevel={voice.voiceLevel} />
        </span>
      </button>

      <PersistentOrionPanel
        panelId="topbar-orion-panel"
        open={open}
        fixture={fixture}
        minimized={minimized}
        voice={voice}
        onClose={() => setOpen(false)}
        onHide={() => { setOpen(false); onHide(); }}
        onOpenCommandCenter={() => { setOpen(false); onOpenCommandCenter(); }}
        onToggleMinimized={() => setMinimized((current) => !current)}
        panelRef={panelRef}
        panelStyle={panelStyle}
      />
    </div>
  );
}
