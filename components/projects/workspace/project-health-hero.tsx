"use client";

import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  GaugeCircle,
  Info,
  ShieldCheck,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { AnimatedProgress, CountUp, StatusPulse } from "@/components/motion";
import type { ProjectHealthResult, ProjectHealthTone } from "./project-health-calculator";

type ProjectHealthHeroProps = {
  health: ProjectHealthResult;
};

export function ProjectHealthHero({ health }: ProjectHealthHeroProps) {
  const ringPercent = typeof health.score === "number" ? Math.max(0, Math.min(100, health.score)) : 0;
  const ringValue = typeof health.score === "number" ? String(health.score) : "--";
  const tone = toneMap(health.tone);
  const emphasisTone = health.tone === "danger" ? "critical" : health.tone === "warning" ? "warning" : "neutral";
  const pulseKey = `${health.tone}:${ringPercent}`;

  return (
    <StatusPulse triggerKey={pulseKey} tone={emphasisTone} className="rounded-[18px]">
      <Card
        as="section"
        variant="elevated"
        className="overflow-hidden rounded-[18px] border-[var(--color-border-subtle)] shadow-[0_22px_44px_-28px_rgba(15,23,42,0.36)]"
      >
        <CardHeader className="border-b border-[var(--color-border-subtle)] bg-[linear-gradient(120deg,rgba(34,197,94,0.12),rgba(255,255,255,0.98),rgba(37,99,235,0.1))]">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--color-success-100)] text-[var(--color-success-700)]">
              <ShieldCheck size={18} aria-hidden="true" />
            </span>
            <CardTitle className="text-[1.3rem] font-bold tracking-[-0.01em] text-[var(--color-navy-900)]">Project Health</CardTitle>
          </div>
        </CardHeader>

        <CardContent className="space-y-5 p-6">
          <div className="grid items-stretch gap-5 xl:grid-cols-[318px_minmax(0,1fr)]">
            <section className="rounded-[16px] border border-[var(--color-border-subtle)] bg-white p-6 shadow-[var(--shadow-small)]">
              <div className="mx-auto flex w-full max-w-[210px] items-center justify-center">
                <HealthScoreRing percent={ringPercent} value={ringValue} color={tone.ring} />
              </div>

              <div className="mt-5 text-center">
                <p className="text-xl font-bold text-[var(--color-navy-900)]">{health.statusLabel}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--color-text-secondary)]">{health.summary}</p>
              </div>
            </section>

            <section className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <HealthWidget
                  icon={<GaugeCircle size={16} aria-hidden="true" />}
                  label="Progress"
                  value={health.progressLabel}
                  tone={toneFromText(health.progressLabel)}
                />
                <HealthWidget
                  icon={<CalendarClock size={16} aria-hidden="true" />}
                  label="Schedule"
                  value={health.scheduleCondition}
                  tone={toneFromText(health.scheduleCondition)}
                />
                <HealthWidget
                  icon={<CircleDollarSign size={16} aria-hidden="true" />}
                  label="Budget"
                  value={health.budgetCondition}
                  tone={toneFromText(health.budgetCondition)}
                />
                <HealthWidget
                  icon={<Info size={16} aria-hidden="true" />}
                  label="Due Date"
                  value={health.dueDateCondition}
                  tone={toneFromText(health.dueDateCondition)}
                />
              </div>

              <div className={`flex items-start gap-2.5 rounded-[14px] border px-4 py-3 ${tone.strip}`}>
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/70">
                  {tone.statusIcon}
                </span>
                <p className="text-sm font-semibold leading-6">
                  Project Health Status: {health.statusLabel}. {health.summary}
                </p>
              </div>
            </section>
          </div>
        </CardContent>
      </Card>
    </StatusPulse>
  );
}

function HealthScoreRing({ percent, value, color }: { percent: number; value: string; color: string }) {
  const size = 188;
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - percent / 100);

  const numericValue = useMemo(() => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : null;
  }, [value]);

  return (
    <div className="relative h-[188px] w-[188px]">
      <svg width={size} height={size} role="img" aria-label={`Project health score ${value}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(15,23,42,0.1)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{ transition: "stroke-dashoffset var(--bf-duration-deliberate) var(--bf-ease-spring-soft)" }}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-[2.3rem] font-bold leading-none tracking-[-0.02em] text-[var(--color-navy-900)]">
          {numericValue === null ? value : <CountUp value={numericValue} durationMs={300} />}
        </div>
        <div className="mt-1 text-[0.95rem] font-semibold text-[var(--color-text-secondary)]">/100</div>
      </div>
    </div>
  );
}

function HealthWidget({
  icon,
  label,
  value,
  tone,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  tone: ProjectHealthTone;
}) {
  const classes = toneMap(tone);

  return (
    <article className={`min-h-[128px] rounded-[14px] border p-4 shadow-[var(--shadow-small)] ${classes.card}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full ${classes.icon}`}>{icon}</span>
      </div>
      <p className="mt-3 text-[0.98rem] font-bold leading-snug text-[var(--color-navy-900)]">{value}</p>
      <AnimatedProgress
        value={toneIndicatorPercent(value)}
        className="mt-3 h-1.5"
        trackClassName="bg-white/70"
        fillClassName={classes.indicator}
        durationMs={220}
      />
    </article>
  );
}

function toneIndicatorPercent(value: string) {
  const progress = Number.parseInt(value.replace("%", ""), 10);
  if (Number.isFinite(progress)) {
    return Math.max(12, Math.min(100, progress));
  }

  if (value.toLowerCase().includes("overdue") || value.toLowerCase().includes("over budget")) {
    return 88;
  }

  if (value.toLowerCase().includes("risk") || value.toLowerCase().includes("compressed")) {
    return 64;
  }

  if (value.toLowerCase().includes("unavailable") || value.toLowerCase().includes("missing")) {
    return 26;
  }

  return 72;
}

function toneFromText(value: string): ProjectHealthTone {
  const normalized = value.toLowerCase();

  if (normalized.includes("overdue") || normalized.includes("late") || normalized.includes("over budget")) {
    return "danger";
  }

  if (normalized.includes("risk") || normalized.includes("near") || normalized.includes("compressed")) {
    return "warning";
  }

  if (normalized.includes("within") || normalized.includes("steady") || normalized.includes("complete")) {
    return "success";
  }

  if (normalized.includes("unavailable") || normalized.includes("missing") || normalized.includes("limited")) {
    return "neutral";
  }

  return "brand";
}

function toneMap(tone: ProjectHealthTone) {
  if (tone === "success") {
    return {
      ring: "#16a34a",
      card: "border-[var(--color-success-100)] bg-[linear-gradient(180deg,rgba(34,197,94,0.16),rgba(255,255,255,1))]",
      icon: "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
      indicator: "bg-[var(--color-success-500)]",
      strip: "border-[var(--color-success-200)] bg-[linear-gradient(90deg,rgba(34,197,94,0.2),rgba(255,255,255,0.9))] text-[var(--color-success-700)]",
      statusIcon: <CheckCircle2 size={14} className="text-[var(--color-success-700)]" aria-hidden="true" />,
    };
  }

  if (tone === "warning") {
    return {
      ring: "#f97316",
      card: "border-[var(--color-warning-200)] bg-[linear-gradient(180deg,rgba(249,115,22,0.16),rgba(255,255,255,1))]",
      icon: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
      indicator: "bg-[var(--color-warning-500)]",
      strip: "border-[var(--color-warning-200)] bg-[linear-gradient(90deg,rgba(249,115,22,0.2),rgba(255,255,255,0.9))] text-[var(--color-warning-700)]",
      statusIcon: <AlertTriangle size={14} className="text-[var(--color-warning-700)]" aria-hidden="true" />,
    };
  }

  if (tone === "danger") {
    return {
      ring: "#ef4444",
      card: "border-[var(--color-danger-200)] bg-[linear-gradient(180deg,rgba(239,68,68,0.16),rgba(255,255,255,1))]",
      icon: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]",
      indicator: "bg-[var(--color-danger-500)]",
      strip: "border-[var(--color-danger-200)] bg-[linear-gradient(90deg,rgba(239,68,68,0.2),rgba(255,255,255,0.9))] text-[var(--color-danger-700)]",
      statusIcon: <AlertTriangle size={14} className="text-[var(--color-danger-700)]" aria-hidden="true" />,
    };
  }

  if (tone === "neutral") {
    return {
      ring: "#64748b",
      card: "border-[var(--color-border-subtle)] bg-[linear-gradient(180deg,rgba(148,163,184,0.12),rgba(255,255,255,1))]",
      icon: "bg-[var(--color-neutral-100)] text-[var(--color-neutral-700)]",
      indicator: "bg-[var(--color-neutral-500)]",
      strip: "border-[var(--color-border-subtle)] bg-[linear-gradient(90deg,rgba(148,163,184,0.18),rgba(255,255,255,0.9))] text-[var(--color-neutral-700)]",
      statusIcon: <Info size={14} className="text-[var(--color-neutral-700)]" aria-hidden="true" />,
    };
  }

  return {
    ring: "#2563eb",
    card: "border-[var(--color-primary-100)] bg-[linear-gradient(180deg,rgba(37,99,235,0.15),rgba(255,255,255,1))]",
    icon: "bg-[var(--color-primary-100)] text-[var(--color-brand-700)]",
    indicator: "bg-[var(--color-brand-600)]",
    strip: "border-[var(--color-primary-200)] bg-[linear-gradient(90deg,rgba(37,99,235,0.2),rgba(255,255,255,0.9))] text-[var(--color-brand-700)]",
    statusIcon: <CheckCircle2 size={14} className="text-[var(--color-brand-700)]" aria-hidden="true" />,
  };
}
