import { orionCoreScenarioOrder, orionCoreScenarios, type OrionCoreStateId } from "@/lib/labs/orion-core";

type OrionCoreScenarioSwitcherProps = {
  selected: OrionCoreStateId;
  onChange: (next: OrionCoreStateId) => void;
};

export function OrionCoreScenarioSwitcher({ selected, onChange }: OrionCoreScenarioSwitcherProps) {
  return (
    <section aria-labelledby="orion-scenario-switcher-heading" className="oc-switcher">
      <h3 id="orion-scenario-switcher-heading">Scenario Switcher</h3>
      <p>Select a deterministic Orion state preview.</p>
      <div className="oc-switcher-grid" role="radiogroup" aria-label="Orion state scenarios">
        {orionCoreScenarioOrder.map((id) => {
          const scenario = orionCoreScenarios[id];
          const isSelected = selected === id;

          return (
            <button
              key={scenario.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              className={["oc-scenario-button", isSelected ? "is-active" : ""].filter(Boolean).join(" ")}
              onClick={() => onChange(id)}
            >
              <span className="oc-scenario-title">{scenario.title}</span>
              <span className="oc-scenario-subtitle">{scenario.textCue}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
