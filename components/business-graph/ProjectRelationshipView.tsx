"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { BusinessGraphProvider } from "./BusinessGraphProvider";
import { BusinessGraphCanvas } from "./BusinessGraphCanvas";
import { GraphLegend } from "./GraphLegend";
import { NodeInspector } from "./NodeInspector";
import {
  RelationshipEngineFromProject,
  type ProjectRelationshipInput,
} from "./RelationshipEngine";

type ProjectRelationshipViewProps = {
  companyName: string;
  input: ProjectRelationshipInput;
};

export function ProjectRelationshipView({ companyName, input }: ProjectRelationshipViewProps) {
  const graph = RelationshipEngineFromProject(input, companyName);

  return (
    <BusinessGraphProvider graph={graph}>
      <Card as="section" variant="elevated" className="overflow-hidden">
        <CardHeader className="bg-[var(--color-surface-subtle)]/70">
          <CardTitle>Project Relationship View</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <GraphLegend />
          <BusinessGraphCanvas className="bf-depth-surface" />
          <NodeInspector title="Project Node Inspector" />
        </CardContent>
      </Card>
    </BusinessGraphProvider>
  );
}
