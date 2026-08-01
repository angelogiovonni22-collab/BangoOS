"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { GraphModel, GraphNodeModel } from "./GraphLayoutEngine";

type BusinessGraphContextValue = {
  graph: GraphModel;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  setHoveredNodeId: (id: string | null) => void;
  selectedNode: GraphNodeModel | null;
};

const BusinessGraphContext = createContext<BusinessGraphContextValue | null>(null);

type BusinessGraphProviderProps = {
  graph: GraphModel;
  children: ReactNode;
};

export function BusinessGraphProvider({ graph, children }: BusinessGraphProviderProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const selectedNode = useMemo(
    () => graph.nodes.find((node) => node.id === selectedNodeId) || null,
    [graph.nodes, selectedNodeId],
  );

  const value = useMemo<BusinessGraphContextValue>(() => ({
    graph,
    selectedNodeId,
    hoveredNodeId,
    setSelectedNodeId,
    setHoveredNodeId,
    selectedNode,
  }), [graph, hoveredNodeId, selectedNode, selectedNodeId]);

  return <BusinessGraphContext.Provider value={value}>{children}</BusinessGraphContext.Provider>;
}

export function useBusinessGraph() {
  const context = useContext(BusinessGraphContext);

  if (!context) {
    throw new Error("useBusinessGraph must be used within BusinessGraphProvider.");
  }

  return context;
}
