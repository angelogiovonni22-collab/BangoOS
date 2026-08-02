import type { MissionScenario, MissionScenarioId } from "@/lib/labs/mission-control/types";

type MissionControlScenarioSwitcherProps = {
  selected: MissionScenarioId;
  scenarios: MissionScenario[];
  onChange: (id: MissionScenarioId) => void;
};

export function MissionControlScenarioSwitcher({ selected, scenarios, onChange }: MissionControlScenarioSwitcherProps) {
  return (
    <div className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-border)_72%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface)_74%,black)] p-2">
      <p id="mc-scenario-switcher-label" className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.11em] text-[var(--mc-text-muted)]">
        Scenario
      </p>
      <div
        role="radiogroup"
        aria-labelledby="mc-scenario-switcher-label"
        className="grid gap-2 sm:grid-cols-3"
      >
        {scenarios.map((scenario) => {
          const isActive = scenario.id === selected;
          return (
            <button
              key={scenario.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={[
                "min-h-11 rounded-xl border px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]",
                isActive
                  ? "border-[color:color-mix(in_oklab,var(--mc-info)_56%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-info)_16%,black)] text-[var(--mc-text)]"
                  : "border-[color:color-mix(in_oklab,var(--mc-border)_66%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface-2)_62%,black)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]",
              ].join(" ")}
              onClick={() => onChange(scenario.id)}
            >
              {scenario.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
