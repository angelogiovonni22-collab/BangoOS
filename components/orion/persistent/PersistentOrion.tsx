"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { LayerManager } from "@/components/bangoflow";
import { useMotionPreferences } from "@/components/motion";
import { PortalHost } from "@/components/ui";
import { useOrionUnifiedVoice } from "@/components/orion/voice";
import { getPersistentOrionFixture } from "./fixtures";
import { PersistentOrionButton } from "./PersistentOrionButton";
import { PersistentOrionPanel } from "./PersistentOrionPanel";
import type { PersistentOrionVisualState } from "./types";
import styles from "./persistent-orion.module.css";

type FloatingPosition = {
  x: number;
  y: number;
};

type PersistentOrionProps = {
  onOpenCommandCenter: () => void;
  onHide: () => void;
};

const PERSISTENT_ORION_POSITION_KEY = "bangoos:persistent-orion-position:v2-session";
const FLOAT_MARGIN = 12;
const DRAG_THRESHOLD_PX = 6;
const DEFAULT_FULL_CONTROL_SIZE = 124;
const DEFAULT_MIN_CONTROL_SIZE = 92;
const DESKTOP_BREAKPOINT_PX = 1024;
const DESKTOP_SIDEBAR_WIDTH_PX = 288;
const DESKTOP_TOP_OFFSET_PX = 88;
const SSR_SAFE_DEFAULT_POSITION: FloatingPosition = Object.freeze({
  x: FLOAT_MARGIN,
  y: FLOAT_MARGIN,
});

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getViewportSize() {
  if (typeof window === "undefined") {
    return { width: 0, height: 0 };
  }

  return {
    width: window.visualViewport?.width ?? window.innerWidth,
    height: window.visualViewport?.height ?? window.innerHeight,
  };
}

function getDefaultPosition(controlWidth: number, controlHeight: number): FloatingPosition {
  const viewport = getViewportSize();

  if (viewport.width >= DESKTOP_BREAKPOINT_PX) {
    return {
      x: Math.max(
        FLOAT_MARGIN,
        Math.min(
          DESKTOP_SIDEBAR_WIDTH_PX - controlWidth - FLOAT_MARGIN,
          viewport.width - controlWidth - FLOAT_MARGIN,
        ),
      ),
      y: Math.max(
        FLOAT_MARGIN,
        Math.min(DESKTOP_TOP_OFFSET_PX, viewport.height - controlHeight - FLOAT_MARGIN),
      ),
    };
  }

  return {
    x: Math.max(FLOAT_MARGIN, viewport.width - controlWidth - FLOAT_MARGIN),
    y: Math.max(FLOAT_MARGIN, viewport.height - controlHeight - FLOAT_MARGIN),
  };
}

function readStoredPosition() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PERSISTENT_ORION_POSITION_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (!isFiniteNumber(parsed.x) || !isFiniteNumber(parsed.y)) {
      return null;
    }

    return { x: parsed.x, y: parsed.y };
  } catch {
    return null;
  }
}

function writeStoredPosition(position: FloatingPosition) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(PERSISTENT_ORION_POSITION_KEY, JSON.stringify(position));
  } catch {
    // Ignore storage failures.
  }
}

function mapVoicePhaseToSphereState(
  phase: string,
  enabled: boolean,
): PersistentOrionVisualState {
  if (!enabled || phase === "disabled" || phase === "unsupported" || phase === "permission_denied") {
    return "disabled";
  }

  if (phase === "awaiting_wake_command" || phase === "listening") {
    return "listening";
  }

  if (phase === "waiting_for_wake" || phase === "starting" || phase === "wake_detected") {
    return "waiting";
  }

  if (phase === "understanding" || phase === "finalizing") {
    return "thinking";
  }

  if (phase === "executing") {
    return "executing";
  }

  if (phase === "speaking") {
    return "speaking";
  }

  if (phase === "clarification_required" || phase === "confirmation_required") {
    return "confirmation";
  }

  if (phase === "success") {
    return "success";
  }

  if (phase === "error" || phase === "no_match" || phase === "reactivation_required") {
    return "error";
  }

  return "idle";
}

export function PersistentOrion({ onOpenCommandCenter, onHide }: PersistentOrionProps) {
  const pathname = usePathname();
  const { reducedMotion } = useMotionPreferences();
  const voice = useOrionUnifiedVoice();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [position, setPosition] = useState<FloatingPosition>(SSR_SAFE_DEFAULT_POSITION);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | undefined>(undefined);
  const panelId = "persistent-orion-panel";
  const instructionsId = "persistent-orion-instructions";

  const shellRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const restoreUserSelectRef = useRef<string | null>(null);

  const fixture = useMemo(() => getPersistentOrionFixture(pathname || "/dashboard"), [pathname]);
  const sphereState = useMemo(
    () => mapVoicePhaseToSphereState(voice.phase, voice.settings.enabled),
    [voice.phase, voice.settings.enabled],
  );

  const getControlSize = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    return {
      width: rect?.width ?? (minimized ? DEFAULT_MIN_CONTROL_SIZE : DEFAULT_FULL_CONTROL_SIZE),
      height: rect?.height ?? (minimized ? DEFAULT_MIN_CONTROL_SIZE : DEFAULT_FULL_CONTROL_SIZE),
    };
  }, [minimized]);

  const clampPosition = useCallback((next: FloatingPosition) => {
    const { width, height } = getControlSize();
    const viewport = getViewportSize();

    return {
      x: clamp(next.x, FLOAT_MARGIN, Math.max(FLOAT_MARGIN, viewport.width - width - FLOAT_MARGIN)),
      y: clamp(next.y, FLOAT_MARGIN, Math.max(FLOAT_MARGIN, viewport.height - height - FLOAT_MARGIN)),
    };
  }, [getControlSize]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      const { width, height } = getControlSize();
      const fallback = getDefaultPosition(width, height);
      const stored = readStoredPosition();
      const next = clampPosition(stored ?? fallback);
      setPosition(next);
      writeStoredPosition(next);
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [clampPosition, getControlSize]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setPosition((current) => {
        const clamped = clampPosition(current);
        writeStoredPosition(clamped);
        return clamped;
      });
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [clampPosition, getControlSize, minimized]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!open) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }

      const inPanel = panelRef.current?.contains(target);
      const inButton = buttonRef.current?.contains(target);
      if (!inPanel && !inButton) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, [open]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        const clamped = clampPosition(current);
        writeStoredPosition(clamped);
        return clamped;
      });
    };

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.visualViewport?.removeEventListener("resize", handleResize);
    };
  }, [clampPosition, minimized]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const updatePanelPosition = () => {
      const buttonRect = buttonRef.current?.getBoundingClientRect();
      const panelRect = panelRef.current?.getBoundingClientRect();
      if (!buttonRect || !panelRect) {
        return;
      }

      const viewport = getViewportSize();
      const gap = 10;
      const enoughRight = buttonRect.right + gap + panelRect.width <= viewport.width - FLOAT_MARGIN;
      const enoughLeft = buttonRect.left - gap - panelRect.width >= FLOAT_MARGIN;
      const enoughBelow = buttonRect.bottom + gap + panelRect.height <= viewport.height - FLOAT_MARGIN;

      let left = enoughRight
        ? buttonRect.right + gap
        : enoughLeft
          ? buttonRect.left - panelRect.width - gap
          : buttonRect.left + ((buttonRect.width - panelRect.width) / 2);

      let top = enoughBelow
        ? buttonRect.bottom + gap
        : buttonRect.top - panelRect.height - gap;

      left = clamp(left, FLOAT_MARGIN, Math.max(FLOAT_MARGIN, viewport.width - panelRect.width - FLOAT_MARGIN));
      top = clamp(top, FLOAT_MARGIN, Math.max(FLOAT_MARGIN, viewport.height - panelRect.height - FLOAT_MARGIN));

      setPanelStyle({ left, top, position: "fixed" });
    };

    const frameId = window.requestAnimationFrame(updatePanelPosition);
    window.addEventListener("resize", updatePanelPosition);
    window.visualViewport?.addEventListener("resize", updatePanelPosition);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener("resize", updatePanelPosition);
      window.visualViewport?.removeEventListener("resize", updatePanelPosition);
    };
  }, [clampPosition, minimized, open, position]);

  const rootStyle = { left: `${position.x}px`, top: `${position.y}px`, right: "auto", bottom: "auto" };

  return (
    <PortalHost>
      <LayerManager layer="orionPersistent">
        <div ref={shellRef} className={styles.persistentOrionRoot} style={rootStyle} aria-label="Persistent Orion surface">
      {open ? <div className="persistentOrionBackdrop" aria-hidden="true" /> : null}
      <PersistentOrionButton
        open={open}
        minimized={minimized}
        dragging={dragging}
        reducedMotion={reducedMotion}
        micActive={voice.micActive}
        voicePhase={voice.phase}
        fixture={fixture}
        panelId={panelId}
        instructionsId={instructionsId}
        buttonRef={buttonRef}
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) {
            return;
          }

          const button = buttonRef.current;
          const current = position;
          dragStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: current.x,
            originY: current.y,
            moved: false,
          };

          restoreUserSelectRef.current = document.body.style.userSelect;
          document.body.style.userSelect = "none";
          button?.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragStateRef.current;
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }

          const deltaX = event.clientX - drag.startX;
          const deltaY = event.clientY - drag.startY;
          if (!drag.moved && Math.hypot(deltaX, deltaY) >= DRAG_THRESHOLD_PX) {
            drag.moved = true;
            suppressClickRef.current = true;
            setDragging(true);
          }

          if (!drag.moved) {
            return;
          }

          setPosition(clampPosition({
            x: drag.originX + deltaX,
            y: drag.originY + deltaY,
          }));
        }}
        onPointerUp={(event) => {
          const drag = dragStateRef.current;
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }

          buttonRef.current?.releasePointerCapture(event.pointerId);
          dragStateRef.current = null;
          document.body.style.userSelect = restoreUserSelectRef.current ?? "";
          restoreUserSelectRef.current = null;

          setDragging(false);
          setPosition((current) => {
            if (!current) {
              return current;
            }

            const clamped = clampPosition(current);
            writeStoredPosition(clamped);
            return clamped;
          });
        }}
        onPointerCancel={(event) => {
          const drag = dragStateRef.current;
          if (!drag || drag.pointerId !== event.pointerId) {
            return;
          }

          buttonRef.current?.releasePointerCapture(event.pointerId);
          dragStateRef.current = null;
          document.body.style.userSelect = restoreUserSelectRef.current ?? "";
          restoreUserSelectRef.current = null;
          setDragging(false);
        }}
        onKeyDown={(event) => {
          const buttonRect = buttonRef.current?.getBoundingClientRect();
          const basePosition = {
            x: buttonRect?.left ?? position.x,
            y: buttonRect?.top ?? position.y,
          };
          const step = event.shiftKey ? 24 : 12;
          let next = basePosition;

          if (event.key === "ArrowLeft") {
            next = clampPosition({ x: basePosition.x - step, y: basePosition.y });
          } else if (event.key === "ArrowRight") {
            next = clampPosition({ x: basePosition.x + step, y: basePosition.y });
          } else if (event.key === "ArrowUp") {
            next = clampPosition({ x: basePosition.x, y: basePosition.y - step });
          } else if (event.key === "ArrowDown") {
            next = clampPosition({ x: basePosition.x, y: basePosition.y + step });
          } else {
            return;
          }

          event.preventDefault();
          setPosition(next);
          writeStoredPosition(next);
        }}
        onClick={(event) => {
          if (suppressClickRef.current) {
            suppressClickRef.current = false;
            event.preventDefault();
            return;
          }

          setOpen((current) => !current);
        }}
        sphereState={sphereState}
        voiceLevel={voice.voiceLevel}
      />

      <PersistentOrionPanel
        panelId={panelId}
        open={open}
        fixture={fixture}
        minimized={minimized}
        voice={voice}
        onClose={() => setOpen(false)}
        onHide={onHide}
        onOpenCommandCenter={() => {
          setOpen(false);
          onOpenCommandCenter();
        }}
        onToggleMinimized={() => setMinimized((current) => !current)}
        panelRef={panelRef}
        panelStyle={panelStyle}
      />

      <span id={instructionsId} className={styles.persistentOrionInstructions}>
        Drag Orion to reposition it. Use arrow keys when focused.
      </span>
        </div>
      </LayerManager>
    </PortalHost>
  );
}
