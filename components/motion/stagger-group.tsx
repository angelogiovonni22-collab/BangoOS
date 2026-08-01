"use client";

import type { CSSProperties, ReactNode } from "react";
import { Children } from "react";
import { useMotionPreferences } from "./motion-provider";

type StaggerGroupProps = {
  children: ReactNode;
  className?: string;
  itemClassName?: string;
  staggerMs?: number;
  startDelayMs?: number;
  distancePx?: number;
  animate?: boolean;
};

export function StaggerGroup({
  children,
  className,
  itemClassName,
  staggerMs = 42,
  startDelayMs = 0,
  distancePx = 6,
  animate = true,
}: StaggerGroupProps) {
  const { reducedMotion } = useMotionPreferences();

  return (
    <div className={className}>
      {Children.map(children, (child, index) => {
        const style = {
          ["--bf-delay" as string]: `${Math.max(0, startDelayMs + index * staggerMs)}ms`,
          ["--bf-distance" as string]: `${Math.max(0, distancePx)}px`,
        } satisfies CSSProperties;

        if (reducedMotion || !animate) {
          return <div className={itemClassName}>{child}</div>;
        }

        return (
          <div className={["bf-fade-in", itemClassName].filter(Boolean).join(" ")} style={style}>
            {child}
          </div>
        );
      })}
    </div>
  );
}
