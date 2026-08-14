export type GraphNodeKind =
  | "company"
  | "customer"
  | "project"
  | "task"
  | "phase"
  | "crew"
  | "equipment"
  | "document"
  | "photo"
  | "change_order"
  | "invoice";

export type GraphNodeModel = {
  id: string;
  kind: GraphNodeKind;
  label: string;
  value?: string;
  href?: string;
  risk?: "low" | "medium" | "high";
  metadata?: Record<string, string | number | boolean | null>;
};

export type GraphEdgeModel = {
  id: string;
  from: string;
  to: string;
  label?: string;
  dependency?: boolean;
};

export type GraphModel = {
  nodes: GraphNodeModel[];
  edges: GraphEdgeModel[];
};

export type GraphLayoutNode = GraphNodeModel & {
  x: number;
  y: number;
  layer: number;
};

const LAYER_ORDER: GraphNodeKind[] = [
  "company",
  "customer",
  "project",
  "task",
  "phase",
  "crew",
  "equipment",
  "document",
  "photo",
  "change_order",
  "invoice",
];

const LAYER_GAP_X = 210;
const ROW_GAP_Y = 90;

export function GraphLayoutEngine(graph: GraphModel): GraphLayoutNode[] {
  const incoming = buildIncomingEdgeMap(graph.edges);
  const byLayer = new Map<number, GraphNodeModel[]>();

  graph.nodes.forEach((node) => {
    const fallbackLayer = LAYER_ORDER.indexOf(node.kind);
    const computedLayer = inferLayer(node, incoming, fallbackLayer);
    const current = byLayer.get(computedLayer) || [];
    current.push(node);
    byLayer.set(computedLayer, current);
  });

  const layers = Array.from(byLayer.keys()).sort((a, b) => a - b);
  const laidOut: GraphLayoutNode[] = [];

  layers.forEach((layerIndex) => {
    const nodes = byLayer.get(layerIndex) || [];
    const ordered = [...nodes].sort((a, b) => a.label.localeCompare(b.label));
    const layerHeight = (ordered.length - 1) * ROW_GAP_Y;
    const offsetY = layerHeight > 0 ? -(layerHeight / 2) : 0;

    ordered.forEach((node, idx) => {
      laidOut.push({
        ...node,
        layer: layerIndex,
        x: layerIndex * LAYER_GAP_X,
        y: offsetY + idx * ROW_GAP_Y,
      });
    });
  });

  return laidOut;
}

function buildIncomingEdgeMap(edges: GraphEdgeModel[]) {
  const map = new Map<string, string[]>();

  edges.forEach((edge) => {
    const incoming = map.get(edge.to) || [];
    incoming.push(edge.from);
    map.set(edge.to, incoming);
  });

  return map;
}

function inferLayer(
  node: GraphNodeModel,
  incoming: Map<string, string[]>,
  fallbackLayer: number,
) {
  const incomingNodes = incoming.get(node.id) || [];

  if (incomingNodes.length === 0) {
    return Math.max(0, fallbackLayer);
  }

  return Math.max(0, fallbackLayer);
}
