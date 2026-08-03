"use client";

import { useEffect, useMemo, useRef } from "react";
import { getPersistentOrionPalette } from "./fixtures";
import type { PersistentOrionStateId } from "./types";

type PersistentOrionMiniSphereProps = {
  state: PersistentOrionStateId;
  reducedMotion: boolean;
  minimized: boolean;
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
    size: 0.32 + (Math.random() * 1.08),
    twinkle: Math.random() * Math.PI * 2,
    hue: Math.random(),
    sparkle: index % 29 === 0,
  };
}

function motionProfile(state: PersistentOrionStateId) {
  if (state === "ANALYZING") {
    return { base: 0.99, amp: 0.045, speed: 1.2, rotation: 0.38, static: false, lineDistance: 0.52 };
  }

  if (state === "NEW_INSIGHT") {
    return { base: 0.99, amp: 0.036, speed: 1.08, rotation: 0.26, static: false, lineDistance: 0.5 };
  }

  if (state === "ATTENTION") {
    return { base: 1, amp: 0.008, speed: 0.82, rotation: 0.16, static: false, lineDistance: 0.48 };
  }

  if (state === "CRITICAL") {
    return { base: 1, amp: 0.006, speed: 0.78, rotation: 0.14, static: false, lineDistance: 0.46 };
  }

  if (state === "STALE_DATA") {
    return { base: 0.98, amp: 0.01, speed: 0.64, rotation: 0.1, static: false, lineDistance: 0.42 };
  }

  if (state === "UNAVAILABLE") {
    return { base: 0.97, amp: 0, speed: 0, rotation: 0, static: true, lineDistance: 0.36 };
  }

  return { base: 0.99, amp: 0.05, speed: 1.02, rotation: 0.24, static: false, lineDistance: 0.5 };
}

export function PersistentOrionMiniSphere({ state, reducedMotion, minimized }: PersistentOrionMiniSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);
  const loopTokenRef = useRef(0);
  const hiddenRef = useRef(false);

  const palette = useMemo(() => getPersistentOrionPalette(state), [state]);
  const profile = useMemo(() => motionProfile(state), [state]);

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

    const particleCount = window.innerWidth < 768 ? MOBILE_PARTICLES : DESKTOP_PARTICLES;
    const connectionCount = window.innerWidth < 768 ? MOBILE_CONNECTIONS : DESKTOP_CONNECTIONS;

    const particles: MiniParticle[] = Array.from({ length: particleCount }, (_, index) => randomMiniParticle(index));
    const edges: Array<[number, number]> = [];

    for (let index = 0; index < connectionCount; index += 1) {
      edges.push([
        Math.floor(Math.random() * particleCount),
        Math.floor(Math.random() * particleCount),
      ]);
    }

    let width = 0;
    let height = 0;
    let dpr = 1;
    let centerX = 0;
    let centerY = 0;
    let radius = 0;

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.floor(bounds.width * dpr));
      canvas.height = Math.max(1, Math.floor(bounds.height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      width = bounds.width;
      height = bounds.height;
      centerX = width / 2;
      centerY = height / 2;
      radius = Math.min(width, height) * (minimized ? 0.35 : 0.37);
    };

    const project = (source: MiniParticle, angle: number, breath: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const x = (source.x * cos) - (source.z * sin);
      const z = (source.x * sin) + (source.z * cos);
      const perspective = 1 / (1.6 - (z * 0.32));
      return {
        x: centerX + (x * radius * breath * perspective),
        y: centerY + (source.y * radius * breath * perspective),
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

      const staticMode = reducedMotion || profile.static;
      const animate = !staticMode && !hiddenRef.current;
      const time = timestamp / 1000;
      const breath = animate
        ? profile.base + (Math.sin(time * profile.speed) * profile.amp)
        : profile.base;
      const rotation = animate ? time * profile.rotation : 0.42;

      ctx.clearRect(0, 0, width, height);

      const projected = particles.map((particle) => project(particle, rotation, breath));

      ctx.lineWidth = state === "STALE_DATA" ? 0.26 : 0.34;
      for (const [leftIndex, rightIndex] of edges) {
        const left = projected[leftIndex];
        const right = projected[rightIndex];

        if (left.z < -0.6 && right.z < -0.6) {
          continue;
        }

        const distance = Math.hypot(left.x - right.x, left.y - right.y);
        if (distance > radius * profile.lineDistance) {
          continue;
        }

        const midpointDistance = Math.hypot(((left.x + right.x) / 2) - centerX, ((left.y + right.y) / 2) - centerY);
        const centerDamping = midpointDistance < (radius * 0.2) ? 0.36 : 1;
        const alpha = Math.max(0.04, (0.13 - (distance / (radius * 5.8))) * centerDamping);

        ctx.strokeStyle = `rgba(${palette.line}, ${alpha})`;
        ctx.beginPath();
        ctx.moveTo(left.x, left.y);
        ctx.lineTo(right.x, right.y);
        ctx.stroke();
      }

      projected
        .map((point, index) => ({ point, source: particles[index] }))
        .sort((left, right) => left.point.z - right.point.z)
        .forEach(({ point, source }) => {
          const depth = (point.z + 1) / 2;
          const twinkle = animate ? (0.8 + (0.2 * Math.sin((time * 2.4) + source.twinkle))) : 1;
          const baseAlpha = (0.32 + (depth * 0.72)) * twinkle;
          const color = source.hue > 0.7 ? palette.accent : source.hue > 0.42 ? palette.core : palette.ring;

          const coreSize = Math.max(0.26, point.size * (0.5 + (depth * 0.62)));
          ctx.fillStyle = `rgba(${color}, ${Math.min(0.98, baseAlpha)})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, coreSize, 0, Math.PI * 2);
          ctx.fill();

          if (source.sparkle && depth > 0.56) {
            ctx.fillStyle = `rgba(244, 250, 255, ${Math.min(0.92, 0.56 + (depth * 0.3))})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, 0.46, 0, Math.PI * 2);
            ctx.fill();
          }
        });

      const corePulse = animate ? 1 + (Math.sin(time * 2.05) * 0.07) : 1;
      const core = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 13.2 * corePulse * breath);
      core.addColorStop(0, "rgba(248, 252, 255, 1)");
      core.addColorStop(0.14, `rgba(${palette.core}, 0.98)`);
      core.addColorStop(0.42, `rgba(${palette.accent}, 0.78)`);
      core.addColorStop(1, `rgba(${palette.ring}, 0)`);
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 13.6 * corePulse * breath, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(250, 252, 255, 0.92)";
      ctx.beginPath();
      ctx.arc(centerX, centerY, 1.45 * corePulse, 0, Math.PI * 2);
      ctx.fill();

      if (animate) {
        rafRef.current = window.requestAnimationFrame(draw);
      } else {
        rafRef.current = null;
      }
    };

    const onVisibility = () => {
      hiddenRef.current = document.visibilityState === "hidden";

      if (hiddenRef.current) {
        cancelFrame();
        return;
      }

      if (rafRef.current === null) {
        rafRef.current = window.requestAnimationFrame(draw);
      }
    };

    resize();
    hiddenRef.current = document.visibilityState === "hidden";

    observerRef.current = new ResizeObserver(() => {
      resize();
      if (rafRef.current === null) {
        draw(performance.now());
      }
    });

    observerRef.current.observe(canvas);
    document.addEventListener("visibilitychange", onVisibility);
    rafRef.current = window.requestAnimationFrame(draw);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      cancelFrame();
      observerRef.current?.disconnect();
      observerRef.current = null;
      loopTokenRef.current += 1;
    };
  }, [palette, profile, reducedMotion, state, minimized]);

  return <canvas ref={canvasRef} className="persistentOrionCanvas" aria-hidden="true" />;
}
