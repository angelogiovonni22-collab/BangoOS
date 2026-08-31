"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { Bell, BrainCircuit, Mic, X } from "lucide-react";
import { useFocusTrap } from "@/components/motion";
import { OrionVoiceButton, type OrionUnifiedVoiceController } from "@/components/orion/voice";
import { getOrionPushStatus, type OrionPushStatus } from "@/lib/orion/personal-assistant/push-client";
import type { PersistentOrionFixture } from "./types";

type PersistentOrionPanelProps = {
  panelId: string;
  open: boolean;
  fixture: PersistentOrionFixture;
  minimized: boolean;
  voice: OrionUnifiedVoiceController;
  onClose: () => void;
  onHide: () => void;
  onOpenCommandCenter: () => void;
  onToggleMinimized: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle?: CSSProperties;
};

function pushStatusMessage(status: OrionPushStatus) {
  if (status === "enabled") return "Background Orion notifications are enabled on this device.";
  if (status === "denied") return "Notifications are blocked in your device settings.";
  if (status === "not_installed") return "On iPhone, add B.O.S. to your Home Screen and open it from the B.O.S. icon first.";
  if (status === "unsupported") return "Background notifications are not supported in this browser.";
  if (status === "error") return "Orion could not read the notification status.";
  return "Enable once to receive Orion reminders when B.O.S. is closed.";
}

function formatVoicePhase(phase: string) {
  const normalized = phase.trim().toLowerCase();
  if (normalized === "idle") return "Ready";
  return normalized
    .replace(/_/g, " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

export function PersistentOrionPanel({
  panelId,
  open,
  minimized,
  voice,
  onClose,
  onHide,
  onOpenCommandCenter,
  onToggleMinimized,
  panelRef,
  panelStyle,
}: PersistentOrionPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pushStatus, setPushStatus] = useState<OrionPushStatus>("default");

  useFocusTrap({ active: open, containerRef: panelRef, onEscape: onClose });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getOrionPushStatus().then((status) => {
      if (!cancelled) setPushStatus(status);
    });
    return () => { cancelled = true; };
  }, [open]);

  if (!open) return null;

  const stateLabel = formatVoicePhase(voice.phase);

  return (
    <section
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Orion panel. State ${stateLabel}.`}
      className="persistentOrionPanel persistentOrionPanelOriginal"
      style={panelStyle}
      tabIndex={-1}
    >
      <header className="persistentOrionPanelHeader">
        <div className="persistentOrionTitleBlock">
          <div className="persistentOrionIdentity">
            <div className="persistentOrionIdentityMark" aria-hidden="true"><BrainCircuit size={24} /></div>
            <div>
              <p className="persistentOrionPanelTitle">ORION</p>
              <h3>Workspace</h3>
            </div>
          </div>
          <p className="persistentOrionStateLine">
            <span className="persistentOrionStateDot" aria-hidden="true" />
            <span>State:</span>
            <strong>{stateLabel}</strong>
          </p>
        </div>
        <button ref={closeButtonRef} type="button" className="persistentOrionClose" onClick={onClose} aria-label="Close Orion panel">
          <X size={24} aria-hidden="true" />
          <span>Close</span>
        </button>
      </header>

      <section className="persistentOrionSection persistentOrionSectionBordered" aria-label="Orion voice controls">
        <div className="persistentOrionSectionHeading">
          <Mic size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Voice</p>
        </div>
        <div className="persistentOrionVoiceActions">
          <OrionVoiceButton state={voice.micActive ? "listening" : "idle"} mode="tap_to_listen" onStart={() => void voice.start()} onStop={() => void voice.stop()} />
          <button type="button" className="persistentOrionVoicePrimary" onClick={() => voice.setSpokenResponsesEnabled(!voice.settings.spokenResponsesEnabled)}>
            {voice.settings.spokenResponsesEnabled ? "Mute Voice" : "Unmute Voice"}
          </button>
          <button type="button" className="persistentOrionVoiceSecondary" onClick={() => { if (voice.settings.enabled) void voice.disableVoice(); else voice.enableVoice(); }}>
            {voice.settings.enabled ? "Disable Voice" : "Enable Voice"}
          </button>
        </div>
      </section>

      <section className="persistentOrionSection persistentOrionSectionBordered" aria-label="Orion background notifications">
        <div className="persistentOrionSectionHeading">
          <Bell size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Reminders & Alerts</p>
        </div>
        <p className="persistentOrionSectionCopy">{pushStatusMessage(pushStatus)}</p>
      </section>

      <footer className="persistentOrionPanelFooter">
        <button type="button" className="persistentOrionLinkAction" onClick={onOpenCommandCenter}>Open Advanced Orion</button>
        <button type="button" className="persistentOrionMinimize" onClick={onHide}>Hide Orion</button>
        <button type="button" className="persistentOrionMinimize" onClick={onToggleMinimized}>{minimized ? "Restore Orion" : "Minimize Orion"}</button>
      </footer>
    </section>
  );
}
