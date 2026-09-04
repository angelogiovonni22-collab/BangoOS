"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./BosStartupIntro.module.css";

const SESSION_KEY = "bos-startup-intro-shown";
const VIDEO_SRC = "/branding/bos-startup.mp4";
const FALLBACK_LOGO_SRC = "/branding/bos-operating-system-logo.png";

type IntroState = "checking" | "video" | "fallback" | "fading" | "hidden";

export function BosStartupIntro() {
  const [state, setState] = useState<IntroState>("checking");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 1023px)").matches;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === "1";

    if (!isMobile || reducedMotion || alreadyShown) {
      setState("hidden");
      return;
    }

    window.sessionStorage.setItem(SESSION_KEY, "1");
    setState("video");

    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  const finish = () => {
    setState("fading");
    window.setTimeout(() => setState("hidden"), 320);
  };

  const startFallback = () => {
    setState("fallback");
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = window.setTimeout(finish, 3900);
  };

  const startVideo = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      video.currentTime = 0;
      await video.play();
    } catch {
      startFallback();
    }
  };

  if (state === "hidden") return null;

  const isFallback = state === "checking" || state === "fallback";

  return (
    <div
      className={`${styles.root} ${state === "fading" ? styles.fading : ""}`}
      aria-hidden="true"
    >
      <div className={styles.ambient} />

      {isFallback ? (
        <div className={`${styles.fallback} ${state === "fallback" ? styles.fallbackPlaying : ""}`}>
          <img src={FALLBACK_LOGO_SRC} alt="" className={styles.fallbackLogo} />
          <div className={styles.fallbackGlow} />
        </div>
      ) : (
        <video
          ref={videoRef}
          className={styles.video}
          src={VIDEO_SRC}
          poster={FALLBACK_LOGO_SRC}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onCanPlay={startVideo}
          onEnded={finish}
          onError={startFallback}
        />
      )}
    </div>
  );
}
