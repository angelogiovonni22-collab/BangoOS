import type { MissionTimelineEvent } from "@/lib/labs/mission-control/types";
import { MissionStatusPill } from "./MissionStatusPill";

type MissionTimelineProps = {
  events: MissionTimelineEvent[];
  reducedMotion: boolean;
};

export function MissionTimeline({ events, reducedMotion }: MissionTimelineProps) {
  return (
    <section aria-labelledby="mc-timeline-heading" className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-border)_74%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface)_76%,black)] p-4">
      <header className="mb-3">
        <h2 id="mc-timeline-heading" className="text-lg font-semibold tracking-tight text-[var(--mc-text)]">Operational Timeline</h2>
        <p className="text-sm text-[var(--mc-text-muted)]">Deterministic fixture events with source and freshness context.</p>
      </header>

      <ol className="space-y-2" aria-label="Operational timeline events">
        {events.map((event, index) => (
          <li
            key={event.id}
            className={[
              "rounded-xl border border-[color:color-mix(in_oklab,var(--mc-border)_72%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface-2)_70%,black)] p-3",
              reducedMotion ? "" : "animate-[mc-rise_280ms_ease-out_both]",
            ].join(" ")}
            style={reducedMotion ? undefined : { animationDelay: `${index * 40}ms` }}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--mc-text)]">{event.entity}</p>
                <p className="mt-0.5 text-xs uppercase tracking-[0.08em] text-[var(--mc-text-muted)]">{event.type}</p>
              </div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--mc-text-muted)]">{event.at}</p>
            </div>
            <p className="mt-2 text-sm text-[var(--mc-text)]">{event.detail}</p>
            <p className="mt-1 text-xs text-[var(--mc-text-muted)]">Source: {event.source}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <MissionStatusPill label={event.status} severity={event.status} />
              <MissionStatusPill label={`Freshness: ${event.freshness}`} severity={event.freshness === "live" ? "healthy" : event.freshness === "partial" ? "attention" : event.freshness} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
