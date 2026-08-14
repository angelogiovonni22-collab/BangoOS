"use client";

import type { ReactNode } from "react";
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type PortalHostProps = {
  children: ReactNode;
  container?: HTMLElement | null;
};

function subscribeNoop() {
  return () => undefined;
}

function getClientMountedSnapshot() {
  return true;
}

function getServerMountedSnapshot() {
  return false;
}

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
  const mounted = useSyncExternalStore(subscribeNoop, getClientMountedSnapshot, getServerMountedSnapshot);

  if (!mounted) {
    return null;
  }

  const target = resolvePortalContainer(container);

  if (!target) {
    return null;
  }

  return createPortal(children, target);
}