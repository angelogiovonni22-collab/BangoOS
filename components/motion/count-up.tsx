"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMotionPreferences } from "./motion-provider";

type CountUpProps = {
  value: number;
  className?: string;
  durationMs?: number;
  precision?: number;
  formatter?: (value: number) => string;
};

export function CountUp({ value, className, durationMs = 260, precision = 0, formatter }: CountUpProps) {
  const { reducedMotion } = useMotionPreferences();
  const [display, setDisplay] = useState(value);
  const displayValueRef = useRef(value);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    if (reducedMotion) {
      displayValueRef.current = value;
      return;
    }

    const start = performance.now();
    const from = displayValueRef.current;
    const to = value;

    if (from === to) {
      displayValueRef.current = to;
      return;
    }

    const frame = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = from + (to - from) * eased;
      displayValueRef.current = next;
      setDisplay(next);

      if (progress < 1) {
        rafIdRef.current = requestAnimationFrame(frame);
      } else {
        displayValueRef.current = to;
        rafIdRef.current = null;
      }
    };

    rafIdRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [durationMs, reducedMotion, value]);

  const text = useMemo(() => {
    const source = reducedMotion ? value : display;
    const rounded = Number(source.toFixed(precision));
    return formatter ? formatter(rounded) : rounded.toLocaleString();
  }, [display, formatter, precision, reducedMotion, value]);

  return <span className={className}>{text}</span>;
}
