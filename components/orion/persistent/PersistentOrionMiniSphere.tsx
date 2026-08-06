"use client";

import { useEffect, useMemo, useRef } from "react";
import type { PersistentOrionVisualState } from "./types";

type PersistentOrionMiniSphereProps = {
  state: PersistentOrionVisualState;
  reducedMotion: boolean;
  minimized: boolean;
  voiceLevel: number;
};

type MiniParticle = {
  x: number;
  y: number;
  z: number;
  size: number;
  twinkle: number;
  hue: number;
  sparkle: boolean;
};

const DESKTOP_PARTICLES = 184;
const MOBILE_PARTICLES = 124;
const DESKTOP_CONNECTIONS = 78;
const MOBILE_CONNECTIONS = 56;

function randomMiniParticle(index: number): MiniParticle {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos((2 * v) - 1);

  return {
    x: Math.sin(phi) * Math.cos(theta),
    y: Math.sin(phi) * Math.sin(theta),
    z: Math.cos(phi),
    size: 0.32 + Math.random() * 1.08,
    twinkle: Math.random() * Math.PI * 2,
    hue: Math.random(),
    sparkle: index % 29 === 0,
  };
}

function motionProfile(state: PersistentOrionVisualState) {
  if (state === "listening") {
    return {
      base: 1,
      amp: 0.06,
      speed: 1.35,
      rotation: 0.32,
      static: false,
      lineDistance: 0.54,
    };
  }

  if (state === "thinking") {
    return {
      base: 0.99,
      amp: 0.04,
      speed: 1.4,
      rotation: 0.4,
      static: false,
      lineDistance: 0.52,
    };
  }

  if (state === "executing") {
    return {
      base: 1.02,
      amp: 0.03,
      speed: 1.55,
      rotation: 0.58,
      static: false,
      lineDistance: 0.56,
    };
  }

  if (state === "speaking") {
    return {
      base: 1,
      amp: 0.04,
      speed: 1.2,
      rotation: 0.26,
      static: false,
      lineDistance: 0.53,
    };
  }

  if (state === "confirmation") {
    return {
      base: 0.99,
      amp: 0.015,
      speed: 0.82,
      rotation: 0.15,
      static: false,
      lineDistance: 0.48,
    };
  }

  if (state === "success") {
    return {
      base: 1.01,
      amp: 0.02,
      speed: 1.05,
      rotation: 0.22,
      static: false,
      lineDistance: 0.5,
    };
  }

  if (state === "error") {
    return {
      base: 0.99,
      amp: 0.02,
      speed: 0.9,
      rotation: 0.2,
      static: false,
      lineDistance: 0.47,
    };
  }

  if (state === "disabled") {
    return {
      base: 0.97,
      amp: 0,
      speed: 0,
      rotation: 0,
      static: true,
      lineDistance: 0.36,
    };
  }

  return {
    base: 0.99,
    amp: 0.02,
    speed: 0.78,
    rotation: 0.16,
    static: false,
    lineDistance: 0.48,
  };
}

function paletteForState(state: PersistentOrionVisualState) {
  if (state === "error") {
    return {
      ring: "164, 88, 72",
      glow: "152, 82, 66",
      core: "250, 141, 112",
      accent: "242, 118, 86",
      line: "158, 98, 83",
    };
  }

  if (state === "success") {
    return {
      ring: "69, 132, 161",
      glow: "63, 126, 154",
      core: "132, 226, 255",
      accent: "94, 197, 244",
      line: "82, 150, 186",
    };
  }

  if (state === "confirmation") {
    return {
      ring: "89, 131, 182",
      glow: "78, 119, 165",
      core: "162, 204, 255",
      accent: "126, 176, 232",
      line: "97, 139, 189",
    };
  }

  return {
    ring: "61, 111, 194",
    glow: "54, 99, 178",
    core: "131, 201, 255",
    accent: "92, 167, 232",
    line: "82, 139, 212",
  };
}

export function PersistentOrionMiniSphere({
  state,
  reducedMotion,
  minimized,
  voiceLevel,
}: PersistentOrionMiniSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const loopTokenRef = useRef(0);
  const hiddenRef = useRef(false);

  const palette = useMemo(() => paletteForState(state), [state]);

  const profile = useMemo(
    () => motionProfile(state),
    [state],
  );

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");

    if (!ctx) {
      return;
    }

    loopTokenRef.current += 1;
    const token = loopTokenRef.current;

    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile
      ? MOBILE_PARTICLES
      : DESKTOP_PARTICLES;
    const connectionCount = isMobile
      ? MOBILE_CONNECTIONS
      : DESKTOP_CONNECTIONS;

    const particles: MiniParticle[] = Array.from(
      { length: particleCount },
      (_, index) => randomMiniParticle(index),
    );

    const edges: Array<[number, number]> = [];

    for (let index = 0; index < connectionCount; index += 1) {
      edges.push([
        Math.floor(Math.random() * particleCount),
        Math.floor(Math.random() * particleCount),
      ]);
    }

    let width = minimized ? 64 : isMobile ? 86 : 116;
    let height = width;
    let dpr = 1;
    let centerX = width / 2;
    let centerY = height / 2;
    let radius = Math.min(width, height) * (minimized ? 0.35 : 0.37);

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();

      const fallbackSize = minimized
        ? 64
        : window.innerWidth < 768
          ? 86
          : 116;

      width = bounds.width > 0 ? bounds.width : fallbackSize;
      height = bounds.height > 0 ? bounds.height : fallbackSize;

      dpr = Math.min(window.devicePixelRatio || 1, 2);

      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));

      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      centerX = width / 2;
      centerY = height / 2;
      radius =
        Math.min(width, height) *
        (minimized ? 0.35 : 0.37);
    };

    const project = (
      source: MiniParticle,
      angle: number,
      breath: number,
    ) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);

      const x = source.x * cos - source.z * sin;
      const z = source.x * sin + source.z * cos;
      const perspective = 1 / (1.6 - z * 0.32);

      return {
        x: centerX + x * radius * breath * perspective,
        y: centerY + source.y * radius * breath * perspective,
        z,
        size: source.size * perspective,
      };
    };

    const cancelFrame = () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const draw = (timestamp: number) => {
      if (token !== loopTokenRef.current) {
        return;
      }

      if (width <= 0 || height <= 0 || radius <= 0) {
        resize();
      }

      const staticMode = reducedMotion || profile.static;
      const animate = !staticMode && !hiddenRef.current;
      const time = timestamp / 1000;
      const speakingBoost = state === "speaking"
        ? Math.min(Math.max(voiceLevel, 0), 1) * 0.2
        : 0;
      const speakingWaveIntensity = state === "speaking"
        ? Math.min(Math.max(voiceLevel, 0), 1)
        : 0;

      const breath = animate
        ? profile.base +
          Math.sin(time * profile.speed) * profile.amp + speakingBoost
        : profile.base;

      const rotation = animate
        ? time * profile.rotation
        : 0.42;

      ctx.clearRect(0, 0, width, height);

      const projected = particles.map((particle) => {
        const point = project(particle, rotation, breath);

        if (speakingWaveIntensity > 0) {
          const radial = radius > 0
            ? (point.x - centerX) / radius
            : 0;
          const ripple = Math.sin((radial * 2.6) + (time * 8.4) + particle.twinkle) * radius * 0.018 * speakingWaveIntensity;
          point.y += ripple;
        }

        return point;
      });

      ctx.lineWidth = state === "disabled" ? 0.24 : 0.34;

      for (const [leftIndex, rightIndex] of edges) {
        const left = projected[leftIndex];
        const right = projected[rightIndex];

        if (left.z < -0.6 && right.z < -0.6) {
          continue;
        }

        const distance = Math.hypot(
          left.x - right.x,
          left.y - right.y,
        );

        if (distance > radius * profile.lineDistance) {
          continue;
        }

        const midpointDistance = Math.hypot(
          (left.x + right.x) / 2 - centerX,
          (left.y + right.y) / 2 - centerY,
        );

        const centerDamping =
          midpointDistance < radius * 0.2 ? 0.36 : 1;

        const alpha = Math.max(
          0.04,
          (0.13 - distance / (radius * 5.8)) *
            centerDamping,
        );

        ctx.strokeStyle = `rgba(${palette.line}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      }

      projected
        .map((point, index) => ({
          point,
          source: particles[index],
        }))
        .sort(
          (left, right) =>
            left.point.z - right.point.z,
        )
        .forEach(({ point, source }) => {
          const depth = (point.z + 1) / 2;

          const twinkle = animate
            ? 0.8 +
              0.2 *
                Math.sin(
                  time * 2.4 + source.twinkle,
                )
            : 1;

          const baseAlpha =
            (0.32 + depth * 0.72) * twinkle;

          const color =
            source.hue > 0.7
              ? palette.accent
              : source.hue > 0.42
                ? palette.core
                : palette.ring;

          const coreSize = Math.max(
            0.4,
            point.size * (0.58 + depth * 0.72),
          );

          ctx.fillStyle = `rgba(${color}, ${Math.min(
            1,
            baseAlpha,
          )})`;

          ctx.beginPath();
          ctx.arc(
            point.x,
            point.y,
            coreSize,
            0,
            Math.PI * 2,
          );
          ctx.fill();

          if (source.sparkle && depth > 0.56) {
            ctx.fillStyle = `rgba(244, 250, 255, ${Math.min(
              0.96,
              0.62 + depth * 0.3,
            )})`;

            ctx.beginPath();
            ctx.arc(
              point.x,
              point.y,
              0.6,
              0,
              Math.PI * 2,
            );
            ctx.fill();
          }
        });

      const corePulse = animate
        ? 1 + Math.sin(time * 2.05) * 0.07 + speakingBoost * 0.7
        : 1;

      const coreRadius =
        13.2 * corePulse * breath;

      const core = ctx.createRadialGradient(
        centerX,
        centerY,
        0,
        centerX,
        centerY,
        coreRadius,
      );

      core.addColorStop(
        0,
        "rgba(248, 252, 255, 1)",
      );
      core.addColorStop(
        0.14,
        `rgba(${palette.core}, 0.98)`,
      );
      core.addColorStop(
        0.42,
        `rgba(${palette.accent}, 0.78)`,
      );
      core.addColorStop(
        1,
        `rgba(${palette.ring}, 0)`,
      );

      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        13.6 * corePulse * breath,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      ctx.fillStyle =
        "rgba(250, 252, 255, 0.98)";

      ctx.beginPath();
      ctx.arc(
        centerX,
        centerY,
        1.7 * corePulse,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      if (state === "listening" || state === "speaking") {
        const ringPulse = animate
          ? Math.sin(time * (state === "speaking" ? 2.6 : 2.1))
          : 0;
        const expansion = state === "speaking"
          ? 5 + (8 * speakingWaveIntensity)
          : 4;
        const ringRadius = (radius * 0.9) + expansion + (ringPulse * 2.2);
        const ringAlpha = state === "speaking"
          ? 0.24 + (0.2 * speakingWaveIntensity)
          : 0.2;

        ctx.lineWidth = 1.05;
        ctx.strokeStyle = `rgba(${palette.accent}, ${Math.min(0.45, ringAlpha)})`;
        ctx.beginPath();
        ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
        ctx.stroke();
      }

      if (state === "thinking") {
        const orbitRadius = radius * 0.78;
        const dotSize = minimized ? 1.2 : 1.45;

        for (let index = 0; index < 3; index += 1) {
          const angle = (time * 1.42) + (index * ((Math.PI * 2) / 3));
          const orbitX = centerX + Math.cos(angle) * orbitRadius;
          const orbitY = centerY + Math.sin(angle) * orbitRadius * 0.7;

          ctx.fillStyle = `rgba(${palette.core}, ${0.4 - (index * 0.08)})`;
          ctx.beginPath();
          ctx.arc(orbitX, orbitY, dotSize, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      if (animate) {
        rafRef.current =
          window.requestAnimationFrame(draw);
      } else {
        rafRef.current = null;
      }
    };

    const requestDraw = () => {
      cancelFrame();
      rafRef.current =
        window.requestAnimationFrame(draw);
    };

    const handleResize = () => {
      resize();
      requestDraw();
    };

    const handleVisibilityChange = () => {
      hiddenRef.current =
        document.visibilityState === "hidden";

      if (hiddenRef.current) {
        cancelFrame();
        return;
      }

      resize();
      requestDraw();
    };

    resize();

    hiddenRef.current =
      document.visibilityState === "hidden";

    if (typeof ResizeObserver !== "undefined") {
      observerRef.current = new ResizeObserver(
        handleResize,
      );

      observerRef.current.observe(canvas);
    }

    window.addEventListener("resize", handleResize);
    window.visualViewport?.addEventListener(
      "resize",
      handleResize,
    );

    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    requestDraw();

    const delayedResizeId = window.setTimeout(() => {
      resize();

      if (rafRef.current === null) {
        requestDraw();
      }
    }, 150);

    return () => {
      window.clearTimeout(delayedResizeId);

      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );

      window.removeEventListener(
        "resize",
        handleResize,
      );

      window.visualViewport?.removeEventListener(
        "resize",
        handleResize,
      );

      cancelFrame();

      observerRef.current?.disconnect();
      observerRef.current = null;

      loopTokenRef.current += 1;
    };
  }, [
    minimized,
    palette,
    profile,
    reducedMotion,
    state,
    voiceLevel,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="persistentOrionCanvas"
      aria-hidden="true"
    />
  );
}