import type { OrionCoreScenario } from "@/lib/labs/orion-core";

type OrionActivityRingProps = {
  scenario: OrionCoreScenario;
  reducedMotion: boolean;
  paused: boolean;
};

export function OrionActivityRing({ scenario, reducedMotion, paused }: OrionActivityRingProps) {
  const ringClasses = [
    "oc-ring",
    `oc-ring-${scenario.ringStyle.toLowerCase().replace(/_/g, "-")}`,
  ].join(" ");

  return (
    <span
      aria-hidden="true"
      data-state={scenario.id}
      className={[
        "oc-mark",
        reducedMotion ? "oc-reduced" : "",
        paused ? "oc-paused" : "",
      ].filter(Boolean).join(" ")}
    >
      <span className="oc-core" />
      <span className="oc-inner" />
      <span className={ringClasses} />
      <span className="oc-halo" />
    </span>
  );
}
