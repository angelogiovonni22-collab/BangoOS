import { GRAPH_DEFAULTS, type GraphNode, type GraphNodeInput } from "./graph-types";

function stableKey(parts: Array<string | number>): string {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildNodeId(params: {
  companyId: string;
  entityType: string;
  entityId: string;
  source: string;
}): string {
  return stableKey([
    "kg-node",
    params.companyId,
    normalizeText(params.entityType),
    normalizeText(params.entityId),
    normalizeText(params.source),
  ]);
}

export function buildGraphNode(input: GraphNodeInput): GraphNode {
  return {
    ...input,
    id: buildNodeId({
      companyId: input.companyId,
      entityType: input.entityType,
      entityId: input.entityId,
      source: input.source,
    }),
    graphVersion: GRAPH_DEFAULTS.graphVersion,
  };
}

export function dedupeNodes(nodes: GraphNode[]): GraphNode[] {
  const byId = new Map<string, GraphNode>();

  for (const node of nodes) {
    const existing = byId.get(node.id);

    if (!existing) {
      byId.set(node.id, node);
      continue;
    }

    const existingCompleteness = existing.dataCompleteness.missingFields.length;
    const incomingCompleteness = node.dataCompleteness.missingFields.length;

    if (incomingCompleteness < existingCompleteness) {
      byId.set(node.id, node);
      continue;
    }

    if (incomingCompleteness === existingCompleteness && node.updatedAt > existing.updatedAt) {
      byId.set(node.id, node);
    }
  }

  return [...byId.values()].sort((left, right) => left.id.localeCompare(right.id));
}
