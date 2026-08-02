export type GraphFreshness = "fresh" | "aging" | "stale" | "unknown";

export type GraphDirection = "directed" | "bidirectional";

export type GraphDataCompleteness = {
  isComplete: boolean;
  missingFields: string[];
};

export type GraphEntityType =
  | "company"
  | "customer"
  | "project"
  | "project_phase"
  | "task"
  | "employee"
  | "crew"
  | "equipment"
  | "estimate"
  | "invoice"
  | "change_order"
  | "vendor"
  | "purchase_order"
  | "payment"
  | "document"
  | "inspection"
  | "schedule_event";

export type GraphRelationshipType =
  | "owns"
  | "belongs_to"
  | "assigned_to"
  | "works_on"
  | "managed_by"
  | "linked_to"
  | "billed_by"
  | "paid_by"
  | "derived_from"
  | "affects"
  | "depends_on"
  | "scheduled_for"
  | "uses"
  | "supplied_by"
  | "approved_by"
  | "documented_by"
  | "inspected_by"
  | "related_to";

export type GraphNode = {
  id: string;
  companyId: string;
  entityType: GraphEntityType;
  entityId: string;
  displayName: string;
  status: string;
  freshness: GraphFreshness;
  dataCompleteness: GraphDataCompleteness;
  source: string;
  attributes: Record<string, string | number | boolean | null>;
  createdAt: string;
  updatedAt: string;
  graphVersion: string;
};

export type GraphEdge = {
  id: string;
  companyId: string;
  fromNodeId: string;
  toNodeId: string;
  relationshipType: GraphRelationshipType;
  direction: GraphDirection;
  confidence: number;
  freshness: GraphFreshness;
  evidence: string[];
  activeFrom: string | null;
  activeTo: string | null;
  ruleId: string;
  ruleVersion: string;
  graphVersion: string;
};

export type GraphNodeInput = Omit<GraphNode, "id" | "graphVersion">;

export type GraphEdgeInput = Omit<GraphEdge, "id" | "graphVersion"> & {
  fromEntityType: GraphEntityType;
  fromEntityId: string;
  toEntityType: GraphEntityType;
  toEntityId: string;
  timeWindowClass: string;
};

export type GraphIndex = {
  nodes: GraphNode[];
  edges: GraphEdge[];
  rejectedEdgeIds: string[];
  nodeById: Map<string, GraphNode>;
  nodesByEntityType: Map<GraphEntityType, GraphNode[]>;
  outgoingEdgesByNodeId: Map<string, GraphEdge[]>;
  incomingEdgesByNodeId: Map<string, GraphEdge[]>;
  edgesByRelationshipType: Map<GraphRelationshipType, GraphEdge[]>;
  nodesByCompany: Map<string, GraphNode[]>;
};

export type GraphTraversalOptions = {
  maxDepth?: number;
  relationshipTypes?: GraphRelationshipType[];
  entityTypes?: GraphEntityType[];
  includeIncoming?: boolean;
  includeOutgoing?: boolean;
  respectDirection?: boolean;
};

export type GraphNeighbor = {
  node: GraphNode;
  edge: GraphEdge;
  direction: "incoming" | "outgoing";
};

export type GraphPath = {
  nodeIds: string[];
  edgeIds: string[];
  cycleDetected: boolean;
};

export type GraphPathExplanation = {
  startNode: GraphNode;
  endNode: GraphNode;
  nodes: GraphNode[];
  edges: GraphEdge[];
  relationshipSummary: string;
  evidence: string[];
  limitations: string[];
  freshness: GraphFreshness;
  confidence: {
    score: number;
    reasons: string[];
  };
};

export type GraphRelationshipContext = {
  rootNodeId: string;
  relatedNodeIds: string[];
  relatedEdgeIds: string[];
  directRelationships: GraphNeighbor[];
  dependencyPaths: GraphPathExplanation[];
  financialConnections: GraphNeighbor[];
  workforceConnections: GraphNeighbor[];
  scheduleConnections: GraphNeighbor[];
  unresolvedReferences: string[];
  staleRelationships: string[];
  limitations: string[];
  generatedAt: string;
};

export type OrionGraphEnrichment = {
  graphContext: GraphRelationshipContext;
  relatedEntities: GraphNode[];
  dependencyPaths: GraphPathExplanation[];
  affectedAreas: string[];
  supportingRelationships: GraphEdge[];
  graphConfidence: {
    score: number;
    level: "low" | "medium" | "high";
    reasons: string[];
  };
  graphLimitations: string[];
};

export const GRAPH_DEFAULTS = {
  graphVersion: "orion-knowledge-graph-v1",
  maxTraversalDepth: 4,
  defaultTraversalDepth: 3,
} as const;
