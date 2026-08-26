import { CalendarDays, CircleDollarSign, Gauge, ShieldCheck } from "lucide-react";
import { CountUp } from "@/components/motion";

type ProjectKpiGridProps = {
  statusLabel: string;
  statusKey: string;
  budgetLabel: string;
  spentLabel: string;
  startDate: string;
  targetDate: string;
  progressPercent: number;
  taskCount: number;
  completedTaskCount: number;
};

export function ProjectKpiGrid({
  statusLabel,
  statusKey,
  budgetLabel,
  spentLabel,
  startDate,
  targetDate,
  progressPercent,
  taskCount,
  completedTaskCount,
}: ProjectKpiGridProps) {
  const normalizedProgress = Math.max(0, Math.min(100, Math.round(progressPercent)));

  return (
    <section className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Project workspace KPI widgets">
      <KpiCard
        label="Project Status"
        value={statusLabel}
        context={toStatusContext(statusKey)}
        icon={<ShieldCheck size={18} aria-hidden="true" />}
        tone="status"
      />
      <KpiCard
        label="Financial Summary"
        value={budgetLabel}
        context={`Paid ${spentLabel}`}
        icon={<CircleDollarSign size={18} aria-hidden="true" />}
        tone="financial"
      />
      <KpiCard
        label="Project Dates"
        value={startDate}
        context={`Target ${targetDate}`}
        icon={<CalendarDays size={18} aria-hidden="true" />}
        tone="dates"
      />
      <ProgressCard progress={normalizedProgress} taskCount={taskCount} completedTaskCount={completedTaskCount} />
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
  icon: React.ReactNode;
  tone: "status" | "financial" | "dates";
}) {
  const classes = toneClasses(tone);
  const statusDot = tone === "status"
    ? "bg-[var(--color-success-500)]"
    : tone === "financial"
      ? "bg-[var(--color-info-500)]"
      : "bg-[var(--color-warning-500)]";

  return (
    <article className={`group relative min-h-[178px] min-w-0 overflow-hidden rounded-[18px] border p-5 shadow-[0_18px_30px_-20px_rgba(6,16,40,0.36)] transition duration-200 hover:shadow-[0_22px_36px_-22px_rgba(6,16,40,0.44)] ${classes.card}`}>
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,rgba(37,99,235,0.16),rgba(14,165,233,0.38),rgba(34,197,94,0.12))]" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#3d5678]">{label}</p>
          <p className="mt-2 text-[1.58rem] font-extrabold leading-tight tracking-[-0.02em] text-[#071125]">{value}</p>
          <p className="mt-1.5 text-[0.84rem] font-medium leading-5 text-[#365274]">{context}</p>
        </div>
        <span className={`inline-flex h-11 w-11 items-center justify-center rounded-full border transition duration-200 group-hover:scale-[1.02] ${classes.icon}`}>{icon}</span>
      </div>

      <div className="mt-4 flex items-center justify-between rounded-[11px] border border-[#c9d8eb] bg-[#f8fbff] px-3 py-2">
        <span className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3a5678]">
          <span className={`h-2.5 w-2.5 rounded-full ${statusDot}`} aria-hidden="true" />
          Live signal
        </span>
        <span className="text-xs font-semibold text-[#324d72] group-hover:text-[#1f3b63]">Updated now</span>
      </div>
    </article>
  );
}

function ProgressCard({
  progress,
  taskCount,
  completedTaskCount,
}: {
  progress: number;
  taskCount: number;
  completedTaskCount: number;
}) {
  return (
    <article className="group relative min-h-[178px] min-w-0 overflow-hidden rounded-[18px] border border-[#bfd3eb] bg-[linear-gradient(180deg,#f7fbff,#f2f8ff)] p-5 shadow-[0_18px_30px_-20px_rgba(6,16,40,0.36)] transition duration-200 hover:shadow-[0_22px_36px_-22px_rgba(6,16,40,0.44)]">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-[linear-gradient(90deg,rgba(37,99,235,0.2),rgba(14,165,233,0.5),rgba(56,189,248,0.24))]" aria-hidden="true" />

      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#3d5678]">Project Progress</p>
          <p className="mt-2 text-[2.05rem] font-extrabold leading-tight tracking-[-0.02em] text-[#071125]">
            <CountUp value={progress} durationMs={260} />%
          </p>
          <p className="mt-1.5 text-[0.84rem] font-medium text-[#365274]">{completedTaskCount} of {taskCount} tasks completed</p>
        </div>
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--color-info-500)] bg-[var(--color-info-500)] text-white shadow-[var(--shadow-small)] transition duration-200 group-hover:scale-[1.02]">
          <Gauge size={18} aria-hidden="true" />
        </span>
      </div>

      <div className="mt-4 h-2.5 overflow-hidden rounded-full border border-[#c8d8f1] bg-[#dce7f8]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#2563eb,#0ea5e9)] shadow-[0_0_12px_rgba(37,99,235,0.35)] transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-[11px] border border-[#c9d8eb] bg-[#f8fbff] px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#3a5678]">Completion trend</span>
        <span className="text-xs font-semibold text-[#274f82] group-hover:text-[#1f4475]">Stable</span>
      </div>
    </article>
  );
}

function toStatusContext(statusKey: string) {
  if (statusKey === "completed") {
    return "Project closed successfully";
  }

  if (statusKey === "on_hold") {
    return "Delivery temporarily paused";
  }

  if (statusKey === "in_progress") {
    return "Execution currently active";
  }

  return "Status based on live project record";
}

function toneClasses(tone: "status" | "financial" | "dates") {
  if (tone === "status") {
    return {
      card: "border-[#bccfe8] bg-[linear-gradient(180deg,#f9fcff,#f2f7ff)]",
      icon: "border-[var(--color-success-500)] bg-[var(--color-success-500)] text-white shadow-[var(--shadow-small)]",
    };
  }

  if (tone === "dates") {
    return {
      card: "border-[#bfd8ea] bg-[linear-gradient(180deg,#f8fcff,#f2f8fd)]",
      icon: "border-[var(--color-warning-500)] bg-[var(--color-warning-500)] text-white shadow-[var(--shadow-small)]",
    };
  }

  return {
    card: "border-[#bfdcc9] bg-[linear-gradient(180deg,#f7fff9,#f1fcf6)]",
    icon: "border-[var(--color-info-500)] bg-[var(--color-info-500)] text-white shadow-[var(--shadow-small)]",
  };
}
