"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function AppEntryClient({ desktopPath }: { desktopPath: string }) {
  const router = useRouter();

  useEffect(() => {
    const mobile = window.matchMedia("(max-width: 1023px)").matches;
    router.replace(mobile ? "/mobile-home" : desktopPath);
  }, [desktopPath, router]);

  return (
    <main className="bos-mobile-entry-screen" aria-live="polite">
      <div className="bos-mobile-entry-mark" aria-hidden="true">B.O.S.</div>
      <p>Preparing your workspace…</p>
    </main>
  );
}
