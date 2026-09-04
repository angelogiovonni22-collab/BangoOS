"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./BosStartupIntro.module.css";

const SESSION_KEY = "bos-startup-intro-shown";
const VIDEO_SRC = "/branding/Mobile_app_startup_logo_animation_202609032341.mp4";
const FALLBACK_LOGO_SRC = "/branding/bos-operating-system-logo.png";
const MAX_VIDEO_WAIT_MS = 15000;

type IntroState = "checking" | "video" | "fallback" | "fading" | "hidden";

export function BosStartupIntro() {
  const [state, setState] = useState<IntroState>("checking");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const videoWatchdogRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const frame = window.requestAnimationFrame(() => {
      if (cancelled) return;

      const isMobile = window.matchMedia("(max-width: 1023px)").matches;
      const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const alreadyShown = window.sessionStorage.getItem(SESSION_KEY) === "1";

      if (!isMobile || reducedMotion || alreadyShown) {
        setState("hidden");
        return;
      }

      window.sessionStorage.setItem(SESSION_KEY, "1");
      setState("video");
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
      }
      if (finishTimerRef.current !== null) {
        window.clearTimeout(finishTimerRef.current);
      }
      if (videoWatchdogRef.current !== null) {
        window.clearTimeout(videoWatchdogRef.current);
      }
    };
  }, []);

  const clearVideoWatchdog = () => {
    if (videoWatchdogRef.current !== null) {
      window.clearTimeout(videoWatchdogRef.current);
      videoWatchdogRef.current = null;
    }
  };

  const finish = () => {
    clearVideoWatchdog();
    setState("fading");
    if (finishTimerRef.current !== null) {
      window.clearTimeout(finishTimerRef.current);
    }
    finishTimerRef.current = window.setTimeout(() => setState("hidden"), 320);
  };

  const startFallback = () => {
    clearVideoWatchdog();
    startedRef.current = true;
    setState("fallback");
    if (fallbackTimerRef.current !== null) {
      window.clearTimeout(fallbackTimerRef.current);
    }
    fallbackTimerRef.current = window.setTimeout(finish, 3900);
  };

  const startVideo = async () => {
    const video = videoRef.current;
    if (!video || startedRef.current) return;

    startedRef.current = true;
    try {
      video.currentTime = 0;
      await video.play();
      videoWatchdogRef.current = window.setTimeout(finish, MAX_VIDEO_WAIT_MS);
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
          <Image
            src={FALLBACK_LOGO_SRC}
            alt=""
            width={720}
            height={672}
            priority
            className={styles.fallbackLogo}
          />
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
