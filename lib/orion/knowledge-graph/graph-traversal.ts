import { GRAPH_DEFAULTS, type GraphEdge, type GraphIndex, type GraphNeighbor, type GraphPath, type GraphTraversalOptions } from "./graph-types";

function inSet<T>(set: Set<T> | null, value: T): boolean {
  return set === null || set.has(value);
}

function buildFilters(options: GraphTraversalOptions) {
  return {
    relationshipFilter: options.relationshipTypes && options.relationshipTypes.length > 0
      ? new Set(options.relationshipTypes)
      : null,
    entityFilter: options.entityTypes && options.entityTypes.length > 0
      ? new Set(options.entityTypes)
      : null,
  };
}

function sortNeighbors(items: GraphNeighbor[]): GraphNeighbor[] {
  return [...items].sort((left, right) => {
    const byNode = left.node.id.localeCompare(right.node.id);
    if (byNode !== 0) {
      return byNode;
    }

    const byEdge = left.edge.id.localeCompare(right.edge.id);
    if (byEdge !== 0) {
      return byEdge;
    }

    return left.direction.localeCompare(right.direction);
  });
}

function edgeTargetNodeId(edge: GraphEdge, currentNodeId: string): string | null {
  if (edge.fromNodeId === currentNodeId) {
    return edge.toNodeId;
  }

  if (edge.direction === "bidirectional" && edge.toNodeId === currentNodeId) {
    return edge.fromNodeId;
  }

  return null;
}

function edgeSourceNodeId(edge: GraphEdge, currentNodeId: string): string | null {
  if (edge.toNodeId === currentNodeId) {
    return edge.fromNodeId;
  }

  if (edge.direction === "bidirectional" && edge.fromNodeId === currentNodeId) {
    return edge.toNodeId;
  }

  return null;
}

export function getOutgoingNeighbors(index: GraphIndex, nodeId: string, options: GraphTraversalOptions = {}): GraphNeighbor[] {
  const { relationshipFilter, entityFilter } = buildFilters(options);
  const edges = index.outgoingEdgesByNodeId.get(nodeId) ?? [];
  const neighbors: GraphNeighbor[] = [];

  for (const edge of edges) {
    if (!inSet(relationshipFilter, edge.relationshipType)) {
      continue;
    }

    const targetNodeId = edgeTargetNodeId(edge, nodeId);
    if (!targetNodeId) {
      continue;
    }

    const targetNode = index.nodeById.get(targetNodeId);
    if (!targetNode || !inSet(entityFilter, targetNode.entityType)) {
      continue;
    }

    neighbors.push({ node: targetNode, edge, direction: "outgoing" });
  }

  return sortNeighbors(neighbors);
}

export function getIncomingNeighbors(index: GraphIndex, nodeId: string, options: GraphTraversalOptions = {}): GraphNeighbor[] {
  const { relationshipFilter, entityFilter } = buildFilters(options);
  const edges = index.incomingEdgesByNodeId.get(nodeId) ?? [];
  const neighbors: GraphNeighbor[] = [];

  for (const edge of edges) {
    if (!inSet(relationshipFilter, edge.relationshipType)) {
      continue;
    }

    const sourceNodeId = edgeSourceNodeId(edge, nodeId);
    if (!sourceNodeId) {
      continue;
    }

    const sourceNode = index.nodeById.get(sourceNodeId);
    if (!sourceNode || !inSet(entityFilter, sourceNode.entityType)) {
      continue;
    }

    neighbors.push({ node: sourceNode, edge, direction: "incoming" });
  }

  return sortNeighbors(neighbors);
}

export function getImmediateNeighbors(index: GraphIndex, nodeId: string, options: GraphTraversalOptions = {}): GraphNeighbor[] {
  const includeOutgoing = options.includeOutgoing ?? true;
  const includeIncoming = options.includeIncoming ?? true;

  const result = [
    ...(includeOutgoing ? getOutgoingNeighbors(index, nodeId, options) : []),
    ...(includeIncoming ? getIncomingNeighbors(index, nodeId, options) : []),
  ];

  return sortNeighbors(result);
}

export function findPath(index: GraphIndex, params: {
  startNodeId: string;
  endNodeId: string;
  options?: GraphTraversalOptions;
}): GraphPath | null {
  const options = params.options ?? {};
  const maxDepth = Math.min(options.maxDepth ?? GRAPH_DEFAULTS.defaultTraversalDepth, GRAPH_DEFAULTS.maxTraversalDepth);

  if (!index.nodeById.has(params.startNodeId) || !index.nodeById.has(params.endNodeId)) {
    return null;
  }

  const queue: Array<{
    nodeId: string;
    nodePath: string[];
    edgePath: string[];
    depth: number;
    cycleDetected: boolean;
  }> = [{
    nodeId: params.startNodeId,
    nodePath: [params.startNodeId],
    edgePath: [],
    depth: 0,
    cycleDetected: false,
  }];

  const visitedDepth = new Map<string, number>([[params.startNodeId, 0]]);
  let cycleObserved = false;

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    if (current.nodeId === params.endNodeId) {
      return {
        nodeIds: current.nodePath,
        edgeIds: current.edgePath,
        cycleDetected: current.cycleDetected || cycleObserved,
      };
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    const neighbors = getImmediateNeighbors(index, current.nodeId, {
      ...options,
      includeIncoming: options.includeIncoming ?? false,
      includeOutgoing: options.includeOutgoing ?? true,
    });

    for (const neighbor of neighbors) {
      const nextDepth = current.depth + 1;
      const seenDepth = visitedDepth.get(neighbor.node.id);

      const hasCycle = current.nodePath.includes(neighbor.node.id);
      if (hasCycle) {
        cycleObserved = true;
        continue;
      }

      if (seenDepth !== undefined && seenDepth < nextDepth) {
        continue;
      }

      visitedDepth.set(neighbor.node.id, nextDepth);
      queue.push({
        nodeId: neighbor.node.id,
        nodePath: [...current.nodePath, neighbor.node.id],
        edgePath: [...current.edgePath, neighbor.edge.id],
        depth: nextDepth,
        cycleDetected: current.cycleDetected || hasCycle,
      });
    }

    queue.sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  }

  return null;
}
