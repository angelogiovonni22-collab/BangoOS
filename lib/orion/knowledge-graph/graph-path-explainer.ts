import type { GraphEdge, GraphFreshness, GraphIndex, GraphPath, GraphPathExplanation } from "./graph-types";

function freshnessRank(value: GraphFreshness): number {
  if (value === "stale") {
    return 4;
  }

  if (value === "unknown") {
    return 3;
  }

  if (value === "aging") {
    return 2;
  }

  return 1;
}

function summarizeFreshness(edges: GraphEdge[]): GraphFreshness {
  if (edges.length === 0) {
    return "unknown";
  }

  return [...edges]
    .sort((left, right) => freshnessRank(right.freshness) - freshnessRank(left.freshness))[0]
    .freshness;
}

function summarizeConfidence(edges: GraphEdge[]): { score: number; reasons: string[] } {
  if (edges.length === 0) {
    return {
      score: 0,
      reasons: ["Path has no deterministic supporting relationships."],
    };
  }

  const average = edges.reduce((sum, edge) => sum + edge.confidence, 0) / edges.length;
  const score = Number(Math.max(0, Math.min(1, average)).toFixed(4));

  const reasons = [
    `Path uses ${edges.length} deterministic relationship edges.`,
    `Average edge confidence is ${average.toFixed(2)}.`,
  ];

  const staleCount = edges.filter((edge) => edge.freshness === "stale").length;
  if (staleCount > 0) {
    reasons.push(`${staleCount} relationship edges are stale.`);
  }

  return { score, reasons };
}

function relationshipSummary(parts: string[]): string {
  return parts.join(" -> ");
}

export function explainPath(index: GraphIndex, path: GraphPath): GraphPathExplanation | null {
  if (path.nodeIds.length < 2 || path.edgeIds.length < 1) {
    return null;
  }

  const nodes = path.nodeIds
    .map((id) => index.nodeById.get(id) ?? null)
    .filter((node): node is NonNullable<typeof node> => node !== null);

  const edges = path.edgeIds
    .map((id) => index.edges.find((edge) => edge.id === id) ?? null)
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null);

  if (nodes.length < 2 || edges.length < 1) {
    return null;
  }

  const summaryParts: string[] = [nodes[0].displayName];
  for (let i = 0; i < edges.length; i += 1) {
    summaryParts.push(edges[i].relationshipType);
    summaryParts.push(nodes[i + 1]?.displayName ?? "unknown node");
  }

  const evidence = [...new Set(edges.flatMap((edge) => edge.evidence))].sort((a, b) => a.localeCompare(b));

  const limitations: string[] = [];
  if (path.cycleDetected) {
    limitations.push("Cycle detected while traversing path; traversal bounded by cycle protection.");
  }

  const staleEdges = edges.filter((edge) => edge.freshness === "stale");
  if (staleEdges.length > 0) {
    limitations.push("Path includes stale relationship evidence.");
  }

  const unknownFreshnessEdges = edges.filter((edge) => edge.freshness === "unknown");
  if (unknownFreshnessEdges.length > 0) {
    limitations.push("Path includes relationships with unknown freshness.");
  }

  return {
    startNode: nodes[0],
    endNode: nodes[nodes.length - 1],
    nodes,
    edges,
    relationshipSummary: relationshipSummary(summaryParts),
    evidence,
    limitations,
    freshness: summarizeFreshness(edges),
    confidence: summarizeConfidence(edges),
  };
}
