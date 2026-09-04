"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import styles from "./BosStartupIntro.module.css";

const SESSION_KEY = "bos-startup-intro-shown";
const VIDEO_SRC = "/branding/Mobile_app_startup_logo_animation_202609032341_iOS_optimized%20(1).mp4";
const FALLBACK_LOGO_SRC = "/branding/bos-operating-system-logo.png";
const LOAD_TIMEOUT_MS = 5000;
const PLAYBACK_TIMEOUT_MS = 15000;

type IntroState = "checking" | "video" | "fallback" | "fading" | "hidden";

export function BosStartupIntro() {
  const [state, setState] = useState<IntroState>("checking");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const loadTimerRef = useRef<number | null>(null);
  const playbackTimerRef = useRef<number | null>(null);
  const playRequestedRef = useRef(false);

  const clearTimers = () => {
    for (const ref of [fallbackTimerRef, finishTimerRef, loadTimerRef, playbackTimerRef]) {
      if (ref.current !== null) {
        window.clearTimeout(ref.current);
        ref.current = null;
      }
    }
  };

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
      loadTimerRef.current = window.setTimeout(() => {
        setState((current) => (current === "video" ? "fallback" : current));
      }, LOAD_TIMEOUT_MS);
    });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      clearTimers();
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const active = state !== "hidden";

    html.classList.toggle("bos-startup-active", active);
    body.classList.toggle("bos-startup-active", active);

    return () => {
      html.classList.remove("bos-startup-active");
      body.classList.remove("bos-startup-active");
    };
  }, [state]);

  useEffect(() => {
    if (state !== "fallback") return;
    fallbackTimerRef.current = window.setTimeout(() => {
      setState("fading");
      finishTimerRef.current = window.setTimeout(() => setState("hidden"), 320);
    }, 2200);

    return () => {
      if (fallbackTimerRef.current !== null) {
        window.clearTimeout(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };
  }, [state]);

  const finish = () => {
    clearTimers();
    setState("fading");
    finishTimerRef.current = window.setTimeout(() => setState("hidden"), 320);
  };

  const requestPlayback = async () => {
    const video = videoRef.current;
    if (!video || playRequestedRef.current) return;

    playRequestedRef.current = true;
    try {
      video.muted = true;
      video.defaultMuted = true;
      await video.play();
    } catch {
      playRequestedRef.current = false;
      setState("fallback");
    }
  };

  const handlePlaying = () => {
    if (loadTimerRef.current !== null) {
      window.clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    if (playbackTimerRef.current !== null) {
      window.clearTimeout(playbackTimerRef.current);
    }
    playbackTimerRef.current = window.setTimeout(finish, PLAYBACK_TIMEOUT_MS);
  };

  if (state === "hidden") return null;

  return (
    <div
      className={`${styles.root} ${state === "fading" ? styles.fading : ""}`}
      aria-hidden="true"
    >
      <div className={styles.ambient} />

      {state === "fallback" ? (
        <div className={`${styles.fallback} ${styles.fallbackPlaying}`}>
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
      ) : state === "video" ? (
        <video
          ref={videoRef}
          className={styles.video}
          src={VIDEO_SRC}
          autoPlay
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onLoadedMetadata={requestPlayback}
          onCanPlay={requestPlayback}
          onPlaying={handlePlaying}
          onEnded={finish}
          onError={() => setState("fallback")}
          onStalled={() => setState("fallback")}
        />
      ) : null}
    </div>
  );
}
