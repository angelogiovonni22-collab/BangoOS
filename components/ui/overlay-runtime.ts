"use client";

import { useEffect, useId, useSyncExternalStore } from "react";

type DocumentLike = {
  body: {
    style: {
      overflow: string;
      removeProperty?: (property: string) => void;
    };
  };
};

let bodyScrollLockCount = 0;
let previousBodyOverflow = "";
let overlayStack: string[] = [];

const overlayListeners = new Set<() => void>();

function emitOverlayChange() {
  overlayListeners.forEach((listener) => listener());
}

function removeOverflow(style: DocumentLike["body"]["style"]) {
  if (typeof style.removeProperty === "function") {
    style.removeProperty("overflow");
    return;
  }

  style.overflow = "";
}

export function lockDocumentBody(documentLike: DocumentLike) {
  if (bodyScrollLockCount === 0) {
    previousBodyOverflow = documentLike.body.style.overflow;
    documentLike.body.style.overflow = "hidden";
  }

  bodyScrollLockCount += 1;
}

export function unlockDocumentBody(documentLike: DocumentLike) {
  if (bodyScrollLockCount === 0) {
    return;
  }

  bodyScrollLockCount -= 1;

  if (bodyScrollLockCount > 0) {
    return;
  }

  if (previousBodyOverflow) {
    documentLike.body.style.overflow = previousBodyOverflow;
  } else {
    removeOverflow(documentLike.body.style);
  }

  previousBodyOverflow = "";
}

export function getBodyScrollLockCount() {
  return bodyScrollLockCount;
}

export function resetOverlayRuntimeForTests() {
  bodyScrollLockCount = 0;
  previousBodyOverflow = "";
  overlayStack = [];
  emitOverlayChange();
}

export function registerOverlay(id: string) {
  if (overlayStack.includes(id)) {
    return;
  }

  overlayStack = [...overlayStack, id];
  emitOverlayChange();
}

export function unregisterOverlay(id: string) {
  if (!overlayStack.includes(id)) {
    return;
  }

  overlayStack = overlayStack.filter((entry) => entry !== id);
  emitOverlayChange();
}

export function getOverlayStackSnapshot() {
  return overlayStack;
}

export function isTopmostOverlay(id: string) {
  return overlayStack[overlayStack.length - 1] === id;
}

function subscribeToOverlayStack(listener: () => void) {
  overlayListeners.add(listener);

  return () => {
    overlayListeners.delete(listener);
  };
}

export function useTopmostOverlay(active: boolean) {
  const overlayId = useId();

  const stack = useSyncExternalStore(subscribeToOverlayStack, getOverlayStackSnapshot, () => []);

  useEffect(() => {
    if (!active) {
      return;
    }

    registerOverlay(overlayId);

    return () => {
      unregisterOverlay(overlayId);
    };
  }, [active, overlayId]);

  return stack[stack.length - 1] === overlayId;
}