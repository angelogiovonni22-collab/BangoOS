import { GRAPH_DEFAULTS, type GraphEdge, type GraphIndex, type GraphNode, type GraphRelationshipContext, type OrionGraphEnrichment } from "./graph-types";
import { findPath, getImmediateNeighbors } from "./graph-traversal";
import { explainPath } from "./graph-path-explainer";

function sortUnique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function relationshipArea(edge: GraphEdge): "financial" | "workforce" | "schedule" | "other" {
  if (["billed_by", "paid_by", "approved_by", "supplied_by", "linked_to"].includes(edge.relationshipType)) {
    return "financial";
  }

  if (["assigned_to", "works_on", "managed_by", "uses"].includes(edge.relationshipType)) {
    return "workforce";
  }

  if (["scheduled_for", "depends_on", "affects"].includes(edge.relationshipType)) {
    return "schedule";
  }

  return "other";
}

function computeGraphConfidence(params: {
  rootNode: GraphNode;
  relationships: GraphEdge[];
  unresolvedReferences: string[];
  dependencyPathCount: number;
}): OrionGraphEnrichment["graphConfidence"] {
  const reasons: string[] = [];

  const completenessPenalty = params.rootNode.dataCompleteness.isComplete ? 0 : 0.12;
  const unresolvedPenalty = Math.min(0.25, params.unresolvedReferences.length * 0.06);

  const averageEdgeConfidence = params.relationships.length > 0
    ? params.relationships.reduce((sum, edge) => sum + edge.confidence, 0) / params.relationships.length
    : 0;

  const stalePenalty = params.relationships.length > 0
    ? params.relationships.filter((edge) => edge.freshness === "stale").length / params.relationships.length * 0.18
    : 0;

  const unknownPenalty = params.relationships.length > 0
    ? params.relationships.filter((edge) => edge.freshness === "unknown").length / params.relationships.length * 0.14
    : 0;

  const pathLengthPenalty = params.dependencyPathCount > 0 ? 0 : 0.08;

  const scoreRaw = averageEdgeConfidence * 0.65 + (params.rootNode.dataCompleteness.isComplete ? 0.2 : 0.05) - completenessPenalty - unresolvedPenalty - stalePenalty - unknownPenalty - pathLengthPenalty;
  const score = Number(Math.max(0, Math.min(1, scoreRaw)).toFixed(4));

  reasons.push(`Average relationship confidence is ${averageEdgeConfidence.toFixed(2)}.`);
  reasons.push(`${params.relationships.length} supporting relationships were evaluated.`);

  if (!params.rootNode.dataCompleteness.isComplete) {
    reasons.push("Root node has missing data fields.");
  }

  if (params.unresolvedReferences.length > 0) {
    reasons.push(`${params.unresolvedReferences.length} unresolved references reduced graph confidence.`);
  }

  if (stalePenalty > 0) {
    reasons.push("Stale relationship evidence reduced confidence.");
  }

  if (unknownPenalty > 0) {
    reasons.push("Unknown freshness relationships reduced confidence.");
  }

  return {
    score,
    level: score >= 0.75 ? "high" : score >= 0.45 ? "medium" : "low",
    reasons,
  };
}

export function buildGraphRelationshipContext(params: {
  index: GraphIndex;
  rootNodeId: string;
  nowIso: string;
  maxDepth?: number;
}): GraphRelationshipContext {
  const rootNode = params.index.nodeById.get(params.rootNodeId);
  if (!rootNode) {
    return {
      rootNodeId: params.rootNodeId,
      relatedNodeIds: [],
      relatedEdgeIds: [],
      directRelationships: [],
      dependencyPaths: [],
      financialConnections: [],
      workforceConnections: [],
      scheduleConnections: [],
      unresolvedReferences: [`Root node ${params.rootNodeId} not found.`],
      staleRelationships: [],
      limitations: ["Relationship context could not be built because root node is missing."],
      generatedAt: params.nowIso,
    };
  }

  const directRelationships = getImmediateNeighbors(params.index, rootNode.id, {
    includeIncoming: true,
    includeOutgoing: true,
    maxDepth: 1,
  });

  const relatedNodeIds = sortUnique(directRelationships.map((item) => item.node.id));
  const relatedEdgeIds = sortUnique(directRelationships.map((item) => item.edge.id));

  const unresolvedReferences: string[] = [...params.index.rejectedEdgeIds];

  const dependencyPaths = relatedNodeIds
    .map((targetNodeId) => findPath(params.index, {
      startNodeId: rootNode.id,
      endNodeId: targetNodeId,
      options: {
        includeOutgoing: true,
        includeIncoming: false,
        maxDepth: Math.min(params.maxDepth ?? GRAPH_DEFAULTS.defaultTraversalDepth, GRAPH_DEFAULTS.maxTraversalDepth),
      },
    }))
    .filter((path): path is NonNullable<typeof path> => path !== null)
    .map((path) => explainPath(params.index, path))
    .filter((path): path is NonNullable<typeof path> => path !== null)
    .sort((left, right) => left.endNode.id.localeCompare(right.endNode.id));

  const financialConnections = directRelationships.filter((item) => relationshipArea(item.edge) === "financial");
  const workforceConnections = directRelationships.filter((item) => relationshipArea(item.edge) === "workforce");
  const scheduleConnections = directRelationships.filter((item) => relationshipArea(item.edge) === "schedule");

  const staleRelationships = sortUnique([
    ...directRelationships
      .filter((item) => item.edge.freshness === "stale")
      .map((item) => item.edge.id),
    ...dependencyPaths
      .flatMap((path) => path.edges)
      .filter((edge) => edge.freshness === "stale")
      .map((edge) => edge.id),
  ]);

  const limitations = sortUnique([
    ...(unresolvedReferences.length > 0 ? ["Some graph edges reference nodes that were not resolved."] : []),
    ...(dependencyPaths.some((path) => path.limitations.length > 0)
      ? ["One or more dependency paths include cycle or freshness limitations."]
      : []),
  ]);

  return {
    rootNodeId: rootNode.id,
    relatedNodeIds,
    relatedEdgeIds,
    directRelationships,
    dependencyPaths,
    financialConnections,
    workforceConnections,
    scheduleConnections,
    unresolvedReferences: sortUnique(unresolvedReferences),
    staleRelationships,
    limitations,
    generatedAt: params.nowIso,
  };
}

export function buildGraphEnrichment(params: {
  index: GraphIndex;
  rootNodeId: string;
  nowIso: string;
  maxDepth?: number;
}): OrionGraphEnrichment {
  const graphContext = buildGraphRelationshipContext(params);
  const rootNode = params.index.nodeById.get(graphContext.rootNodeId);

  const relatedEntities = graphContext.relatedNodeIds
    .map((id) => params.index.nodeById.get(id) ?? null)
    .filter((node): node is GraphNode => node !== null)
    .sort((left, right) => left.id.localeCompare(right.id));

  const supportingRelationships = graphContext.relatedEdgeIds
    .map((id) => params.index.edges.find((edge) => edge.id === id) ?? null)
    .filter((edge): edge is GraphEdge => edge !== null)
    .sort((left, right) => left.id.localeCompare(right.id));

  const graphConfidence = computeGraphConfidence({
    rootNode: rootNode ?? {
      id: "missing",
      companyId: "missing",
      entityType: "company",
      entityId: "missing",
      displayName: "Missing root",
      status: "unknown",
      freshness: "unknown",
      dataCompleteness: { isComplete: false, missingFields: ["root_node"] },
      source: "graph",
      attributes: {},
      createdAt: params.nowIso,
      updatedAt: params.nowIso,
      graphVersion: GRAPH_DEFAULTS.graphVersion,
    },
    relationships: supportingRelationships,
    unresolvedReferences: graphContext.unresolvedReferences,
    dependencyPathCount: graphContext.dependencyPaths.length,
  });

  const affectedAreas = sortUnique([
    ...(graphContext.financialConnections.length > 0 ? ["financial"] : []),
    ...(graphContext.workforceConnections.length > 0 ? ["workforce"] : []),
    ...(graphContext.scheduleConnections.length > 0 ? ["schedule"] : []),
  ]);

  const graphLimitations = sortUnique([
    ...graphContext.limitations,
    ...graphContext.dependencyPaths.flatMap((path) => path.limitations),
  ]);

  return {
    graphContext,
    relatedEntities,
    dependencyPaths: graphContext.dependencyPaths,
    affectedAreas,
    supportingRelationships,
    graphConfidence,
    graphLimitations,
  };
}
