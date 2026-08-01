"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";

export const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function getWrappedFocusIndex(currentIndex: number, direction: 1 | -1, total: number): number {
  if (total <= 0) {
    return -1;
  }

  const rawNext = currentIndex + direction;
  if (rawNext < 0) {
    return total - 1;
  }

  if (rawNext >= total) {
    return 0;
  }

  return rawNext;
}

export function canRestoreFocus(element: HTMLElement | null): element is HTMLElement {
  return Boolean(element && typeof element.focus === "function");
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter((element) => {
    if (element.hasAttribute("disabled")) {
      return false;
    }

    if (element.getAttribute("aria-hidden") === "true") {
      return false;
    }

    return true;
  });
}

type UseFocusTrapOptions = {
  active: boolean;
  containerRef: RefObject<HTMLElement | null>;
  onEscape?: () => void;
};

export function useFocusTrap({ active, containerRef, onEscape }: UseFocusTrapOptions) {
  const previousActiveRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }

    const container = containerRef.current;
    if (!container) {
      return;
    }

    previousActiveRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const focusTimeout = window.setTimeout(() => {
      const focusables = getFocusableElements(container);
      if (focusables.length > 0) {
        focusables[0].focus();
      } else {
        container.focus();
      }
    }, 0);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onEscape?.();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const focusables = getFocusableElements(container);
      if (focusables.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const currentIndex = focusables.findIndex((element) => element === document.activeElement);
      const direction: 1 | -1 = event.shiftKey ? -1 : 1;
      const nextIndex = getWrappedFocusIndex(currentIndex, direction, focusables.length);

      if (nextIndex >= 0) {
        event.preventDefault();
        focusables[nextIndex].focus();
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimeout);
      container.removeEventListener("keydown", handleKeyDown);

      if (canRestoreFocus(previousActiveRef.current)) {
        previousActiveRef.current.focus();
      }
    };
  }, [active, containerRef, onEscape]);
}
