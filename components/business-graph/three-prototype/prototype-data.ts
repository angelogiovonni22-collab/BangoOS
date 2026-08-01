import type { GraphModel, GraphNodeKind } from "../GraphLayoutEngine";

export type PrototypeNodeTier = "center" | "hub" | "child";
export type PrototypeNodeFamily = "company" | "projects" | "financials" | "people";

export type PrototypeNode = {
  id: string;
  label: string;
  subtitle: string;
  description: string;
  status: string;
  metric: string;
  href: string | null;
  graphKind: GraphNodeKind;
  family: PrototypeNodeFamily;
  tier: PrototypeNodeTier;
  position: readonly [number, number, number];
  size: readonly [number, number, number];
  glow: string;
  surface: string;
};

export type PrototypeEdge = {
  id: string;
  from: string;
  to: string;
  label: string;
  dependency?: boolean;
  family: PrototypeNodeFamily;
};

export const PROTOTYPE_NODES: readonly PrototypeNode[] = [
  {
    id: "bos-platform",
    label: "B.O.S. Company",
    subtitle: "Central operating platform",
    description: "The command-center platform anchors the prototype and routes activity to every surrounding domain hub.",
    status: "Stable core",
    metric: "3 domain hubs",
    href: "/dashboard",
    graphKind: "company",
    family: "company",
    tier: "center",
    position: [0, 0.9, 0],
    size: [4.8, 1.25, 4.8],
    glow: "#6ee7ff",
    surface: "#0f3f52",
  },
  {
    id: "hub-projects",
    label: "Projects",
    subtitle: "Execution hub",
    description: "Prototype hub for active work orchestration, schedule visibility, and downstream delivery dependencies.",
    status: "High traffic",
    metric: "2 child nodes",
    href: "/projects",
    graphKind: "project",
    family: "projects",
    tier: "hub",
    position: [-8.5, 0.75, -4.5],
    size: [3, 0.85, 3],
    glow: "#60a5fa",
    surface: "#102c52",
  },
  {
    id: "hub-financials",
    label: "Financials",
    subtitle: "Revenue hub",
    description: "Prototype hub for payment flow, invoice movement, and finance-side relationship health.",
    status: "Watching bottlenecks",
    metric: "2 child nodes",
    href: "/invoices",
    graphKind: "invoice",
    family: "financials",
    tier: "hub",
    position: [8.5, 0.75, -4.5],
    size: [3, 0.85, 3],
    glow: "#f59e0b",
    surface: "#4a2a11",
  },
  {
    id: "hub-people",
    label: "People",
    subtitle: "Capacity hub",
    description: "Prototype hub for leadership, crews, and resource coordination feeding live project execution.",
    status: "Coordination risk",
    metric: "2 child nodes",
    href: "/team",
    graphKind: "crew",
    family: "people",
    tier: "hub",
    position: [0, 0.75, 9],
    size: [3, 0.85, 3],
    glow: "#34d399",
    surface: "#123d35",
  },
  {
    id: "projects-active-work",
    label: "Active Work",
    subtitle: "Project child node",
    description: "Static proof-of-concept node representing task-heavy execution activity inside the projects domain.",
    status: "On platform",
    metric: "Task flow",
    href: "/projects",
    graphKind: "task",
    family: "projects",
    tier: "child",
    position: [-12.5, 0.42, -8.2],
    size: [1.45, 0.45, 1.45],
    glow: "#93c5fd",
    surface: "#16386a",
  },
  {
    id: "projects-schedule-risk",
    label: "Schedule Risk",
    subtitle: "Project child node",
    description: "Prototype node standing in for dependency-sensitive schedule issues and blocked downstream work.",
    status: "Dependency path",
    metric: "2 blockers",
    href: "/schedule",
    graphKind: "phase",
    family: "projects",
    tier: "child",
    position: [-4.8, 0.42, -9.2],
    size: [1.45, 0.45, 1.45],
    glow: "#bfdbfe",
    surface: "#17365c",
  },
  {
    id: "financials-invoice-flow",
    label: "Invoice Flow",
    subtitle: "Financial child node",
    description: "Static finance node showing invoice movement and billing readiness for the prototype review.",
    status: "Pending review",
    metric: "4 approvals",
    href: "/invoices",
    graphKind: "invoice",
    family: "financials",
    tier: "child",
    position: [12.4, 0.42, -8.2],
    size: [1.45, 0.45, 1.45],
    glow: "#fcd34d",
    surface: "#5f3a15",
  },
  {
    id: "financials-cash-velocity",
    label: "Cash Velocity",
    subtitle: "Financial child node",
    description: "Prototype node representing billing timing and revenue pacing tied back to project delivery.",
    status: "Watching aging",
    metric: "14 day lag",
    href: "/change-orders",
    graphKind: "change_order",
    family: "financials",
    tier: "child",
    position: [4.8, 0.42, -9.2],
    size: [1.45, 0.45, 1.45],
    glow: "#fbbf24",
    surface: "#523114",
  },
  {
    id: "people-field-crews",
    label: "Field Crews",
    subtitle: "People child node",
    description: "Static crew coordination node used to prove staffing relationships and hover highlighting in 3D.",
    status: "Crew conflict",
    metric: "2 overlaps",
    href: "/crews",
    graphKind: "crew",
    family: "people",
    tier: "child",
    position: [-4.8, 0.42, 13.3],
    size: [1.45, 0.45, 1.45],
    glow: "#6ee7b7",
    surface: "#16473c",
  },
  {
    id: "people-leadership-signals",
    label: "Leadership",
    subtitle: "People child node",
    description: "Prototype node for leadership visibility, staffing signals, and executive line-of-sight into people risk.",
    status: "Decision lane",
    metric: "Exec ready",
    href: "/employees",
    graphKind: "customer",
    family: "people",
    tier: "child",
    position: [4.8, 0.42, 13.3],
    size: [1.45, 0.45, 1.45],
    glow: "#86efac",
    surface: "#14553d",
  },
] as const;

export const PROTOTYPE_EDGES: readonly PrototypeEdge[] = [
  { id: "edge-company-projects", from: "bos-platform", to: "hub-projects", label: "routes execution", family: "projects" },
  { id: "edge-company-financials", from: "bos-platform", to: "hub-financials", label: "routes revenue", family: "financials" },
  { id: "edge-company-people", from: "bos-platform", to: "hub-people", label: "routes capacity", family: "people" },
  { id: "edge-projects-active", from: "hub-projects", to: "projects-active-work", label: "activates", family: "projects" },
  { id: "edge-projects-risk", from: "hub-projects", to: "projects-schedule-risk", label: "monitors", family: "projects", dependency: true },
  { id: "edge-financials-invoices", from: "hub-financials", to: "financials-invoice-flow", label: "processes", family: "financials" },
  { id: "edge-financials-cash", from: "hub-financials", to: "financials-cash-velocity", label: "measures", family: "financials", dependency: true },
  { id: "edge-people-crews", from: "hub-people", to: "people-field-crews", label: "assigns", family: "people", dependency: true },
  { id: "edge-people-leadership", from: "hub-people", to: "people-leadership-signals", label: "briefs", family: "people" },
  { id: "edge-projects-financials", from: "hub-projects", to: "hub-financials", label: "handoff", family: "financials", dependency: true },
  { id: "edge-people-projects", from: "hub-people", to: "hub-projects", label: "staffs", family: "people", dependency: true },
] as const;

export function buildPrototypeGraphModel(): GraphModel {
  return {
    nodes: PROTOTYPE_NODES.map((node) => ({
      id: node.id,
      kind: node.graphKind,
      label: node.label,
      value: node.metric,
      href: node.href ?? undefined,
    })),
    edges: PROTOTYPE_EDGES.map((edge) => ({
      id: edge.id,
      from: edge.from,
      to: edge.to,
      label: edge.label,
      dependency: edge.dependency,
    })),
  };
}