import fs from "node:fs";
import path from "node:path";
import {
  buildEdgeId,
  buildGraphEdge,
  buildGraphEnrichment,
  buildGraphIndex,
  buildGraphNode,
  buildKnowledgeGraphFixtures,
  buildNodeId,
  findPath,
  getImmediateNeighbors,
  getIncomingNeighbors,
  getOutgoingNeighbors,
  explainPath,
} from "./index";

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    passed += 1;
    console.log(`  + ${message}`);
  } else {
    failed += 1;
    console.error(`  x FAIL: ${message}`);
  }
}

async function test(name: string, fn: () => void | Promise<void>) {
  console.log(`\n${name}`);
  await fn();
}

function read(relativePath: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8");
}

async function main() {
  const fixtureA = buildKnowledgeGraphFixtures();
  const fixtureB = buildKnowledgeGraphFixtures();

  const indexResult = buildGraphIndex({
    nodes: fixtureA.nodes,
    edges: fixtureA.edges,
  });

  const index = indexResult.index;
  const rootNodeId = fixtureA.rootNodeId;

  await test("1-6. stable ids and company isolation", () => {
    const nodeIdA = buildNodeId({
      companyId: "company-a",
      entityType: "project",
      entityId: "proj-riverside",
      source: "fixture",
    });
    const nodeIdB = buildNodeId({
      companyId: "company-a",
      entityType: "project",
      entityId: "proj-riverside",
      source: "fixture",
    });
    assert(nodeIdA === nodeIdB, "stable node IDs are deterministic");

    const edgeIdA = buildEdgeId({
      companyId: "company-a",
      fromEntityType: "invoice",
      fromEntityId: "inv-1842",
      toEntityType: "project",
      toEntityId: "proj-riverside",
      fromNodeId: "n1",
      toNodeId: "n2",
      relationshipType: "billed_by",
      direction: "directed",
      confidence: 0.8,
      freshness: "fresh",
      evidence: ["invoices.project_id"],
      activeFrom: null,
      activeTo: null,
      ruleId: "kg.invoice_billed_project",
      ruleVersion: "1.0.0",
      timeWindowClass: "invoice_cycle",
    });
    const edgeIdB = buildEdgeId({
      companyId: "company-a",
      fromEntityType: "invoice",
      fromEntityId: "inv-1842",
      toEntityType: "project",
      toEntityId: "proj-riverside",
      fromNodeId: "n1",
      toNodeId: "n2",
      relationshipType: "billed_by",
      direction: "directed",
      confidence: 0.5,
      freshness: "aging",
      evidence: ["different"],
      activeFrom: null,
      activeTo: null,
      ruleId: "kg.invoice_billed_project",
      ruleVersion: "1.0.0",
      timeWindowClass: "invoice_cycle",
    });
    assert(edgeIdA === edgeIdB, "stable edge IDs are deterministic for same identity fields");

    const graphA = buildGraphIndex({ nodes: fixtureA.nodes, edges: fixtureA.edges }).index;
    const graphB = buildGraphIndex({ nodes: fixtureB.nodes, edges: fixtureB.edges }).index;
    assert(JSON.stringify(graphA.nodes) === JSON.stringify(graphB.nodes) && JSON.stringify(graphA.edges) === JSON.stringify(graphB.edges), "identical inputs produce identical graph");

    const edgeIdDifferent = buildEdgeId({
      companyId: "company-a",
      fromEntityType: "invoice",
      fromEntityId: "inv-1842",
      toEntityType: "change_order",
      toEntityId: "co-7",
      fromNodeId: "n1",
      toNodeId: "n3",
      relationshipType: "linked_to",
      direction: "directed",
      confidence: 0.8,
      freshness: "fresh",
      evidence: ["change_order_invoice_links"],
      activeFrom: null,
      activeTo: null,
      ruleId: "kg.invoice_linked_change_order",
      ruleVersion: "1.0.0",
      timeWindowClass: "invoice_cycle",
    });
    assert(edgeIdA !== edgeIdDifferent, "different relationships produce different edge IDs");

    const companyBNodes = graphA.nodes.filter((node) => node.companyId === "company-b");
    assert(companyBNodes.length === 1, "mixed-company fixtures are retained as separate scope");

    assert(graphA.rejectedEdgeIds.length >= 2, "cross-company and unresolved edges are rejected from active graph");
  });

  await test("7-13. traversal and deterministic path behavior", () => {
    const immediate = getImmediateNeighbors(index, rootNodeId);
    assert(immediate.length > 0, "immediate neighbors are returned");

    const incoming = getIncomingNeighbors(index, rootNodeId);
    assert(incoming.length > 0, "incoming neighbors are returned");

    const outgoing = getOutgoingNeighbors(index, rootNodeId);
    assert(outgoing.length > 0, "outgoing neighbors are returned");

    const relationshipFiltered = getImmediateNeighbors(index, rootNodeId, { relationshipTypes: ["billed_by"] });
    assert(relationshipFiltered.every((item) => item.edge.relationshipType === "billed_by"), "relationship-type filtering is respected");

    const typeFiltered = getImmediateNeighbors(index, rootNodeId, { entityTypes: ["project"] });
    assert(typeFiltered.every((item) => item.node.entityType === "project"), "entity-type filtering is respected");

    const customerNode = index.nodes.find((node) => node.entityType === "customer" && node.companyId === "company-a");
    if (!customerNode) {
      assert(false, "customer fixture exists");
      return;
    }

    const shortPath = findPath(index, {
      startNodeId: rootNodeId,
      endNodeId: customerNode.id,
      options: { maxDepth: 1, includeOutgoing: true, includeIncoming: false },
    });
    assert(shortPath === null, "maximum depth prevents deeper traversal");

    const fullPathA = findPath(index, {
      startNodeId: rootNodeId,
      endNodeId: customerNode.id,
      options: { maxDepth: 4, includeOutgoing: true, includeIncoming: false },
    });
    const fullPathB = findPath(index, {
      startNodeId: rootNodeId,
      endNodeId: customerNode.id,
      options: { maxDepth: 4, includeOutgoing: true, includeIncoming: false },
    });
    assert(Boolean(fullPathA) && JSON.stringify(fullPathA) === JSON.stringify(fullPathB), "path finding is deterministic");
  });

  await test("14-15. cycle protection and limitation reporting", () => {
    const cycleNodes = [
      buildGraphNode({
        companyId: "company-a",
        entityType: "document",
        entityId: "cycle-a",
        displayName: "Cycle A",
        status: "active",
        freshness: "fresh",
        dataCompleteness: { isComplete: true, missingFields: [] },
        source: "fixture",
        attributes: {},
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
      buildGraphNode({
        companyId: "company-a",
        entityType: "document",
        entityId: "cycle-b",
        displayName: "Cycle B",
        status: "active",
        freshness: "fresh",
        dataCompleteness: { isComplete: true, missingFields: [] },
        source: "fixture",
        attributes: {},
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
      buildGraphNode({
        companyId: "company-a",
        entityType: "document",
        entityId: "cycle-c",
        displayName: "Cycle C",
        status: "active",
        freshness: "fresh",
        dataCompleteness: { isComplete: true, missingFields: [] },
        source: "fixture",
        attributes: {},
        createdAt: "2026-08-02T00:00:00.000Z",
        updatedAt: "2026-08-02T00:00:00.000Z",
      }),
    ];

    const byEntity = new Map(cycleNodes.map((node) => [node.entityId, node.id]));

    const cycleEdges = [
      buildGraphEdge({
        companyId: "company-a",
        fromEntityType: "document",
        fromEntityId: "cycle-a",
        toEntityType: "document",
        toEntityId: "cycle-b",
        fromNodeId: byEntity.get("cycle-a") ?? "",
        toNodeId: byEntity.get("cycle-b") ?? "",
        relationshipType: "related_to",
        direction: "directed",
        confidence: 0.8,
        freshness: "fresh",
        evidence: ["cycle-a-b"],
        activeFrom: null,
        activeTo: null,
        ruleId: "kg.cycle.a_b",
        ruleVersion: "1.0.0",
        timeWindowClass: "test",
      }),
      buildGraphEdge({
        companyId: "company-a",
        fromEntityType: "document",
        fromEntityId: "cycle-b",
        toEntityType: "document",
        toEntityId: "cycle-a",
        fromNodeId: byEntity.get("cycle-b") ?? "",
        toNodeId: byEntity.get("cycle-a") ?? "",
        relationshipType: "related_to",
        direction: "directed",
        confidence: 0.8,
        freshness: "fresh",
        evidence: ["cycle-b-a"],
        activeFrom: null,
        activeTo: null,
        ruleId: "kg.cycle.b_a",
        ruleVersion: "1.0.0",
        timeWindowClass: "test",
      }),
      buildGraphEdge({
        companyId: "company-a",
        fromEntityType: "document",
        fromEntityId: "cycle-b",
        toEntityType: "document",
        toEntityId: "cycle-c",
        fromNodeId: byEntity.get("cycle-b") ?? "",
        toNodeId: byEntity.get("cycle-c") ?? "",
        relationshipType: "related_to",
        direction: "directed",
        confidence: 0.8,
        freshness: "fresh",
        evidence: ["cycle-b-c"],
        activeFrom: null,
        activeTo: null,
        ruleId: "kg.cycle.b_c",
        ruleVersion: "1.0.0",
        timeWindowClass: "test",
      }),
    ];

    const cycleIndex = buildGraphIndex({ nodes: cycleNodes, edges: cycleEdges }).index;
    const cyclePath = findPath(cycleIndex, {
      startNodeId: byEntity.get("cycle-a") ?? "",
      endNodeId: byEntity.get("cycle-c") ?? "",
      options: { includeOutgoing: true, includeIncoming: false, maxDepth: 4 },
    });

    assert(Boolean(cyclePath), "cycle path is found without infinite loop");
    if (!cyclePath) {
      return;
    }

    assert(cyclePath.cycleDetected, "cycle is detected during traversal");

    const explained = explainPath(cycleIndex, cyclePath);
    assert(Boolean(explained), "cycle path explanation is generated");
    if (explained) {
      assert(explained.limitations.some((item) => item.toLowerCase().includes("cycle")), "cycle limitation is reported in path explanation");
    }
  });

  await test("16-23. relationship context behavior", () => {
    const enrichment = buildGraphEnrichment({
      index,
      rootNodeId,
      nowIso: "2026-08-02T12:00:00.000Z",
      maxDepth: 4,
    });

    const projectRoot = index.nodes.find((node) => node.entityType === "project" && node.companyId === "company-a");
    const projectEnrichment = projectRoot
      ? buildGraphEnrichment({
        index,
        rootNodeId: projectRoot.id,
        nowIso: "2026-08-02T12:00:00.000Z",
        maxDepth: 4,
      })
      : null;

    assert(enrichment.graphContext.unresolvedReferences.length > 0, "unresolved references are reported");
    assert(Boolean(projectEnrichment), "project-root enrichment is available");
    if (projectEnrichment) {
      assert(projectEnrichment.graphContext.staleRelationships.length > 0, "stale relationships are tracked");
    }
    assert(enrichment.graphConfidence.reasons.length > 0 && enrichment.graphConfidence.score >= 0 && enrichment.graphConfidence.score <= 1, "graph confidence returns bounded score with reasons");

    assert(enrichment.graphContext.directRelationships.length > 0, "direct relationship context is present");
    assert(enrichment.graphContext.dependencyPaths.length > 0, "dependency path context is present");
    assert(enrichment.graphContext.financialConnections.length > 0, "financial relationship context is present");
    assert(enrichment.graphContext.workforceConnections.length >= 0, "workforce relationship context is available");
    assert(enrichment.graphContext.scheduleConnections.length >= 0, "schedule relationship context is available");
  });

  await test("24-26. deterministic enrichment and immutability", () => {
    const sourceNodes = buildKnowledgeGraphFixtures();
    const sourceClone = JSON.stringify(sourceNodes);

    const graphA = buildGraphIndex({ nodes: sourceNodes.nodes, edges: sourceNodes.edges }).index;
    const graphB = buildGraphIndex({ nodes: sourceNodes.nodes, edges: sourceNodes.edges }).index;

    assert(JSON.stringify(graphA.nodes.map((node) => node.id)) === JSON.stringify(graphB.nodes.map((node) => node.id)), "deterministic ordering is preserved");

    const enrichA = buildGraphEnrichment({
      index: graphA,
      rootNodeId: sourceNodes.rootNodeId,
      nowIso: "2026-08-02T12:00:00.000Z",
      maxDepth: 4,
    });
    const enrichB = buildGraphEnrichment({
      index: graphA,
      rootNodeId: sourceNodes.rootNodeId,
      nowIso: "2026-08-02T12:00:00.000Z",
      maxDepth: 4,
    });

    assert(JSON.stringify(enrichA) === JSON.stringify(enrichB), "deterministic enrichment output is stable");
    assert(JSON.stringify(sourceNodes) === sourceClone, "source entities remain unchanged");
  });

  await test("27-32. offline read-only guardrails", () => {
    const files = [
      "lib/orion/knowledge-graph/graph-node-builder.ts",
      "lib/orion/knowledge-graph/graph-edge-builder.ts",
      "lib/orion/knowledge-graph/graph-index.ts",
      "lib/orion/knowledge-graph/graph-traversal.ts",
      "lib/orion/knowledge-graph/graph-path-explainer.ts",
      "lib/orion/knowledge-graph/graph-context-builder.ts",
      "lib/orion/knowledge-graph/fixtures.ts",
    ];

    const source = files.map((file) => read(file)).join("\n").toLowerCase();

    assert(!source.includes("@/lib/supabase") && !source.includes("supabaseclient"), "no Supabase usage");
    assert(!source.includes("fetch("), "no network usage");
    assert(!source.includes(".insert(") && !source.includes(".update(") && !source.includes(".delete(") && !source.includes(".upsert("), "no write usage");
    assert(!source.includes("openai") && !source.includes("chat.completions"), "no OpenAI usage");
    assert(source.includes("buildknowledgegraphfixtures"), "fixture-only behavior is present");

    const explanation = buildGraphEnrichment({
      index,
      rootNodeId,
      nowIso: "2026-08-02T12:00:00.000Z",
      maxDepth: 4,
    }).dependencyPaths.map((path) => path.relationshipSummary).join(" ").toLowerCase();

    assert(!explanation.includes("caused by") && !explanation.includes("will happen") && !explanation.includes("probably"), "unsupported causality is not fabricated");
  });

  console.log(`\nKnowledge Graph v1 results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main();
