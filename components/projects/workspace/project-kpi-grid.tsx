import { CircleDollarSign, PiggyBank, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { CountUp } from "@/components/motion";

type ProjectKpiGridProps = {
  budgetLabel: string;
  spentLabel: string;
  remainingLabel: string;
  profitMarginLabel: string;
};

export function ProjectKpiGrid({
  budgetLabel,
  spentLabel,
  remainingLabel,
  profitMarginLabel,
}: ProjectKpiGridProps) {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project financial KPI widgets">
      <KpiCard
        label="Budget"
        value={budgetLabel}
        context="Approved financial baseline"
        icon={<CircleDollarSign size={19} aria-hidden="true" />}
        tone="budget"
      />
      <KpiCard
        label="Spent"
        value={spentLabel}
        context="Recorded paid invoices"
        icon={<Wallet size={19} aria-hidden="true" />}
        tone="spent"
      />
      <KpiCard
        label="Remaining"
        value={remainingLabel}
        context="Budget minus spent"
        icon={<PiggyBank size={19} aria-hidden="true" />}
        tone="remaining"
      />
      <KpiCard
        label="Profit Margin"
        value={profitMarginLabel}
        context="Derived from budget and spent"
        icon={<TrendingUp size={19} aria-hidden="true" />}
        tone="margin"
      />
    </section>
  );
}

function KpiCard({
  label,
  value,
  context,
  icon,
  tone,
}: {
  label: string;
  value: string;
  context: string;
  icon: ReactNode;
  tone: "budget" | "spent" | "remaining" | "margin";
}) {
  const classes = toneClasses(tone);
  const parsed = parseDisplayNumber(value);

  return (
    <article className={`min-h-[194px] rounded-[16px] border p-5 shadow-[0_16px_28px_-18px_rgba(15,23,42,0.3)] ${classes.card}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-secondary)]">{label}</p>
          <p className="mt-2 text-[2rem] font-bold leading-tight tracking-[-0.02em] text-[var(--color-navy-900)]">
            {parsed ? (
              <>
                {parsed.prefix}
                <CountUp
                  value={parsed.numericValue}
                  precision={parsed.precision}
                  durationMs={280}
                  formatter={(n) => n.toLocaleString(undefined, {
                    minimumFractionDigits: parsed.precision,
                    maximumFractionDigits: parsed.precision,
                  })}
                />
                {parsed.suffix}
              </>
            ) : value}
          </p>
          <p className="mt-1.5 text-xs font-medium text-[var(--color-text-secondary)]">{context}</p>
        </div>
        <span className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${classes.icon}`}>{icon}</span>
      </div>

      <div className="mt-4 rounded-[10px] border border-white/50 bg-white/45 px-2.5 py-2">
        {tone === "margin" ? <BarsDecor className={classes.decor} /> : <LineDecor className={classes.decor} />}
      </div>
      <p className="mt-2 text-[11px] font-medium text-[var(--color-text-muted)]">Decorative visual only</p>
    </article>
  );
}

function parseDisplayNumber(value: string): {
  prefix: string;
  suffix: string;
  numericValue: number;
  precision: number;
} | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^([^\d(\-]*)(\(?-?[\d,]+(?:\.\d+)?\)?)(.*)$/);
  if (!match) {
    return null;
  }

  const [, prefix, numberPart, suffix] = match;
  const isAccountingNegative = numberPart.startsWith("(") && numberPart.endsWith(")");
  const normalized = numberPart
    .replace(/[(),\s]/g, "")
    .replace(/,/g, "");
  const numericValue = Number.parseFloat(normalized);

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  const fraction = normalized.split(".")[1] ?? "";
  return {
    prefix,
    suffix,
    numericValue: isAccountingNegative ? -Math.abs(numericValue) : numericValue,
    precision: fraction.length,
  };
}

function LineDecor({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 220 34" className={`h-8 w-full ${className}`} aria-hidden="true">
      <path
        d="M2 28 C 24 22, 40 12, 60 18 C 82 24, 102 10, 124 12 C 146 14, 166 3, 188 8 C 198 10, 208 6, 218 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BarsDecor({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 220 34" className={`h-8 w-full ${className}`} aria-hidden="true">
      <rect x="10" y="17" width="20" height="12" rx="2" fill="currentColor" opacity="0.45" />
      <rect x="40" y="13" width="20" height="16" rx="2" fill="currentColor" opacity="0.56" />
      <rect x="70" y="10" width="20" height="19" rx="2" fill="currentColor" opacity="0.64" />
      <rect x="100" y="7" width="20" height="22" rx="2" fill="currentColor" opacity="0.74" />
      <rect x="130" y="5" width="20" height="24" rx="2" fill="currentColor" opacity="0.84" />
      <rect x="160" y="2" width="20" height="27" rx="2" fill="currentColor" />
    </svg>
  );
}

function toneClasses(tone: "budget" | "spent" | "remaining" | "margin") {
  if (tone === "spent") {
    return {
      card: "border-[var(--color-warning-200)] bg-[linear-gradient(180deg,rgba(249,115,22,0.26),rgba(255,255,255,0.96))]",
      icon: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]",
      decor: "text-[var(--color-warning-600)]",
    };
  }

  if (tone === "remaining") {
    return {
      card: "border-[var(--color-info-100)] bg-[linear-gradient(180deg,rgba(20,184,166,0.24),rgba(255,255,255,0.96))]",
      icon: "bg-[var(--color-info-100)] text-[var(--color-info-700)]",
      decor: "text-[var(--color-info-700)]",
    };
  }

  if (tone === "margin") {
    return {
      card: "border-[var(--color-success-100)] bg-[linear-gradient(180deg,rgba(34,197,94,0.24),rgba(255,255,255,0.96))]",
      icon: "bg-[var(--color-success-100)] text-[var(--color-success-700)]",
      decor: "text-[var(--color-success-700)]",
    };
  }

  return {
    card: "border-[var(--color-primary-100)] bg-[linear-gradient(180deg,rgba(37,99,235,0.24),rgba(255,255,255,0.96))]",
    icon: "bg-[var(--color-primary-100)] text-[var(--color-brand-700)]",
    decor: "text-[var(--color-brand-700)]",
  };
}
