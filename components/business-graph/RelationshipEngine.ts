import type { ExecutiveDashboardData } from "@/lib/dashboard/types";
import {
  type GraphEdgeModel,
  type GraphModel,
  type GraphNodeModel,
} from "./GraphLayoutEngine";

export type ExecutiveRelationshipSignals = {
  highestRiskProject: string | null;
  blockedDependencies: number;
  invoiceBottlenecks: number;
  crewConflicts: number;
  scheduleConflicts: number;
};

export type GraphConnection = {
  edgeId: string;
  edgeLabel: string | null;
  dependency: boolean;
  direction: "incoming" | "outgoing";
  nodeId: string;
  nodeKind: GraphNodeModel["kind"];
  nodeLabel: string;
  href?: string;
};

export type ProjectRelationshipInput = {
  projectId: string;
  projectName: string;
  customerName: string | null;
  customerHref: string | null;
  phases: Array<{ id: string; label: string }>;
  taskCount: number;
  photosCount: number;
  changeOrdersCount: number;
  invoiceCount: number;
};

export function RelationshipEngineFromExecutive(data: ExecutiveDashboardData, companyName: string): {
  graph: GraphModel;
  signals: ExecutiveRelationshipSignals;
} {
  const nodes: GraphNodeModel[] = [];
  const edges: GraphEdgeModel[] = [];

  const companyNodeId = "company-root";
  nodes.push({
    id: companyNodeId,
    kind: "company",
    label: companyName || "Company",
    href: "/dashboard",
  });

  const topProjects = [...data.projectHealth.projects]
    .sort((a, b) => b.healthScore - a.healthScore)
    .slice(0, 4);

  const customerNodeId = "customers-group";
  nodes.push({ id: customerNodeId, kind: "customer", label: "Customers", value: String(topProjects.length), href: "/customers" });
  edges.push({ id: "edge-company-customers", from: companyNodeId, to: customerNodeId, label: "owns" });

  const highRisk = data.projectHealth.projects.find((project) => project.riskIndicator === "high") || null;
  const blockedDependencies = data.recommendations.filter((item) => item.priority === "critical").length;
  const invoiceBottlenecks = data.activities.filter((item) => item.category === "invoice").length;
  const scheduleConflicts = data.schedule.filter((item) => item.status === "pending" || item.status === "travel").length;
  const crewConflicts = Math.max(0, data.schedule.filter((item) => item.employeesAssigned <= 1).length - 1);

  topProjects.forEach((project, index) => {
    const projectNodeId = `project-${project.id}`;

    nodes.push({
      id: projectNodeId,
      kind: "project",
      label: project.projectName,
      value: `${project.healthScore}`,
      risk: project.riskIndicator,
      href: project.href,
    });

    edges.push({
      id: `edge-customer-project-${project.id}`,
      from: customerNodeId,
      to: projectNodeId,
      label: index === 0 ? "priority" : "active",
      dependency: project.riskIndicator !== "low",
    });

    const taskNodeId = `tasks-${project.id}`;
    nodes.push({ id: taskNodeId, kind: "task", label: "Tasks", value: project.scheduleStatusKey.includes("behind") ? "blocked" : "active", href: project.href });
    edges.push({ id: `edge-project-task-${project.id}`, from: projectNodeId, to: taskNodeId, label: "tracks" });

    const phaseNodeId = `phase-${project.id}`;
    nodes.push({ id: phaseNodeId, kind: "phase", label: project.currentPhase || "Phase", href: project.href });
    edges.push({ id: `edge-task-phase-${project.id}`, from: taskNodeId, to: phaseNodeId, label: "in" });

    const crewNodeId = `crew-${project.id}`;
    nodes.push({ id: crewNodeId, kind: "crew", label: "Crew", value: `${Math.max(1, Math.round(project.healthScore / 20))}`, href: "/crews" });
    edges.push({ id: `edge-phase-crew-${project.id}`, from: phaseNodeId, to: crewNodeId, label: "assigned" });

    const equipmentNodeId = `equipment-${project.id}`;
    nodes.push({ id: equipmentNodeId, kind: "equipment", label: "Equipment", value: "linked", href: "/equipment" });
    edges.push({ id: `edge-crew-equipment-${project.id}`, from: crewNodeId, to: equipmentNodeId, label: "uses" });

    const documentNodeId = `doc-${project.id}`;
    nodes.push({ id: documentNodeId, kind: "document", label: "Documents", href: `${project.href}?tab=documents` });
    edges.push({ id: `edge-project-document-${project.id}`, from: projectNodeId, to: documentNodeId, label: "contains" });

    const photoNodeId = `photo-${project.id}`;
    nodes.push({ id: photoNodeId, kind: "photo", label: "Photos", value: project.lastPhotoUpload === "--" ? "0" : "recent", href: `${project.href}?tab=documents` });
    edges.push({ id: `edge-document-photo-${project.id}`, from: documentNodeId, to: photoNodeId, label: "captures" });

    const changeOrderNodeId = `co-${project.id}`;
    nodes.push({ id: changeOrderNodeId, kind: "change_order", label: "Change Orders", href: `/change-orders?projectId=${project.id}` });
    edges.push({ id: `edge-project-co-${project.id}`, from: projectNodeId, to: changeOrderNodeId, label: "affects", dependency: project.riskIndicator === "high" });

    const invoiceNodeId = `invoice-${project.id}`;
    nodes.push({ id: invoiceNodeId, kind: "invoice", label: "Invoices", href: `/invoices?projectId=${project.id}` });
    edges.push({ id: `edge-co-invoice-${project.id}`, from: changeOrderNodeId, to: invoiceNodeId, label: "bills", dependency: project.riskIndicator !== "low" });
  });

  return {
    graph: { nodes, edges },
    signals: {
      highestRiskProject: highRisk?.projectName || null,
      blockedDependencies,
      invoiceBottlenecks,
      crewConflicts,
      scheduleConflicts,
    },
  };
}

export function RelationshipEngineFromProject(input: ProjectRelationshipInput, companyName: string) {
  const nodes: GraphNodeModel[] = [];
  const edges: GraphEdgeModel[] = [];

  const companyNodeId = "company-root";
  const customerNodeId = "customer-root";
  const projectNodeId = `project-${input.projectId}`;

  nodes.push({ id: companyNodeId, kind: "company", label: companyName || "Company", href: "/dashboard" });
  nodes.push({ id: customerNodeId, kind: "customer", label: input.customerName || "Unlinked Customer", href: input.customerHref || "/customers" });
  nodes.push({ id: projectNodeId, kind: "project", label: input.projectName, href: `/projects/${input.projectId}` });

  edges.push({ id: "company-customer", from: companyNodeId, to: customerNodeId, label: "serves" });
  edges.push({ id: "customer-project", from: customerNodeId, to: projectNodeId, label: "owns" });

  const taskNodeId = `tasks-${input.projectId}`;
  nodes.push({ id: taskNodeId, kind: "task", label: "Tasks", value: String(input.taskCount), href: `/projects/${input.projectId}?tab=work` });
  edges.push({ id: "project-task", from: projectNodeId, to: taskNodeId, label: "contains" });

  input.phases.slice(0, 4).forEach((phase) => {
    const phaseNodeId = `phase-${phase.id}`;
    nodes.push({ id: phaseNodeId, kind: "phase", label: phase.label, href: `/projects/${input.projectId}?tab=work` });
    edges.push({ id: `task-${phase.id}`, from: taskNodeId, to: phaseNodeId, label: "flows" });
  });

  const crewNodeId = `crew-${input.projectId}`;
  const equipmentNodeId = `equipment-${input.projectId}`;
  const documentNodeId = `document-${input.projectId}`;
  const photoNodeId = `photo-${input.projectId}`;
  const changeOrderNodeId = `change-order-${input.projectId}`;
  const invoiceNodeId = `invoice-${input.projectId}`;

  nodes.push({ id: crewNodeId, kind: "crew", label: "Crew", href: "/crews" });
  nodes.push({ id: equipmentNodeId, kind: "equipment", label: "Equipment", href: "/equipment" });
  nodes.push({ id: documentNodeId, kind: "document", label: "Documents", href: `/projects/${input.projectId}?tab=documents` });
  nodes.push({ id: photoNodeId, kind: "photo", label: "Photos", value: String(input.photosCount), href: `/projects/${input.projectId}?tab=documents` });
  nodes.push({ id: changeOrderNodeId, kind: "change_order", label: "Change Orders", value: String(input.changeOrdersCount), href: `/change-orders?projectId=${input.projectId}` });
  nodes.push({ id: invoiceNodeId, kind: "invoice", label: "Invoices", value: String(input.invoiceCount), href: `/invoices?projectId=${input.projectId}` });

  edges.push({ id: "project-crew", from: projectNodeId, to: crewNodeId, label: "assigns" });
  edges.push({ id: "crew-equipment", from: crewNodeId, to: equipmentNodeId, label: "uses" });
  edges.push({ id: "project-document", from: projectNodeId, to: documentNodeId, label: "stores" });
  edges.push({ id: "document-photo", from: documentNodeId, to: photoNodeId, label: "contains" });
  edges.push({ id: "project-change-order", from: projectNodeId, to: changeOrderNodeId, label: "drives", dependency: input.changeOrdersCount > 0 });
  edges.push({ id: "change-order-invoice", from: changeOrderNodeId, to: invoiceNodeId, label: "impacts", dependency: input.invoiceCount > 0 });

  return { nodes, edges } satisfies GraphModel;
}

export function collectDependencyPath(graph: GraphModel, selectedNodeId: string | null) {
  if (!selectedNodeId) {
    return { nodeIds: new Set<string>(), edgeIds: new Set<string>() };
  }

  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>([selectedNodeId]);

  const queue = [selectedNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      break;
    }

    graph.edges.forEach((edge) => {
      if (edge.from === current || edge.to === current) {
        edgeIds.add(edge.id);

        const counterpart = edge.from === current ? edge.to : edge.from;
        if (!nodeIds.has(counterpart)) {
          nodeIds.add(counterpart);
          queue.push(counterpart);
        }
      }
    });
  }

  return { nodeIds, edgeIds };
}

export function collectNodeConnections(graph: GraphModel, nodeId: string | null): GraphConnection[] {
  if (!nodeId) {
    return [];
  }

  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]));

  const connections = graph.edges.reduce<GraphConnection[]>((items, edge) => {
    if (edge.from !== nodeId && edge.to !== nodeId) {
      return items;
    }

    const outgoing = edge.from === nodeId;
    const counterpartId = outgoing ? edge.to : edge.from;
    const counterpart = nodesById.get(counterpartId);

    if (!counterpart) {
      return items;
    }

    items.push({
      edgeId: edge.id,
      edgeLabel: edge.label ?? null,
      dependency: Boolean(edge.dependency),
      direction: outgoing ? "outgoing" : "incoming",
      nodeId: counterpart.id,
      nodeKind: counterpart.kind,
      nodeLabel: counterpart.label,
      href: counterpart.href,
    });

    return items;
  }, []);

  return connections.sort((left, right) => {
      if (left.dependency !== right.dependency) {
        return left.dependency ? -1 : 1;
      }

      return left.nodeLabel.localeCompare(right.nodeLabel);
    });
}
