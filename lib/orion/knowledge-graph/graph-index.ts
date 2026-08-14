import { dedupeNodes } from "./graph-node-builder";
import { filterCompanyIsolatedEdges } from "./graph-edge-builder";
import type { GraphEdge, GraphEntityType, GraphIndex, GraphNode, GraphRelationshipType } from "./graph-types";

function pushMapArray<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const existing = map.get(key) ?? [];
  existing.push(value);
  map.set(key, existing);
}

function sortEdgeList(edges: GraphEdge[]): GraphEdge[] {
  return [...edges].sort((left, right) => left.id.localeCompare(right.id));
}

function sortNodeList(nodes: GraphNode[]): GraphNode[] {
  return [...nodes].sort((left, right) => left.id.localeCompare(right.id));
}

export function buildGraphIndex(params: {
  nodes: GraphNode[];
  edges: GraphEdge[];
}): { index: GraphIndex; rejectedEdgeIds: string[] } {
  const nodes = dedupeNodes(params.nodes);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const isolated = filterCompanyIsolatedEdges({
    edges: params.edges,
    nodeById,
  });

  const edges = sortEdgeList(isolated.accepted);

  const nodesByEntityType = new Map<GraphEntityType, GraphNode[]>();
  const outgoingEdgesByNodeId = new Map<string, GraphEdge[]>();
  const incomingEdgesByNodeId = new Map<string, GraphEdge[]>();
  const edgesByRelationshipType = new Map<GraphRelationshipType, GraphEdge[]>();
  const nodesByCompany = new Map<string, GraphNode[]>();

  for (const node of nodes) {
    pushMapArray(nodesByEntityType, node.entityType, node);
    pushMapArray(nodesByCompany, node.companyId, node);
  }

  for (const edge of edges) {
    pushMapArray(outgoingEdgesByNodeId, edge.fromNodeId, edge);
    pushMapArray(incomingEdgesByNodeId, edge.toNodeId, edge);
    if (edge.direction === "bidirectional") {
      pushMapArray(outgoingEdgesByNodeId, edge.toNodeId, edge);
      pushMapArray(incomingEdgesByNodeId, edge.fromNodeId, edge);
    }

    pushMapArray(edgesByRelationshipType, edge.relationshipType, edge);
  }

  for (const [key, value] of nodesByEntityType.entries()) {
    nodesByEntityType.set(key, sortNodeList(value));
  }

  for (const [key, value] of outgoingEdgesByNodeId.entries()) {
    outgoingEdgesByNodeId.set(key, sortEdgeList(value));
  }

  for (const [key, value] of incomingEdgesByNodeId.entries()) {
    incomingEdgesByNodeId.set(key, sortEdgeList(value));
  }

  for (const [key, value] of edgesByRelationshipType.entries()) {
    edgesByRelationshipType.set(key, sortEdgeList(value));
  }

  for (const [key, value] of nodesByCompany.entries()) {
    nodesByCompany.set(key, sortNodeList(value));
  }

  return {
    index: {
      nodes,
      edges,
      rejectedEdgeIds: isolated.rejected,
      nodeById,
      nodesByEntityType,
      outgoingEdgesByNodeId,
      incomingEdgesByNodeId,
      edgesByRelationshipType,
      nodesByCompany,
    },
    rejectedEdgeIds: isolated.rejected,
  };
}
