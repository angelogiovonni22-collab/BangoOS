import {
  buildGraphEnrichment,
  buildGraphIndex,
  type GraphEntityType,
  type GraphNode,
  type OrionGraphEnrichment,
} from "../knowledge-graph";
import type { ExecutiveSignalFact, GraphAdapterResult } from "./executive-intelligence-types";

function findRootNode(params: {
  companyId: string;
  nodes: GraphNode[];
  fact: ExecutiveSignalFact;
}): GraphNode | null {
  const root = params.fact.graphRootEntity;
  if (root) {
    return params.nodes.find((node) =>
      node.companyId === params.companyId
      && node.entityType === root.entityType
      && node.entityId === root.entityId,
    ) ?? null;
  }

  const firstEntity = params.fact.entityReferences[0];
  if (!firstEntity) {
    return null;
  }

  const mappedEntityType: GraphEntityType =
    firstEntity.entityType === "phase"
      ? "project_phase"
      : firstEntity.entityType === "assignment"
        ? "task"
        : firstEntity.entityType === "workspace"
          ? "project"
          : firstEntity.entityType;

  return params.nodes.find((node) =>
    node.companyId === params.companyId
    && node.entityType === mappedEntityType
    && node.entityId === firstEntity.entityId,
  ) ?? null;
}

export function enrichDecisionPacksWithGraph(params: {
  companyId: string;
  nowIso: string;
  nodes: import("../knowledge-graph").GraphNode[];
  edges: import("../knowledge-graph").GraphEdge[];
  pairs: Array<{
    decisionPackId: string;
    fact: ExecutiveSignalFact;
  }>;
  available: boolean;
  maxDepth?: number;
}): GraphAdapterResult {
  if (!params.available) {
    return {
      enrichmentByDecisionPackId: new Map(),
      limitations: ["Knowledge graph source is unavailable for this evaluation."],
      partialFailures: [{
        source: "graph",
        code: "GRAPH_SOURCE_UNAVAILABLE",
        message: "Graph source was unavailable; decision packs were evaluated without relationship context.",
        fatal: false,
      }],
      rejectedEdgeIds: [],
    };
  }

  const { index, rejectedEdgeIds } = buildGraphIndex({
    nodes: params.nodes,
    edges: params.edges,
  });

  const companyNodes = index.nodesByCompany.get(params.companyId) ?? [];
  const enrichmentByDecisionPackId = new Map<string, OrionGraphEnrichment>();
  const limitations: string[] = [];

  for (const pair of params.pairs) {
    const rootNode = findRootNode({
      companyId: params.companyId,
      nodes: companyNodes,
      fact: pair.fact,
    });

    if (!rootNode) {
      limitations.push(`Graph root was not found for ${pair.fact.canonicalConditionType}.`);
      continue;
    }

    const enrichment = buildGraphEnrichment({
      index,
      rootNodeId: rootNode.id,
      nowIso: params.nowIso,
      maxDepth: params.maxDepth,
    });

    enrichmentByDecisionPackId.set(pair.decisionPackId, enrichment);
    limitations.push(...enrichment.graphLimitations);
  }

  if (rejectedEdgeIds.length > 0) {
    limitations.push("Cross-company or unresolved graph edges were rejected.");
  }

  return {
    enrichmentByDecisionPackId,
    limitations: [...new Set(limitations)].sort((a, b) => a.localeCompare(b)),
    partialFailures: [],
    rejectedEdgeIds,
  };
}
