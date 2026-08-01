"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

type PortalHostProps = {
  children: ReactNode;
  container?: HTMLElement | null;
};

export function resolvePortalContainer(container?: HTMLElement | null) {
  if (container) {
    return container;
  }

  if (typeof document === "undefined") {
    return null;
  }

  return document.body;
}

export function PortalHost({ children, container }: PortalHostProps) {
  const target = resolvePortalContainer(container);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}