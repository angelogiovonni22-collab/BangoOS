"use client";

import type { GraphLayoutNode } from "./GraphLayoutEngine";

type GraphNodeProps = {
  node: GraphLayoutNode;
  active: boolean;
  related: boolean;
  onHover: (nodeId: string | null) => void;
  onSelect: (nodeId: string) => void;
};

const NODE_WIDTH = 156;
const NODE_HEIGHT = 54;

export function GraphNode({ node, active, related, onHover, onSelect }: GraphNodeProps) {
  const x = node.x - NODE_WIDTH / 2;
  const y = node.y - NODE_HEIGHT / 2;

  return (
    <g
      transform={`translate(${x} ${y})`}
      role="button"
      tabIndex={0}
      onMouseEnter={() => onHover(node.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(node.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(node.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect(node.id);
        }
      }}
      className="cursor-pointer"
      aria-label={`${node.kind} ${node.label}`}
    >
      <rect
        width={NODE_WIDTH}
        height={NODE_HEIGHT}
        rx="12"
        fill={resolveFill(node.kind)}
        stroke={active ? "var(--color-brand-700)" : "rgb(148 163 184 / 0.42)"}
        strokeWidth={active ? 2.3 : 1.2}
        opacity={active ? 1 : related ? 0.9 : 0.58}
      />

      <text x="14" y="22" className="fill-[var(--color-text-primary)] text-[12px] font-semibold">
        {node.label}
      </text>

      {node.value ? (
        <text x="14" y="40" className="fill-[var(--color-text-secondary)] text-[11px] font-medium">
          {node.value}
        </text>
      ) : null}
    </g>
  );
}

function resolveFill(kind: GraphLayoutNode["kind"]) {
  if (kind === "company") {
    return "rgb(219 234 254 / 0.92)";
  }

  if (kind === "project") {
    return "rgb(239 246 255 / 0.95)";
  }

  if (kind === "invoice" || kind === "change_order") {
    return "rgb(255 247 237 / 0.96)";
  }

  if (kind === "photo" || kind === "document") {
    return "rgb(240 253 250 / 0.96)";
  }

  return "rgb(248 250 252 / 0.95)";
}
