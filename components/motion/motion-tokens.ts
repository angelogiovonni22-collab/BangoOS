export const BANGO_MOTION_TOKENS = {
  durationMs: {
    instant: 0,
    fast: 140,
    standard: 210,
    deliberate: 260,
    emphasis: 320,
  },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    enter: "cubic-bezier(0.16, 1, 0.3, 1)",
    exit: "cubic-bezier(0.4, 0, 1, 1)",
    springSoft: "cubic-bezier(0.22, 1, 0.36, 1)",
    springFirm: "cubic-bezier(0.2, 0.9, 0.2, 1)",
  },
  distancePx: {
    subtle: 6,
    panel: 14,
    drawer: 22,
  },
  opacity: {
    hidden: 0,
    muted: 0.62,
    visible: 1,
  },
  scale: {
    press: 0.985,
    hover: 1.01,
    emphasis: 1.02,
  },
} as const;

export type BangoMotionTokens = typeof BANGO_MOTION_TOKENS;
