"use client";

import type { ComponentPropsWithoutRef, ReactNode, Ref } from "react";
import { forwardRef, useRef } from "react";
import { useFocusTrap } from "./focus-trap";
import { useMotionPreferences } from "./motion-provider";

type SlidePanelProps = {
  open: boolean;
  from?: "right" | "bottom";
  className?: string;
  trapFocus?: boolean;
  onEscape?: () => void;
  children: ReactNode;
} & Omit<ComponentPropsWithoutRef<"div">, "children">;

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

export const SlidePanel = forwardRef(function SlidePanel(
  { open, from = "right", className, trapFocus = false, onEscape, children, tabIndex, ...props }: SlidePanelProps,
  forwardedRef: Ref<HTMLDivElement>,
) {
  const { reducedMotion } = useMotionPreferences();
  const internalRef = useRef<HTMLDivElement | null>(null);

  useFocusTrap({
    active: open && trapFocus,
    containerRef: internalRef,
    onEscape,
  });

  return (
    <div
      {...props}
      ref={(node) => {
        internalRef.current = node;

        if (typeof forwardedRef === "function") {
          forwardedRef(node);
          return;
        }

        if (forwardedRef) {
          forwardedRef.current = node;
        }
      }}
      className={resolveSlidePanelClassNames({ open, from, reducedMotion, className })}
      aria-hidden={!open}
      tabIndex={tabIndex ?? -1}
    >
      {children}
    </div>
  );
});
