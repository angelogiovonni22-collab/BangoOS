"use client";

import type { GraphEdgeModel } from "./GraphLayoutEngine";

type GraphEdgeProps = {
  edge: GraphEdgeModel;
  from: { x: number; y: number };
  to: { x: number; y: number };
  active: boolean;
  related: boolean;
};

export function GraphEdge({ edge, from, to, active, related }: GraphEdgeProps) {
  const midX = (from.x + to.x) / 2;
  const path = `M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`;

  const stroke = active
    ? "var(--color-brand-600)"
    : edge.dependency
      ? "var(--color-warning-700)"
      : "rgb(100 116 139 / 0.5)";

  const opacity = active ? 1 : related ? 0.84 : 0.28;

  return (
    <g>
      <path
        d={path}
        fill="none"
        stroke={stroke}
        strokeWidth={active ? 2.4 : 1.4}
        strokeDasharray={edge.dependency ? "4 5" : undefined}
        opacity={opacity}
      />
      {edge.label ? (
        <text
          x={midX}
          y={(from.y + to.y) / 2 - 6}
          textAnchor="middle"
          className="fill-[var(--color-text-secondary)] text-[10px] font-semibold"
          opacity={active ? 0.94 : related ? 0.72 : 0.45}
        >
          {edge.label}
        </text>
      ) : null}
    </g>
  );
}
