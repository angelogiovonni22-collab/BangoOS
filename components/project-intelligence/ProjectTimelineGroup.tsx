import type { ReactNode } from "react";
import { useState } from "react";
import type { ProjectTimelineDateGroup } from "@/lib/project-intelligence/types";
import { ProjectTimelineEvent } from "./ProjectTimelineEvent";

type ProjectTimelineGroupProps = {
  group: ProjectTimelineDateGroup;
  locale: string;
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function ProjectTimelineGroup({ group, locale, t }: ProjectTimelineGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <section className="space-y-3">
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-left transition hover:border-[var(--color-border-strong)]"
        onClick={() => setCollapsed((current) => !current)}
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold text-[var(--color-text-primary)]">{group.label}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {t("projects.intelligenceGroupCount", { count: group.events.length })}
        </span>
      </button>

      {!collapsed ? (
        <div className="relative space-y-3 pl-0">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-3 left-5 top-3 hidden w-px bg-[var(--color-border-subtle)] sm:block"
          />

          {group.events.map((event, index) => (
            <div key={event.id} className="relative sm:pl-14">
              <span
                aria-hidden="true"
                className="absolute left-0 top-5 hidden h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] shadow-[var(--shadow-card)] sm:flex"
              >
                {eventTimelineIcon(event.category)}
              </span>

              {index === 0 ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute left-5 top-0 hidden h-3 w-px bg-[var(--color-background-app)] sm:block"
                />
              ) : null}

              {index === group.events.length - 1 ? (
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute bottom-0 left-5 hidden h-3 w-px bg-[var(--color-background-app)] sm:block"
                />
              ) : null}

              <ProjectTimelineEvent
                event={event}
                locale={locale}
                t={t}
                timelineIcon={
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[11px] font-semibold text-[var(--color-text-secondary)]">
                    {eventTimelineIcon(event.category)}
                  </span>
                }
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function eventTimelineIcon(category: ProjectTimelineDateGroup["events"][number]["category"]): ReactNode {
  const map: Record<ProjectTimelineDateGroup["events"][number]["category"], ReactNode> = {
    project: <CircleIcon />,
    customer: <UserIcon />,
    estimate: <ReceiptIcon />,
    contract: <ReceiptIcon />,
    permit: <ClipboardIcon />,
    schedule: <CalendarIcon />,
    task: <PencilIcon />,
    employee: <UserIcon />,
    daily_report: <ClipboardIcon />,
    inspection: <ClipboardCheckIcon />,
    safety: <ClipboardCheckIcon />,
    material: <ReceiptIcon />,
    equipment: <CircleIcon />,
    sitecam: <CameraIcon />,
    document: <ReceiptIcon />,
    change_order: <ReceiptIcon />,
    invoice: <DollarSignIcon />,
    payment: <DollarSignIcon />,
    budget: <DollarSignIcon />,
    ai: <BotIcon />,
  };

  return map[category] || <CircleIcon />;
}

function TimelineIconBase({ children }: { children: ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      focusable="false"
    >
      {children}
    </svg>
  );
}

function CircleIcon() {
  return (
    <TimelineIconBase>
      <circle cx="12" cy="12" r="7" />
    </TimelineIconBase>
  );
}

function BotIcon() {
  return (
    <TimelineIconBase>
      <rect x="6" y="8" width="12" height="10" rx="2" />
      <path d="M12 8V5" />
      <path d="M9.5 12h.01" />
      <path d="M14.5 12h.01" />
      <path d="M9 16h6" />
    </TimelineIconBase>
  );
}

function DollarSignIcon() {
  return (
    <TimelineIconBase>
      <path d="M12 4v16" />
      <path d="M16 8c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 3 4 3 4 1.3 4 3-1.8 3-4 3-4-1.3-4-3" />
    </TimelineIconBase>
  );
}

function CalendarIcon() {
  return (
    <TimelineIconBase>
      <rect x="4" y="6" width="16" height="14" rx="2" />
      <path d="M8 4v4" />
      <path d="M16 4v4" />
      <path d="M4 10h16" />
    </TimelineIconBase>
  );
}

function ClipboardIcon() {
  return (
    <TimelineIconBase>
      <rect x="7" y="5" width="10" height="15" rx="2" />
      <path d="M10 5.5h4a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1Z" />
      <path d="M10 11h4" />
      <path d="M10 15h4" />
    </TimelineIconBase>
  );
}

function ClipboardCheckIcon() {
  return (
    <TimelineIconBase>
      <rect x="7" y="5" width="10" height="15" rx="2" />
      <path d="M10 5.5h4a1 1 0 0 0 1-1v-.5a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v.5a1 1 0 0 0 1 1Z" />
      <path d="m9.5 14 1.8 1.8 3.2-3.2" />
    </TimelineIconBase>
  );
}

function CameraIcon() {
  return (
    <TimelineIconBase>
      <rect x="4" y="8" width="16" height="10" rx="2" />
      <path d="M9 8 10.2 6h3.6L15 8" />
      <circle cx="12" cy="13" r="2.5" />
    </TimelineIconBase>
  );
}

function UserIcon() {
  return (
    <TimelineIconBase>
      <circle cx="12" cy="9" r="3" />
      <path d="M6.5 19c1.1-2.6 3.1-4 5.5-4s4.4 1.4 5.5 4" />
    </TimelineIconBase>
  );
}

function PencilIcon() {
  return (
    <TimelineIconBase>
      <path d="m7 17 1.2-3.8L15 6.4a1.4 1.4 0 0 1 2 0l.6.6a1.4 1.4 0 0 1 0 2l-6.8 6.8L7 17Z" />
      <path d="M12 8.5 15.5 12" />
    </TimelineIconBase>
  );
}

function ReceiptIcon() {
  return (
    <TimelineIconBase>
      <path d="M7 4h10v16l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5V4Z" />
      <path d="M9.5 9h5" />
      <path d="M9.5 12h5" />
      <path d="M9.5 15h3" />
    </TimelineIconBase>
  );
}
