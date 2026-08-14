import type { OrionPriority } from "@/lib/labs/mission-control/types";
import { MissionStatusPill } from "./MissionStatusPill";

type OrionPriorityRailProps = {
  priorities: OrionPriority[];
  reducedMotion: boolean;
};

export function OrionPriorityRail({ priorities, reducedMotion }: OrionPriorityRailProps) {
  return (
    <section aria-labelledby="mc-orion-priority-heading" className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-orion)_56%,var(--mc-border))] bg-[linear-gradient(160deg,rgba(33,43,77,0.94),rgba(19,31,55,0.97))] p-4">
      <header className="mb-3">
        <h2 id="mc-orion-priority-heading" className="text-lg font-semibold tracking-tight text-[var(--mc-text)]">Orion Priority Rail</h2>
        <p className="text-sm text-[var(--mc-text-muted)]">Advisory intelligence with explicit boundaries and uncertainty notes.</p>
      </header>

      <div className="space-y-3">
        {priorities.map((priority, index) => (
          <article
            key={priority.id}
            className={[
              "rounded-xl border border-[color:color-mix(in_oklab,var(--mc-orion)_42%,var(--mc-border))] bg-[color:color-mix(in_oklab,var(--mc-surface)_84%,black)] p-3",
              reducedMotion ? "" : "animate-[mc-rise_280ms_ease-out_both]",
            ].join(" ")}
            style={reducedMotion ? undefined : { animationDelay: `${index * 50}ms` }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <MissionStatusPill label={priority.status} severity={priority.status} />
              <MissionStatusPill label={priority.kind} severity={priority.kind === "fact" ? "info" : priority.kind === "prediction" ? "attention" : "orion"} />
              <span className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">{priority.confidenceLabel}</span>
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Observation</dt>
                <dd className="mt-1 text-[var(--mc-text)]">{priority.observation}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Why it matters</dt>
                <dd className="mt-1 text-[var(--mc-text)]">{priority.whyItMatters}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Evidence</dt>
                <dd className="mt-1 text-[var(--mc-text)]">{priority.evidence}</dd>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Evidence quality</dt>
                  <dd className="mt-1 text-[var(--mc-text)]">{priority.evidenceQuality}</dd>
                </div>
                <div>
                  <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Approval boundary</dt>
                  <dd className="mt-1 text-[var(--mc-text)]">{priority.approvalBoundary}</dd>
                </div>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Limitation</dt>
                <dd className="mt-1 text-[var(--mc-text-muted)]">{priority.limitation}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.09em] text-[var(--mc-text-muted)]">Recommended next step</dt>
                <dd className="mt-1 text-[var(--mc-text)]">{priority.recommendedNextStep}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
    </section>
  );
}
