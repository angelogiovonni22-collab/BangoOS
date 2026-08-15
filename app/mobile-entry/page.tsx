"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MobileEntryPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<"opening" | "loading">("opening");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    const run = async () => {
      const desktop = window.matchMedia("(min-width: 1024px)").matches;
      if (desktop) {
        router.replace("/app-entry");
        return;
      }

      const openingTimer = window.setTimeout(() => {
        if (!cancelled) setPhase("loading");
      }, 520);

      await new Promise((resolve) => window.setTimeout(resolve, 1050));
      if (cancelled) return;

      if (!supabase) {
        router.replace("/login?next=/mobile-home");
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;

      router.replace(user ? "/mobile-home" : "/login?next=/mobile-home");
      window.clearTimeout(openingTimer);
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="bos-mobile-launch-screen">
      <div className="bos-mobile-launch-logo" aria-label="B.O.S. Bango Operating System">
        <div className="bos-mobile-launch-ring bos-mobile-launch-ring-outer" />
        <div className="bos-mobile-launch-ring bos-mobile-launch-ring-inner" />
        <strong>B.O.S.</strong>
        <small>BANGO OPERATING SYSTEM</small>
      </div>
      <div className="bos-mobile-launch-status" aria-live="polite">
        <span>{phase === "opening" ? "Opening B.O.S." : "Loading B.O.S."}</span>
        <div className="bos-mobile-launch-track"><i className={phase === "loading" ? "is-loading" : ""} /></div>
      </div>
    </main>
  );
}
