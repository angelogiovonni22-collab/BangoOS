"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import { useFocusTrap } from "./focus-trap";
import { useMotionPreferences } from "./motion-provider";

type SlidePanelProps = {
  open: boolean;
  from?: "right" | "bottom";
  className?: string;
  trapFocus?: boolean;
  onEscape?: () => void;
  children: ReactNode;
};

type ResolveSlidePanelClassNamesInput = {
  open: boolean;
  from: "right" | "bottom";
  reducedMotion: boolean;
  className?: string;
};

export function resolveSlidePanelClassNames({
  open,
  from,
  reducedMotion,
  className,
}: ResolveSlidePanelClassNamesInput): string {
  const stateClass = open ? "bf-panel-open" : "bf-panel-closed";
  const directionClass = from === "bottom" ? "bf-panel-bottom" : "bf-panel-right";

  return [
    "bf-slide-panel",
    directionClass,
    stateClass,
    reducedMotion ? "bf-no-motion" : "",
    className,
  ].filter(Boolean).join(" ");
}

export function SlidePanel({ open, from = "right", className, trapFocus = false, onEscape, children }: SlidePanelProps) {
  const { reducedMotion } = useMotionPreferences();
  const panelRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open && trapFocus,
    containerRef: panelRef,
    onEscape,
  });

  return (
    <div
      ref={panelRef}
      className={resolveSlidePanelClassNames({ open, from, reducedMotion, className })}
      aria-hidden={!open}
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
