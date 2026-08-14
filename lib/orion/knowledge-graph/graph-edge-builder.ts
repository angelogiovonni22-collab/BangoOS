import { GRAPH_DEFAULTS, type GraphEdge, type GraphEdgeInput } from "./graph-types";

function stableKey(parts: Array<string | number>): string {
  return parts.join("::").toLowerCase().replace(/[^a-z0-9:._-]/g, "_");
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function buildEdgeId(input: GraphEdgeInput): string {
  return stableKey([
    "kg-edge",
    input.companyId,
    input.relationshipType,
    input.fromEntityType,
    input.fromEntityId,
    input.toEntityType,
    input.toEntityId,
    input.ruleId,
    input.ruleVersion,
    input.timeWindowClass,
  ]);
}

export function buildGraphEdge(input: GraphEdgeInput): GraphEdge {
  const confidence = Number(Math.max(0, Math.min(1, input.confidence)).toFixed(4));
  const evidence = [...new Set(input.evidence.map((value) => normalizeText(value)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));

  return {
    companyId: input.companyId,
    id: buildEdgeId(input),
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    relationshipType: input.relationshipType,
    direction: input.direction,
    confidence,
    freshness: input.freshness,
    evidence,
    activeFrom: input.activeFrom,
    activeTo: input.activeTo,
    ruleId: input.ruleId,
    ruleVersion: input.ruleVersion,
    graphVersion: GRAPH_DEFAULTS.graphVersion,
  };
}

export function filterCompanyIsolatedEdges(params: {
  edges: GraphEdge[];
  nodeById: Map<string, { id: string; companyId: string }>;
}): { accepted: GraphEdge[]; rejected: string[] } {
  const accepted: GraphEdge[] = [];
  const rejected: string[] = [];

  for (const edge of params.edges) {
    const fromNode = params.nodeById.get(edge.fromNodeId);
    const toNode = params.nodeById.get(edge.toNodeId);

    if (!fromNode || !toNode) {
      rejected.push(edge.id);
      continue;
    }

    const sameCompany =
      fromNode.companyId === edge.companyId
      && toNode.companyId === edge.companyId
      && fromNode.companyId === toNode.companyId;

    if (!sameCompany) {
      rejected.push(edge.id);
      continue;
    }

    accepted.push(edge);
  }

  return {
    accepted: accepted.sort((left, right) => left.id.localeCompare(right.id)),
    rejected: rejected.sort((left, right) => left.localeCompare(right)),
  };
}
