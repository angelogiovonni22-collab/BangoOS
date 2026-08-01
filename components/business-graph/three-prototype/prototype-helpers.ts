import type { GraphModel } from "../GraphLayoutEngine";
import {
  PROTOTYPE_EDGES,
  PROTOTYPE_NODES,
  buildPrototypeGraphModel,
  type PrototypeEdge,
  type PrototypeNode,
} from "./prototype-data";

export type PrototypeConnection = {
  edge: PrototypeEdge;
  node: PrototypeNode;
  direction: "incoming" | "outgoing";
};

export type PrototypeCameraView = {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
};

export const PROTOTYPE_GRAPH_MODEL: GraphModel = buildPrototypeGraphModel();

export const PROTOTYPE_OVERVIEW_CAMERA: PrototypeCameraView = {
  position: [0, 14, 22],
  target: [0, 1.2, 1.5],
};

export function getPrototypeNode(nodeId: string | null | undefined) {
  if (!nodeId) {
    return null;
  }

  return PROTOTYPE_NODES.find((node) => node.id === nodeId) || null;
}

export function getPrototypeConnections(nodeId: string | null | undefined): PrototypeConnection[] {
  const activeNode = getPrototypeNode(nodeId);

  if (!activeNode) {
    return [];
  }

  return PROTOTYPE_EDGES.reduce<PrototypeConnection[]>((items, edge) => {
    if (edge.from !== activeNode.id && edge.to !== activeNode.id) {
      return items;
    }

    const outgoing = edge.from === activeNode.id;
    const node = getPrototypeNode(outgoing ? edge.to : edge.from);

    if (!node) {
      return items;
    }

    items.push({
      edge,
      node,
      direction: outgoing ? "outgoing" : "incoming",
    });

    return items;
  }, []).sort((left, right) => {
    if (left.edge.dependency !== right.edge.dependency) {
      return left.edge.dependency ? -1 : 1;
    }

    return left.node.label.localeCompare(right.node.label);
  });
}

export function getPrototypeActiveNode(selectedNodeId: string | null, hoveredNodeId: string | null) {
  return getPrototypeNode(selectedNodeId || hoveredNodeId);
}

export function getPrototypeCameraView(nodeId: string | null, mode: "overview" | "focus"): PrototypeCameraView {
  if (mode !== "focus") {
    return PROTOTYPE_OVERVIEW_CAMERA;
  }

  const node = getPrototypeNode(nodeId);

  if (!node) {
    return PROTOTYPE_OVERVIEW_CAMERA;
  }

  const [x, y, z] = node.position;
  const horizontalScale = node.tier === "center" ? 0.48 : 0.72;
  const elevatedY = node.tier === "center" ? y + 4.2 : y + 3.2;

  return {
    position: [x * horizontalScale, elevatedY, z + 7.4],
    target: [x, y + 0.35, z],
  };
}

export function getPrototypeStats() {
  return {
    totalNodes: PROTOTYPE_NODES.length,
    hubs: PROTOTYPE_NODES.filter((node) => node.tier === "hub").length,
    childNodes: PROTOTYPE_NODES.filter((node) => node.tier === "child").length,
    directionalEdges: PROTOTYPE_EDGES.length,
  };
}