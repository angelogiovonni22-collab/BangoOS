"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import {
  AudioLines,
  Bell,
  BrainCircuit,
  Check,
  CircleUserRound,
  Mic,
  X,
} from "lucide-react";
import { useFocusTrap } from "@/components/motion";
import { OrionVoiceButton, OrionVoiceStatus, OrionVoiceTranscript, type OrionRealtimeVoice, type OrionUnifiedVoiceController } from "@/components/orion/voice";
import { enableOrionBackgroundPush, getOrionPushStatus, type OrionPushStatus } from "@/lib/orion/personal-assistant/push-client";
import type { PersistentOrionFixture } from "./types";

type PersistentOrionPanelProps = {
  panelId: string;
  open: boolean;
  fixture: PersistentOrionFixture;
  minimized: boolean;
  voice: OrionUnifiedVoiceController;
  onClose: () => void;
  onOpenCommandCenter: () => void;
  onToggleMinimized: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle?: CSSProperties;
};

function voiceLabel(voice: OrionRealtimeVoice) {
  const label = voice.charAt(0).toUpperCase() + voice.slice(1);
  return voice === "marin" ? `${label} — Recommended` : label;
}

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
  fixture,
  minimized,
  voice,
  onClose,
  onOpenCommandCenter,
  onToggleMinimized,
  panelRef,
  panelStyle,
}: PersistentOrionPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pushStatus, setPushStatus] = useState<OrionPushStatus>("default");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  useFocusTrap({
    active: open,
    containerRef: panelRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void getOrionPushStatus().then((status) => {
      if (!cancelled) setPushStatus(status);
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  const realtimeSessionActive = voice.realtimeState !== "closed" && voice.realtimeState !== "idle" && voice.realtimeState !== "error";
  const stateLabel = formatVoicePhase(voice.phase);

  return (
    <section
      id={panelId}
      ref={panelRef}
      role="dialog"
      aria-modal="false"
      aria-label={`Orion panel. State ${stateLabel}.`}
      className="persistentOrionPanel"
      style={panelStyle}
      tabIndex={-1}
    >
      <header className="persistentOrionPanelHeader">
        <div className="persistentOrionTitleBlock">
          <div className="persistentOrionIdentity">
            <div className="persistentOrionIdentityMark" aria-hidden="true">
              <BrainCircuit size={24} />
            </div>
            <div>
              <p className="persistentOrionPanelTitle">ORION</p>
              <h3>{fixture.workspace}</h3>
            </div>
          </div>
          <p className="persistentOrionStateLine">
            <span className="persistentOrionStateDot" aria-hidden="true" />
            <span>State:</span>
            <strong>{stateLabel}</strong>
          </p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="persistentOrionClose"
          onClick={onClose}
          aria-label="Close Orion panel"
        >
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
          <OrionVoiceButton
            state={voice.micActive ? "listening" : "idle"}
            mode="tap_to_listen"
            onStart={() => void voice.start()}
            onStop={() => void voice.stop()}
          />
          <button
            type="button"
            className="persistentOrionVoicePrimary"
            onClick={() => voice.setSpokenResponsesEnabled(!voice.settings.spokenResponsesEnabled)}
          >
            {voice.settings.spokenResponsesEnabled ? "Mute Voice" : "Unmute Voice"}
          </button>
          <button
            type="button"
            className="persistentOrionVoiceSecondary"
            onClick={() => {
              if (voice.settings.enabled) {
                void voice.disableVoice();
              } else {
                voice.enableVoice();
              }
            }}
          >
            {voice.settings.enabled ? "Disable Voice" : "Enable Voice"}
          </button>
        </div>
      </section>

      <section className="persistentOrionSection persistentOrionSectionBordered" aria-label="Orion background notifications">
        <div className="persistentOrionSectionHeading">
          <Bell size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Reminders & Alerts</p>
        </div>
        <p className="persistentOrionSectionCopy">{pushMessage || pushStatusMessage(pushStatus)}</p>
        <div className="persistentOrionVoiceActions">
          <button
            type="button"
            className="persistentOrionVoicePrimary"
            disabled={pushBusy || pushStatus === "enabled" || pushStatus === "unsupported" || pushStatus === "not_installed"}
            onClick={() => {
              setPushBusy(true);
              setPushMessage(null);
              void enableOrionBackgroundPush()
                .then(() => {
                  setPushStatus("enabled");
                  setPushMessage("Background Orion notifications are enabled. You can now receive reminder alerts even when B.O.S. is closed.");
                })
                .catch((error) => {
                  setPushMessage(error instanceof Error ? error.message : "Unable to enable Orion notifications.");
                  void getOrionPushStatus().then(setPushStatus);
                })
                .finally(() => setPushBusy(false));
            }}
          >
            {pushStatus === "enabled" ? "Notifications Enabled" : pushBusy ? "Enabling…" : "Enable Orion Notifications"}
          </button>
        </div>
      </section>

      <section className="persistentOrionSection persistentOrionRealtimeSection" aria-label="Realtime voice settings">
        <div className="persistentOrionSectionHeading">
          <AudioLines size={21} aria-hidden="true" />
          <p className="persistentOrionEyebrow">Realtime Voice</p>
        </div>

        <label className="persistentOrionVoiceSelectWrap" htmlFor="orion-realtime-voice-select">
          <CircleUserRound size={24} aria-hidden="true" />
          <span className="persistentOrionVoiceSelectText">
            <strong>{voiceLabel(voice.realtimeVoice)}</strong>
            <span>Realtime voice</span>
          </span>
          <select
            id="orion-realtime-voice-select"
            className="persistentOrionVoiceSelect"
            value={voice.realtimeVoice}
            disabled={realtimeSessionActive}
            onChange={(event) => voice.setRealtimeVoice(event.target.value as OrionRealtimeVoice)}
            aria-label="Realtime voice"
          >
            {voice.availableRealtimeVoices.map((option) => (
              <option key={option} value={option}>{voiceLabel(option)}</option>
            ))}
          </select>
        </label>

        <p className="persistentOrionVoiceNote">
          {realtimeSessionActive ? "End the current Realtime conversation to change voices." : "Your Realtime voice choice is saved on this device."}
        </p>
        <p className="persistentOrionVoiceNote persistentOrionIsolationNote" role="status">
          Focused voice isolation is active: background noise is reduced.
          <Check size={17} aria-hidden="true" />
        </p>

        <div className="persistentOrionVoiceStatusWrap">
          <OrionVoiceStatus
            state={voice.phase}
            message={voice.statusMessage || voice.supportMessage}
            showNotice
          />
        </div>
        <div className="persistentOrionVoiceTranscriptWrap">
          <OrionVoiceTranscript
            interimTranscript={voice.interimTranscript}
            finalTranscript={voice.finalTranscript}
            onStop={() => void voice.stop()}
            onCancel={() => void voice.stop()}
            onRestart={() => void voice.start()}
            onRetry={() => void voice.retry()}
          />
        </div>
      </section>

      <dl className="persistentOrionFacts">
        <div>
          <dt>Workspace</dt>
          <dd>{fixture.workspace}</dd>
        </div>
        <div>
          <dt>Voice status</dt>
          <dd>{stateLabel}</dd>
        </div>
        <div>
          <dt>Microphone</dt>
          <dd>{voice.micActive ? "Active" : "Off"}</dd>
        </div>
        <div>
          <dt>Session</dt>
          <dd>{realtimeSessionActive ? "Connected" : "Idle"}</dd>
        </div>
      </dl>

      <footer className="persistentOrionPanelFooter">
        <button type="button" className="persistentOrionLinkAction" onClick={onOpenCommandCenter}>
          Open Advanced Orion
        </button>
        <button type="button" className="persistentOrionMinimize" onClick={onToggleMinimized}>
          {minimized ? "Restore Orion" : "Minimize Orion"}
        </button>
      </footer>
    </section>
  );
}
