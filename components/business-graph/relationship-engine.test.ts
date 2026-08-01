import {
  RelationshipEngineFromExecutive,
  RelationshipEngineFromProject,
  collectDependencyPath,
  collectNodeConnections,
} from "./RelationshipEngine";
import type { ExecutiveDashboardData } from "@/lib/dashboard/types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const dashboardData: ExecutiveDashboardData = {
    metrics: [],
    activities: [
      {
        id: "act-1",
        icon: "I",
        category: "invoice",
        timestampMinutesAgo: 22,
        user: "A",
        avatarLabel: "A",
        actionLabelKey: null,
        actionLabel: "Invoice pending",
        href: "/invoices",
      },
    ],
    projectHealth: {
      onScheduleCount: 1,
      atRiskCount: 1,
      behindScheduleCount: 0,
      projects: [
        {
          id: "p1",
          projectName: "Northpoint",
          healthScore: 68,
          budgetStatusKey: "dashboard.budgetAtRisk",
          scheduleStatusKey: "dashboard.scheduleAtRisk",
          lastPhotoUpload: "today",
          lastDailyReport: "today",
          currentPhase: "Framing",
          riskIndicator: "high",
          href: "/projects/p1",
        },
      ],
    },
    schedule: [
      {
        id: "s1",
        period: "morning",
        timeLabel: "7:00",
        titleKey: null,
        title: "Coordination",
        projectName: "Northpoint",
        location: "A",
        employeesAssigned: 1,
        status: "pending",
        href: "/schedule",
      },
    ],
    weather: null,
    businessScore: null,
    businessSummary: null,
    recommendations: [
      {
        id: "r1",
        icon: "!",
        priority: "critical",
        timestampMinutesAgo: 4,
        messageKey: "dashboard.test",
        actions: [],
      },
    ],
    widgetDefinitions: [
      { id: "kpi", titleKey: "dashboard.kpi", descriptionKey: "dashboard.kpi" },
      { id: "schedule", titleKey: "dashboard.schedule", descriptionKey: "dashboard.schedule" },
      { id: "project-health", titleKey: "dashboard.projectHealth", descriptionKey: "dashboard.projectHealth" },
      { id: "weather", titleKey: "dashboard.weather", descriptionKey: "dashboard.weather" },
      { id: "activity", titleKey: "dashboard.activity", descriptionKey: "dashboard.activity" },
      { id: "business-score", titleKey: "dashboard.businessScore", descriptionKey: "dashboard.businessScore" },
      { id: "command-center", titleKey: "dashboard.commandCenter", descriptionKey: "dashboard.commandCenter" },
    ],
  };

  const exec = RelationshipEngineFromExecutive(dashboardData, "Bango");
  assert(exec.graph.nodes.length > 0, "executive graph nodes should not be empty");
  assert(exec.graph.edges.length > 0, "executive graph edges should not be empty");
  assert(exec.signals.blockedDependencies === 1, "blocked dependencies should equal critical recommendation count");
  assert(exec.graph.nodes.some((node) => node.kind === "customer"), "executive graph should include customer nodes");
  assert(exec.graph.nodes.some((node) => node.kind === "invoice"), "executive graph should include invoice nodes");

  const projectGraph = RelationshipEngineFromProject(
    {
      projectId: "p1",
      projectName: "Northpoint",
      customerName: "Acme",
      customerHref: "/customers/c1",
      phases: [{ id: "phase-1", label: "Framing" }],
      taskCount: 12,
      photosCount: 22,
      changeOrdersCount: 2,
      invoiceCount: 3,
    },
    "Bango",
  );

  assert(projectGraph.nodes.some((node) => node.kind === "invoice"), "project graph should include invoice nodes");
  assert(projectGraph.nodes.some((node) => node.kind === "document"), "project graph should include document nodes");

  const firstNode = projectGraph.nodes[0];
  const deps = collectDependencyPath(projectGraph, firstNode.id);
  assert(deps.nodeIds.size >= 1, "dependency path should include at least the selected node");

  const changeOrderNode = projectGraph.nodes.find((node) => node.kind === "change_order");
  assert(Boolean(changeOrderNode), "project graph should include a change order node");

  const connections = collectNodeConnections(projectGraph, changeOrderNode?.id ?? null);
  assert(connections.length === 2, "change order node should connect to project and invoice nodes");
  assert(connections.some((connection) => connection.direction === "incoming" && connection.nodeKind === "project"), "change order should have an incoming project relationship");
  assert(connections.some((connection) => connection.direction === "outgoing" && connection.nodeKind === "invoice"), "change order should have an outgoing invoice relationship");
  assert(connections.some((connection) => connection.dependency), "change order should expose dependency-sensitive relationships");

  console.log("Business Graph tests: passed");
}

run();
