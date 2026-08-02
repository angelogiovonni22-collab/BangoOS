import { useMemo, useState } from "react";
import type { TwinLink, TwinNode } from "@/lib/labs/mission-control/types";
import { MissionStatusPill } from "./MissionStatusPill";
import { missionTokens } from "./mission-theme";

type MissionDigitalTwinProps = {
  nodes: TwinNode[];
  links: TwinLink[];
};

function nodeColor(status: TwinNode["status"]) {
  return missionTokens[status];
}

export function MissionDigitalTwin({ nodes, links }: MissionDigitalTwinProps) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? "");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId],
  );

  const selectedConnections = useMemo(() => {
    if (!selectedNode) {
      return [] as TwinNode[];
    }

    return links
      .filter((link) => link.from === selectedNode.id || link.to === selectedNode.id)
      .map((link) => {
        const relatedId = link.from === selectedNode.id ? link.to : link.from;
        return nodeMap.get(relatedId);
      })
      .filter((node): node is TwinNode => Boolean(node));
  }, [links, nodeMap, selectedNode]);

  return (
    <section aria-labelledby="mc-digital-twin-heading" className="rounded-2xl border border-[color:color-mix(in_oklab,var(--mc-border)_74%,transparent)] bg-[color:color-mix(in_oklab,var(--mc-surface)_74%,black)] p-4">
      <header className="mb-3">
        <h2 id="mc-digital-twin-heading" className="text-lg font-semibold tracking-tight text-[var(--mc-text)]">Mission Digital Twin</h2>
        <p className="text-sm text-[var(--mc-text-muted)]">Projects, crews, equipment, and schedule links with keyboard-accessible focus nodes.</p>
      </header>

      <div className="relative rounded-xl border border-[color:color-mix(in_oklab,var(--mc-border)_70%,transparent)] bg-[rgba(10,22,38,0.72)] p-2">
        <svg
          viewBox="0 0 100 70"
          role="group"
          aria-label="Mission Digital Twin graph"
          className="h-[280px] w-full sm:h-[320px]"
        >
          {links.map((link) => {
            const from = nodeMap.get(link.from);
            const to = nodeMap.get(link.to);
            if (!from || !to) {
              return null;
            }

            const selected = selectedNode && (selectedNode.id === from.id || selectedNode.id === to.id);
            return (
              <line
                key={link.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={selected ? "rgba(230,238,251,0.72)" : "rgba(156,177,207,0.4)"}
                strokeWidth={selected ? 0.65 : 0.45}
              />
            );
          })}
        </svg>

        <div className="pointer-events-none absolute inset-0">
          {nodes.map((node) => {
            const isSelected = selectedNode?.id === node.id;
            return (
              <button
                key={node.id}
                type="button"
                className={[
                  "pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[var(--focus-ring-primary)]",
                  isSelected
                    ? "border-[rgba(230,238,251,0.8)] bg-[rgba(17,31,48,0.95)] text-[var(--mc-text)]"
                    : "border-[color:color-mix(in_oklab,var(--mc-border)_76%,transparent)] bg-[rgba(17,31,48,0.86)] text-[var(--mc-text-muted)] hover:text-[var(--mc-text)]",
                ].join(" ")}
                style={{ left: `${node.x}%`, top: `${node.y}%`, boxShadow: `0 0 0 1px ${nodeColor(node.status)} inset` }}
                aria-pressed={isSelected}
                aria-label={`Focus node ${node.label}. Status ${node.status}. Group ${node.group}.`}
                onClick={() => setSelectedNodeId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedNodeId(node.id);
                  }
                }}
              >
                {node.label}
              </button>
            );
          })}
        </div>
      </div>

      {selectedNode ? (
        <div className="mt-3 rounded-xl bg-[color:color-mix(in_oklab,var(--mc-surface-2)_74%,black)] p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--mc-text-muted)]">Selected focus</p>
          <p className="mt-1 text-sm font-semibold text-[var(--mc-text)]">{selectedNode.label}</p>
          <p className="mt-1 text-sm text-[var(--mc-text-muted)]">{selectedNode.detail}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <MissionStatusPill label={selectedNode.status} severity={selectedNode.status} />
            <MissionStatusPill label={`Group: ${selectedNode.group}`} severity="info" />
            <MissionStatusPill label={`Connected links: ${selectedConnections.length}`} severity="orion" />
          </div>
          {selectedConnections.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--mc-text-muted)]">
              {selectedConnections.map((connectedNode) => (
                <li key={connectedNode.id}>{connectedNode.label}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
