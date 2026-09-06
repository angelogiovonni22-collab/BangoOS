"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Compatibility route for legacy links that target /orion.
 * Orion's production UI is owned by the persistent app-shell surface and
 * global Command Center overlay, so this route opens that existing surface
 * instead of mounting a second Orion implementation.
 */
export default function OrionCompatibilityRoute() {
  const router = useRouter();

  useEffect(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", {
      key: "k",
      code: "KeyK",
      ctrlKey: true,
      bubbles: true,
    }));

    const frameId = window.requestAnimationFrame(() => {
      router.replace("/dashboard");
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [router]);

  return (
    <main className="sr-only" aria-live="polite">
      Opening Orion Command Center.
    </main>
  );
}
