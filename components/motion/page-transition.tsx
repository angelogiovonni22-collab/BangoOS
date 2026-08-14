"use client";

import type { ReactNode } from "react";
import { FadeIn } from "./fade-in";

type PageTransitionProps = {
  transitionKey: string;
  children: ReactNode;
  className?: string;
};

export function PageTransition({ transitionKey, children, className }: PageTransitionProps) {
  return (
    <FadeIn key={transitionKey} className={className} durationMs={180} distancePx={4}>
      {children}
    </FadeIn>
  );
}
