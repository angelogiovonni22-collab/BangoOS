"use client";

import { useEffect } from "react";
import { lockDocumentBody, unlockDocumentBody } from "./overlay-runtime";

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof document === "undefined") {
      return;
    }

    lockDocumentBody(document);

    return () => {
      unlockDocumentBody(document);
    };
  }, [active]);
}