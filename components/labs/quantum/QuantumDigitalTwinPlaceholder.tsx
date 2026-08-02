import type { QuantumTwinLink, QuantumTwinNode } from "@/lib/labs/quantum/types";
import { useMemo, useState } from "react";
import { QuantumStatus } from "./QuantumStatus";

type QuantumDigitalTwinPlaceholderProps = {
  nodes: QuantumTwinNode[];
  links: QuantumTwinLink[];
};

function toneColor(status: QuantumTwinNode["status"]) {
  if (status === "healthy") {
    return "var(--q-healthy)";
  }

  if (status === "info") {
    return "var(--q-info)";
  }

  if (status === "attention") {
    return "var(--q-attention)";
  }

  if (status === "critical") {
    return "var(--q-critical)";
  }

  return "var(--q-orion)";
}

export function QuantumDigitalTwinPlaceholder({ nodes, links }: QuantumDigitalTwinPlaceholderProps) {
  const nodeMap = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const [selectedNodeId, setSelectedNodeId] = useState(nodes[0]?.id ?? "");

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null,
    [nodes, selectedNodeId],
  );

  const selectedNodeConnections = useMemo(() => {
    if (!selectedNode) {
      return [] as QuantumTwinNode[];
    }

    return links
      .filter((link) => link.from === selectedNode.id || link.to === selectedNode.id)
      .map((link) => {
        const relatedNodeId = link.from === selectedNode.id ? link.to : link.from;
        return nodeMap.get(relatedNodeId);
      })
      .filter((related): related is QuantumTwinNode => Boolean(related));
  }, [links, nodeMap, selectedNode]);

  return (
    <figure className="rounded-2xl bg-[color:color-mix(in_oklab,var(--q-surface-2)_72%,black)] p-3 sm:p-4">
      <svg
        viewBox="0 0 520 300"
        role="group"
        aria-label="Digital twin placeholder showing projects, crews, equipment, operations, and links"
        className="h-[300px] w-full sm:h-[340px]"
      >
        <defs>
          <linearGradient id="qGrid" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="rgba(24,183,217,0.2)" />
            <stop offset="100%" stopColor="rgba(159,122,234,0.1)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="520" height="300" rx="14" fill="rgba(13,29,49,0.72)" />
        <path d="M24 40 H496 M24 90 H496 M24 140 H496 M24 190 H496 M24 240 H496" stroke="url(#qGrid)" strokeWidth="1" />
        <path d="M70 20 V280 M160 20 V280 M250 20 V280 M340 20 V280 M430 20 V280" stroke="url(#qGrid)" strokeWidth="1" />

        {links.map((link) => {
          const from = nodeMap.get(link.from);
          const to = nodeMap.get(link.to);
          if (!from || !to) {
            return null;
          }

          return (
            <line
              key={link.id}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={
                selectedNodeId && (selectedNodeId === from.id || selectedNodeId === to.id)
                  ? "rgba(241, 251, 255, 0.86)"
                  : "rgba(171, 191, 221, 0.58)"
              }
              strokeDasharray="4 4"
              strokeWidth={
                selectedNodeId && (selectedNodeId === from.id || selectedNodeId === to.id) ? "2" : "1.5"
              }
            />
          );
        })}

        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;

          return (
            <g key={node.id}>
              <circle
                cx={node.x}
                cy={node.y}
                r={isSelected ? "23" : "18"}
                fill="none"
                stroke={toneColor(node.status)}
                strokeOpacity={isSelected ? "0.7" : "0.35"}
              />
              <circle cx={node.x} cy={node.y} r={isSelected ? "11" : "9"} fill={toneColor(node.status)} />

              <foreignObject x={node.x - 14} y={node.y - 14} width="28" height="28">
                <button
                  type="button"
                  aria-label={`Focus node ${node.label}`}
                  aria-pressed={isSelected}
                  className="h-7 w-7 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--q-info)]"
                  onClick={() => setSelectedNodeId(node.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setSelectedNodeId(node.id);
                    }
                  }}
                >
                  <span className="sr-only">{node.label}</span>
                </button>
              </foreignObject>

              <text x={node.x + 14} y={node.y - 6} fill="var(--q-text)" fontSize="11" fontWeight="600">
                {node.label}
              </text>
              <text x={node.x + 14} y={node.y + 10} fill="var(--q-text-muted)" fontSize="10" style={{ textTransform: "capitalize" }}>
                {node.group}
              </text>
            </g>
          );
        })}
      </svg>

      {selectedNode ? (
        <div className="mt-3 rounded-xl border border-[color:color-mix(in_oklab,var(--q-info)_40%,var(--q-border))] bg-[color:color-mix(in_oklab,var(--q-surface)_86%,black)] p-3">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--q-text)]">Selected focus: {selectedNode.label}</p>
            <QuantumStatus tone={selectedNode.status} label={selectedNode.status} />
            <span className="text-xs uppercase tracking-[0.09em] text-[var(--q-text-muted)]">{selectedNode.group}</span>
          </div>
          <p className="mt-2 text-sm text-[var(--q-text-muted)]">
            Connected links: {selectedNodeConnections.length}. Active flow is simulated from deterministic fixture topology.
          </p>
        </div>
      ) : null}

      <figcaption className="mt-2 text-xs text-[var(--q-text-muted)]">
        Future Digital Twin surface placeholder with project, crew, equipment, and operations connections.
      </figcaption>
    </figure>
  );
}
