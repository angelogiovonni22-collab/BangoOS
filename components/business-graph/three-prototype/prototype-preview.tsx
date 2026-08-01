"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Cuboid, ScanSearch, Sparkles, Workflow } from "lucide-react";
import { BusinessGraphCanvas, BusinessGraphProvider, GraphLegend, useBusinessGraph } from "@/components/business-graph";
import { useMotionPreferences } from "@/components/motion";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, PageHeader } from "@/components/ui";
import { collectDependencyPath } from "../RelationshipEngine";
import { PROTOTYPE_GRAPH_MODEL, getPrototypeActiveNode, getPrototypeCameraView, getPrototypeConnections, getPrototypeStats, getPrototypeNode } from "./prototype-helpers";

const PrototypeScene = dynamic(
  () => import("./prototype-scene").then((module) => module.PrototypeScene),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[760px] items-center justify-center rounded-[28px] border border-cyan-500/20 bg-slate-950/90 text-sm font-medium text-slate-300">
        Loading 3D preview surface...
      </div>
    ),
  },
);

type ViewMode = "2d" | "3d";
type CameraMode = "overview" | "focus";

export function BusinessGraphPrototypePreview() {
  const { reducedMotion } = useMotionPreferences();
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>("bos-platform");
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [cameraMode, setCameraMode] = useState<CameraMode>("overview");

  const activeNode = useMemo(
    () => getPrototypeActiveNode(selectedNodeId, hoveredNodeId) || getPrototypeNode("bos-platform"),
    [hoveredNodeId, selectedNodeId],
  );
  const connections = useMemo(
    () => getPrototypeConnections(activeNode?.id ?? null),
    [activeNode?.id],
  );
  const dependencyPath = useMemo(
    () => collectDependencyPath(PROTOTYPE_GRAPH_MODEL, activeNode?.id ?? null),
    [activeNode?.id],
  );
  const stats = useMemo(() => getPrototypeStats(), []);
  const focusedView = useMemo(
    () => getPrototypeCameraView(selectedNodeId, cameraMode),
    [cameraMode, selectedNodeId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="B.O.S. Preview"
        title="Living Business Graph 3D Prototype"
        description="Static proof-of-concept only. The production 2D graph remains unchanged while this isolated surface proves scale, depth, lighting, and interaction quality before real data integration."
        compact
        secondaryActions={
          <div className="flex flex-wrap gap-2">
            <ModeButton
              active={viewMode === "2d"}
              onClick={() => {
                setViewMode("2d");
                setCameraMode("overview");
              }}
            >
              2D fallback
            </ModeButton>
            <ModeButton active={viewMode === "3d"} onClick={() => setViewMode("3d")}>3D prototype</ModeButton>
          </div>
        }
        primaryAction={
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setHoveredNodeId(null);
              setSelectedNodeId("bos-platform");
              setCameraMode("overview");
            }}
          >
            Reset preview
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="overflow-hidden rounded-[32px] border border-cyan-500/18 bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.22),_transparent_28%),linear-gradient(180deg,rgba(4,10,18,0.98)_0%,rgba(5,11,20,0.94)_100%)] shadow-[0_30px_80px_-34px_rgba(2,6,23,0.95)]">
          <div className="border-b border-white/8 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/80">Prototype surface</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Premium command-center preview</h2>
                <p className="mt-1 max-w-3xl text-sm text-slate-300">One central company platform, three raised domain hubs, six child nodes, luminous directional connections, and a substantial HTML inspector.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <PrototypeControlButton onClick={() => setCameraMode("overview")}>Fit view</PrototypeControlButton>
                <PrototypeControlButton
                  onClick={() => {
                    if (selectedNodeId) {
                      setCameraMode("focus");
                    }
                  }}
                  disabled={!selectedNodeId || viewMode !== "3d"}
                >
                  Focus camera
                </PrototypeControlButton>
                <PrototypeControlButton
                  onClick={() => {
                    setHoveredNodeId(null);
                    setSelectedNodeId("bos-platform");
                    setCameraMode("overview");
                  }}
                >
                  Reset
                </PrototypeControlButton>
              </div>
            </div>
          </div>

          <div className="min-h-[760px] p-4 sm:p-5">
            {viewMode === "3d" ? (
              <div className="h-full min-h-[760px] overflow-hidden rounded-[28px] border border-white/8 bg-[radial-gradient(circle_at_50%_0%,rgba(14,165,233,0.18),transparent_24%),linear-gradient(180deg,rgba(6,14,26,0.96)_0%,rgba(2,8,16,1)_100%)]">
                <PrototypeScene
                  selectedNodeId={selectedNodeId}
                  hoveredNodeId={hoveredNodeId}
                  cameraMode={cameraMode}
                  reducedMotion={reducedMotion}
                  onHoverNode={setHoveredNodeId}
                  onSelectNode={(nodeId) => {
                    setSelectedNodeId(nodeId);
                    setCameraMode("focus");
                  }}
                />
              </div>
            ) : (
              <PrototypeTwoDimensionalFallback
                selectedNodeId={selectedNodeId}
                onSelectedNodeChange={setSelectedNodeId}
                onHoveredNodeChange={setHoveredNodeId}
              />
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <Card as="section" variant="elevated" className="overflow-hidden border-slate-800 bg-slate-950 text-white shadow-[0_24px_64px_-36px_rgba(2,6,23,0.96)]">
            <CardHeader className="border-b border-white/8 bg-white/3">
              <CardTitle className="text-white">Relationship Inspector</CardTitle>
              <CardDescription className="text-slate-300">Static prototype inspector. No Supabase, no API calls, no graph business logic changes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5 p-5">
              <div className="rounded-[24px] border border-cyan-400/16 bg-[linear-gradient(180deg,rgba(8,18,32,0.96)_0%,rgba(5,11,20,1)_100%)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80">Active node</p>
                    <h3 className="mt-1 text-xl font-semibold text-white">{activeNode?.label}</h3>
                    <p className="mt-1 text-sm text-slate-300">{activeNode?.subtitle}</p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/6 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-200">{viewMode.toUpperCase()}</span>
                </div>

                <p className="mt-4 text-sm leading-6 text-slate-300">{activeNode?.description}</p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <SignalRow label="Status" value={activeNode?.status || "Preview only"} />
                  <SignalRow label="Signal" value={activeNode?.metric || "Static"} />
                  <SignalRow label="Highlighted nodes" value={String(dependencyPath.nodeIds.size)} />
                  <SignalRow label="Relationship lines" value={String(connections.length)} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <MetricTile icon={<Workflow size={16} />} label="Nodes" value={String(stats.totalNodes)} hint="1 platform, 3 hubs, 6 children" />
                <MetricTile icon={<Cuboid size={16} />} label="Directional paths" value={String(stats.directionalEdges)} hint="Luminous prototype links" />
                <MetricTile icon={<ScanSearch size={16} />} label="Camera" value={cameraMode === "focus" ? "Focused" : "Overview"} hint={viewMode === "3d" ? `${focusedView.position.join(" / ")}` : "2D fallback active"} />
                <MetricTile icon={<Sparkles size={16} />} label="Motion" value={reducedMotion ? "Reduced" : "Full"} hint="Orbit and transitions adapt" />
              </div>

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Connected relationships</p>
                <div className="mt-3 space-y-2">
                  {connections.map((connection) => (
                    <button
                      key={connection.edge.id}
                      type="button"
                      onClick={() => {
                        setSelectedNodeId(connection.node.id);
                        setCameraMode(viewMode === "3d" ? "focus" : "overview");
                      }}
                      className="flex w-full items-start justify-between gap-3 rounded-[18px] border border-white/8 bg-white/4 px-3 py-3 text-left transition hover:border-cyan-400/30 hover:bg-white/6"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-white">{connection.node.label}</span>
                        <span className="mt-0.5 block text-xs text-slate-300">
                          {connection.direction === "outgoing" ? "Outgoing" : "Incoming"} - {connection.edge.label}
                        </span>
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${connection.edge.dependency ? "bg-amber-400/18 text-amber-200" : "bg-cyan-400/12 text-cyan-200"}`}>
                        {connection.edge.dependency ? "Dependency" : "Linked"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[18px] border border-white/8 bg-white/3 p-4 text-sm text-slate-300">
                <p className="font-semibold text-white">Prototype controls</p>
                <ul className="mt-2 space-y-1.5">
                  <li>Orbit, pan, and zoom work directly on the 3D canvas.</li>
                  <li>Hover emphasizes nearby nodes and glowing relationship paths.</li>
                  <li>Clicking a node updates this inspector and focuses the camera.</li>
                  <li>The 2D fallback stays available for comparison and safety.</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function PrototypeTwoDimensionalFallback({
  selectedNodeId,
  onSelectedNodeChange,
  onHoveredNodeChange,
}: {
  selectedNodeId: string | null;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onHoveredNodeChange: (nodeId: string | null) => void;
}) {
  return (
    <BusinessGraphProvider graph={PROTOTYPE_GRAPH_MODEL}>
      <div className="space-y-4 rounded-[28px] border border-[var(--color-border-subtle)] bg-white/95 p-4 shadow-[0_16px_38px_-24px_rgba(15,23,42,0.45)]">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[20px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]/90 px-4 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--color-text-muted)]">Fallback comparison</p>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Existing 2D graph surface with static prototype data</p>
          </div>
          <span className="rounded-full border border-[var(--color-border-subtle)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-secondary)]">Production-safe fallback</span>
        </div>
        <GraphLegend />
        <BusinessGraphCanvas />
        <GraphSelectionBridge
          selectedNodeId={selectedNodeId}
          onSelectedNodeChange={onSelectedNodeChange}
          onHoveredNodeChange={onHoveredNodeChange}
        />
      </div>
    </BusinessGraphProvider>
  );
}

function GraphSelectionBridge({
  selectedNodeId,
  onSelectedNodeChange,
  onHoveredNodeChange,
}: {
  selectedNodeId: string | null;
  onSelectedNodeChange: (nodeId: string | null) => void;
  onHoveredNodeChange: (nodeId: string | null) => void;
}) {
  const { graph, hoveredNodeId, selectedNode, setSelectedNodeId } = useBusinessGraph();

  useEffect(() => {
    onSelectedNodeChange(selectedNode?.id ?? null);
  }, [onSelectedNodeChange, selectedNode]);

  useEffect(() => {
    onHoveredNodeChange(hoveredNodeId);
  }, [hoveredNodeId, onHoveredNodeChange]);

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    const existing = graph.nodes.find((node) => node.id === selectedNodeId);

    if (existing && selectedNode?.id !== selectedNodeId) {
      setSelectedNodeId(selectedNodeId);
    }
  }, [graph.nodes, selectedNode?.id, selectedNodeId, setSelectedNodeId]);

  return null;
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-[var(--color-brand-700)] text-white shadow-[0_12px_28px_-16px_rgba(37,99,235,0.72)]"
          : "border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:border-[var(--color-brand-300)] hover:text-[var(--color-text-primary)]",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function PrototypeControlButton({ children, onClick, disabled = false }: { children: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-white/10 bg-white/6 px-3.5 py-2 text-sm font-semibold text-white transition hover:border-cyan-400/28 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-45"
    >
      {children}
    </button>
  );
}

function SignalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-white/8 bg-white/4 px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function MetricTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-white/4 p-3">
      <div className="flex items-center gap-2 text-cyan-200">
        {icon}
        <p className="text-sm font-semibold text-white">{label}</p>
      </div>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs text-slate-300">{hint}</p>
    </div>
  );
}