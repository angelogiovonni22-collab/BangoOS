"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const STARTUP_VIDEO_SRC = "/media/bos-startup.mp4";
const MOBILE_DESTINATION = "/mobile-home";
const STARTUP_FAILSAFE_MS = 9000;

export function AppEntryClient({ desktopPath }: { desktopPath: string }) {
  const router = useRouter();
  const [showStartup, setShowStartup] = useState(false);

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!mobile || reducedMotion) {
      router.replace(mobile ? MOBILE_DESTINATION : desktopPath);
      return;
    }

    setShowStartup(true);

    const failSafe = window.setTimeout(() => {
      router.replace(MOBILE_DESTINATION);
    }, STARTUP_FAILSAFE_MS);

    return () => window.clearTimeout(failSafe);
  }, [desktopPath, router]);

  if (!showStartup) {
    return (
      <main className="bos-mobile-entry-screen" aria-live="polite">
        <div className="bos-mobile-entry-mark" aria-hidden="true">B.O.S.</div>
        <p>Preparing your workspace…</p>
      </main>
    );
  }

  return (
    <main
      aria-label="B.O.S. startup"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        display: "grid",
        placeItems: "center",
        overflow: "hidden",
        background: "#000",
      }}
    >
      <video
        autoPlay
        muted
        playsInline
        preload="auto"
        poster="/api/app-icon-v3/512"
        aria-label="B.O.S. opening animation"
        onEnded={() => router.replace(MOBILE_DESTINATION)}
        onError={() => router.replace(MOBILE_DESTINATION)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: "center",
          background: "#000",
        }}
      >
        <source src={STARTUP_VIDEO_SRC} type="video/mp4" />
      </video>
    </main>
  );
}
