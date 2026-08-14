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
const EMPTY_OVERLAY_STACK: readonly string[] = Object.freeze([]);
let overlayStack: readonly string[] = EMPTY_OVERLAY_STACK;

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
  const hadStackEntries = overlayStack.length > 0;
  bodyScrollLockCount = 0;
  previousBodyOverflow = "";
  overlayStack = EMPTY_OVERLAY_STACK;

  if (hadStackEntries) {
    emitOverlayChange();
  }
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

  const nextStack = overlayStack.filter((entry) => entry !== id);
  overlayStack = nextStack.length === 0 ? EMPTY_OVERLAY_STACK : nextStack;
  emitOverlayChange();
}

export function getOverlayStackSnapshot() {
  return overlayStack;
}

export function getOverlayStackServerSnapshot() {
  return EMPTY_OVERLAY_STACK;
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

  const stack = useSyncExternalStore(subscribeToOverlayStack, getOverlayStackSnapshot, getOverlayStackServerSnapshot);

  useEffect(() => {
    if (process.env.NODE_ENV === "production") {
      return;
    }

    console.info("[orion-debug] overlay runtime mounted");
  }, []);

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