"use client";

import { useMemo, useRef, useState } from "react";
import { useMotionPreferences } from "@/components/motion";
import { useBusinessGraph } from "./BusinessGraphProvider";
import { GraphEdge } from "./GraphEdge";
import { GraphLayoutEngine } from "./GraphLayoutEngine";
import { GraphNode } from "./GraphNode";
import { collectDependencyPath } from "./RelationshipEngine";

const MIN_SCALE = 0.7;
const MAX_SCALE = 1.6;

type BusinessGraphCanvasProps = {
  className?: string;
};

export function BusinessGraphCanvas({ className }: BusinessGraphCanvasProps) {
  const { graph, selectedNodeId, hoveredNodeId, setHoveredNodeId, setSelectedNodeId } = useBusinessGraph();
  const { reducedMotion } = useMotionPreferences();
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const panRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const nodes = useMemo(() => GraphLayoutEngine(graph), [graph]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const activeNode = hoveredNodeId || selectedNodeId;
  const dependency = useMemo(() => collectDependencyPath(graph, activeNode), [activeNode, graph]);

  const viewBox = "-220 -240 2500 900";

  return (
    <div className={["relative overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/45", className || ""].filter(Boolean).join(" ")}>
      <div className="absolute right-3 top-3 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setScale((current) => clamp(current + 0.1, MIN_SCALE, MAX_SCALE))}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)]"
          aria-label="Zoom in"
        >
          +
        </button>
        <button
          type="button"
          onClick={() => setScale((current) => clamp(current - 0.1, MIN_SCALE, MAX_SCALE))}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2 py-1 text-xs font-semibold text-[var(--color-text-primary)]"
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          onClick={() => {
            setScale(1);
            setOffset({ x: 0, y: 0 });
          }}
          className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-2 py-1 text-xs font-semibold text-[var(--color-text-secondary)]"
        >
          Reset
        </button>
      </div>

      <div
        className="h-[540px] w-full cursor-grab active:cursor-grabbing"
        onWheel={(event) => {
          event.preventDefault();
          const direction = event.deltaY > 0 ? -0.08 : 0.08;
          setScale((current) => clamp(current + direction, MIN_SCALE, MAX_SCALE));
        }}
        onPointerDown={(event) => {
          panRef.current = {
            startX: event.clientX,
            startY: event.clientY,
            originX: offset.x,
            originY: offset.y,
          };
        }}
        onPointerMove={(event) => {
          if (!panRef.current) {
            return;
          }

          const deltaX = event.clientX - panRef.current.startX;
          const deltaY = event.clientY - panRef.current.startY;
          setOffset({ x: panRef.current.originX + deltaX, y: panRef.current.originY + deltaY });
        }}
        onPointerUp={() => {
          panRef.current = null;
        }}
        onPointerLeave={() => {
          panRef.current = null;
        }}
      >
        <svg viewBox={viewBox} className="h-full w-full" role="img" aria-label="Business relationship graph">
          <g
            transform={`translate(${offset.x} ${offset.y}) scale(${scale})`}
            style={{
              transition: reducedMotion ? "none" : "transform var(--bf-duration-fast) var(--bf-ease-standard)",
            }}
          >
            {graph.edges.map((edge) => {
              const from = nodeById.get(edge.from);
              const to = nodeById.get(edge.to);

              if (!from || !to) {
                return null;
              }

              const active = dependency.edgeIds.has(edge.id);
              const related = activeNode ? dependency.nodeIds.has(edge.from) || dependency.nodeIds.has(edge.to) : true;

              return (
                <GraphEdge
                  key={edge.id}
                  edge={edge}
                  from={{ x: from.x + 78, y: from.y }}
                  to={{ x: to.x - 78, y: to.y }}
                  active={active}
                  related={related}
                />
              );
            })}

            {nodes.map((node) => (
              <GraphNode
                key={node.id}
                node={node}
                active={dependency.nodeIds.has(node.id)}
                related={activeNode ? dependency.nodeIds.has(node.id) : true}
                onHover={setHoveredNodeId}
                onSelect={setSelectedNodeId}
              />
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
