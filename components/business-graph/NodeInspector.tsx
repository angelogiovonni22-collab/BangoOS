"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { SlidePanel } from "@/components/motion";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { useBusinessGraph } from "./BusinessGraphProvider";
import { collectDependencyPath, collectNodeConnections } from "./RelationshipEngine";

type NodeInspectorProps = {
  title?: string;
};

export function NodeInspector({ title = "Node Inspector" }: NodeInspectorProps) {
  const router = useRouter();
  const { graph, selectedNode, selectedNodeId, setSelectedNodeId } = useBusinessGraph();
  const open = Boolean(selectedNode);
  const connections = useMemo(
    () => collectNodeConnections(graph, selectedNodeId),
    [graph, selectedNodeId],
  );
  const dependencyPath = useMemo(
    () => collectDependencyPath(graph, selectedNodeId),
    [graph, selectedNodeId],
  );

  return (
    <SlidePanel
      open={open}
      from="right"
      trapFocus
      onEscape={() => setSelectedNodeId(null)}
      className="fixed right-4 top-20 z-[55] w-[340px]"
    >
      <Card as="section" variant="elevated" className="shadow-[var(--shadow-large)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/70">
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          {selectedNode ? (
            <>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Type</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedNode.kind.replaceAll("_", " ")}</p>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Label</p>
                <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">{selectedNode.label}</p>
              </div>

              {selectedNode.value ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Signal</p>
                  <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">{selectedNode.value}</p>
                </div>
              ) : null}

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Dependency path</p>
                <p className="mt-1 text-sm font-medium text-[var(--color-text-secondary)]">
                  {dependencyPath.nodeIds.size} nodes, {dependencyPath.edgeIds.size} relationships highlighted
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">Connected relationships</p>
                  <span className="text-[11px] font-medium text-[var(--color-text-muted)]">Read-only</span>
                </div>

                {connections.length > 0 ? (
                  <div className="mt-2 space-y-2">
                    {connections.map((connection) => (
                      <button
                        key={connection.edgeId}
                        type="button"
                        className="flex w-full items-start justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-left"
                        onClick={() => setSelectedNodeId(connection.nodeId)}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-[var(--color-text-primary)]">{connection.nodeLabel}</span>
                          <span className="mt-0.5 block text-xs text-[var(--color-text-secondary)]">
                            {connection.direction === "outgoing" ? "Outgoing" : "Incoming"}
                            {connection.edgeLabel ? ` - ${connection.edgeLabel}` : ""}
                          </span>
                        </span>
                        <span
                          className={[
                            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                            connection.dependency
                              ? "bg-[var(--color-warning-50)] text-[var(--color-warning-700)]"
                              : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]",
                          ].join(" ")}
                        >
                          {connection.nodeKind.replaceAll("_", " ")}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    No connected relationships are available for this node.
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedNodeId(null)}
                >
                  Close
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={!selectedNode.href}
                  onClick={() => {
                    if (selectedNode.href) {
                      router.push(selectedNode.href);
                    }
                  }}
                >
                  Open detail
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>
    </SlidePanel>
  );
}
