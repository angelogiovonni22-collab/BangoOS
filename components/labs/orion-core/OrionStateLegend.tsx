import { orionCoreScenarioOrder, orionCoreScenarios } from "@/lib/labs/orion-core";

export function OrionStateLegend() {
  return (
    <section aria-labelledby="orion-state-legend-heading" className="oc-legend">
      <h3 id="orion-state-legend-heading">State Legend</h3>
      <ul>
        {orionCoreScenarioOrder.map((id) => {
          const scenario = orionCoreScenarios[id];
          return (
            <li key={scenario.id}>
              <span className="oc-legend-chip">{scenario.stateLabel}</span>
              <span>{scenario.motionHint}</span>
              <span className="oc-legend-cue">Cue: {scenario.textCue}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
