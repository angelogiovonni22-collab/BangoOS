"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type RefObject } from "react";
import { useFocusTrap } from "@/components/motion";
import { OrionVoiceButton, OrionVoiceStatus, OrionVoiceTranscript, useGlobalOrionVoice } from "@/components/orion/voice";
import type { PersistentOrionFixture } from "./types";

type PersistentOrionPanelProps = {
  panelId: string;
  open: boolean;
  fixture: PersistentOrionFixture;
  minimized: boolean;
  onClose: () => void;
  onToggleMinimized: () => void;
  panelRef: RefObject<HTMLDivElement | null>;
  panelStyle?: CSSProperties;
};

export function PersistentOrionPanel({
  panelId,
  open,
  fixture,
  minimized,
  onClose,
  onToggleMinimized,
  panelRef,
  panelStyle,
}: PersistentOrionPanelProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const voice = useGlobalOrionVoice();

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
      aria-label={`Persistent Orion panel. State ${fixture.state}.`}
      className="persistentOrionPanel"
      style={panelStyle}
      tabIndex={-1}
    >
      <header className="persistentOrionPanelHeader">
        <div>
          <p className="persistentOrionEyebrow">ORION</p>
          <h3>{fixture.workspace}</h3>
          <p className="persistentOrionStateLine">State: {fixture.state.replace(/_/g, " ")}</p>
        </div>
        <button
          ref={closeButtonRef}
          type="button"
          className="persistentOrionClose"
          onClick={onClose}
          aria-label="Close Orion panel"
        >
          Close
        </button>
      </header>

      <div className="persistentOrionFixtureTags" aria-label="Fixture labels">
        <span>Prototype Intelligence</span>
        <span>Fixture Data</span>
      </div>

      <section className="persistentOrionSection">
        <p className="persistentOrionEyebrow">Observation</p>
        <p>{fixture.observation}</p>
      </section>

      <section className="persistentOrionSection">
        <p className="persistentOrionEyebrow">Why it matters</p>
        <p>{fixture.whyItMatters}</p>
      </section>

      <section className="persistentOrionSection" aria-label="Orion voice controls">
        <p className="persistentOrionEyebrow">Voice</p>
        <div className="mt-2 flex items-center gap-2">
          <OrionVoiceButton
            state={voice.micActive ? "listening" : "idle"}
            mode={voice.mode === "hands_free" ? "tap_to_listen" : voice.mode}
            onStart={() => {
              if (!voice.settings.enabled) {
                voice.enableGlobalVoice();
              }
              if (voice.mode === "push_to_talk") {
                voice.startPressToTalk();
              } else {
                voice.toggleTapListening();
              }
            }}
            onStop={() => {
              if (voice.mode === "push_to_talk") {
                voice.stopPressToTalk();
              } else {
                voice.toggleTapListening();
              }
            }}
          />
          <button
            type="button"
            className="persistentOrionMinimize"
            onClick={() => voice.setSpokenResponsesEnabled(!voice.settings.spokenResponsesEnabled)}
          >
            {voice.settings.spokenResponsesEnabled ? "Mute Voice" : "Unmute Voice"}
          </button>
          <button
            type="button"
            className="persistentOrionMinimize"
            onClick={() => {
              if (voice.settings.enabled) {
                voice.disableGlobalVoice();
              } else {
                voice.enableGlobalVoice();
              }
            }}
          >
            {voice.settings.enabled ? "Disable Voice" : "Enable Voice"}
          </button>
        </div>
        <div className="mt-2">
          <OrionVoiceStatus
            state={voice.phase}
            message={voice.statusMessage || voice.supportMessage}
            showNotice
          />
        </div>
        <div className="mt-2">
          <OrionVoiceTranscript
            interimTranscript={voice.interimTranscript}
            finalTranscript={voice.finalTranscript}
            onStop={() => voice.stopAllListening()}
            onCancel={() => voice.stopAllListening()}
            onRestart={() => {
              if (voice.mode === "push_to_talk") {
                voice.startPressToTalk();
              } else {
                voice.toggleTapListening();
              }
            }}
            onRetry={() => voice.retryFromError()}
          />
        </div>
      </section>

      <dl className="persistentOrionFacts">
        <div>
          <dt>Evidence status</dt>
          <dd>{fixture.evidenceStatus}</dd>
        </div>
        <div>
          <dt>Data freshness</dt>
          <dd>{fixture.dataFreshness}</dd>
        </div>
        <div>
          <dt>Recommended next review</dt>
          <dd>{fixture.recommendedNextReview}</dd>
        </div>
        <div>
          <dt>Approval boundary</dt>
          <dd>{fixture.approvalBoundary}</dd>
        </div>
        <div>
          <dt>Limitations</dt>
          <dd>{fixture.limitations}</dd>
        </div>
      </dl>

      <footer className="persistentOrionPanelFooter">
        <Link href="/labs/orion-core" className="persistentOrionLinkAction" onClick={onClose}>
          Open Orion Core Lab
        </Link>
        <button type="button" className="persistentOrionMinimize" onClick={onToggleMinimized}>
          {minimized ? "Restore Orion" : "Minimize Orion"}
        </button>
      </footer>
    </section>
  );
}
