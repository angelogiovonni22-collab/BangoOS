"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Building2, FileStack, Layers3, Ruler, ScanLine } from "lucide-react";
import { Button, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";

type BlueprintProject = {
  id: string;
  name: string | null;
  project_number: string | null;
  status: string | null;
  city: string | null;
  state: string | null;
};

export default function BlueprintsPage() {
  const supabase = useMemo(() => createClient(), []);
  const [projects, setProjects] = useState<BlueprintProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscribed = true;

    const loadProjects = async () => {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!supabase || !workspace.context) {
        if (subscribed) {
          setError(workspace.errorMessage || "Unable to load the blueprint plan room.");
          setLoading(false);
        }
        return;
      }

      const response = await supabase
        .from("projects")
        .select("id, name, project_number, status, city, state")
        .eq("company_id", workspace.context.companyId)
        .order("updated_at", { ascending: false })
        .limit(100);

      if (!subscribed) return;

      if (response.error) {
        setError("BOS could not load project blueprint workspaces. Please try again.");
      } else {
        setProjects((response.data ?? []) as BlueprintProject[]);
      }

      setLoading(false);
    };

    void loadProjects();
    return () => { subscribed = false; };
  }, [supabase]);

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Project Intelligence"
        title="Blueprints"
        description="Open a project's plan room to manage drawing sheets, revisions, field markups, and future 2D/3D plan intelligence."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Blueprint capabilities roadmap">
        <Capability icon={<FileStack size={18} />} title="Plan Room" detail="Sheets and revision history" tone="blue" />
        <Capability icon={<ScanLine size={18} />} title="Field Markup" detail="Redlines, pins, and media" tone="amber" />
        <Capability icon={<Ruler size={18} />} title="Measurements" detail="Calibrated takeoffs and scale" tone="green" />
        <Capability icon={<Layers3 size={18} />} title="2D / 3D Layers" detail="Trades, models, and systems" tone="purple" />
      </section>

      <section className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Project plan rooms</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Blueprints remain project-scoped so revisions, field records, and permissions stay attached to the correct job.</p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]" role="status">Loading project plan rooms…</div>
        ) : error ? (
          <ErrorState title="Blueprints unavailable" description={error} />
        ) : projects.length === 0 ? (
          <EmptyState icon="B" title="No project plan rooms yet" description="Create a project first, then open its Blueprints tab to begin a plan set." />
        ) : (
          <div className="divide-y divide-[var(--color-border-subtle)]">
            {projects.map((project) => {
              const location = [project.city, project.state].filter(Boolean).join(", ");
              return (
                <article key={project.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-blue-50 text-blue-700"><Building2 size={18} aria-hidden="true" /></span>
                    <div className="min-w-0">
                      <h3 className="truncate font-semibold text-[var(--color-text-primary)]">{project.name || "Untitled project"}</h3>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                        {[project.project_number, location, formatStatus(project.status)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                  <Link href={`/projects/${project.id}?tab=blueprints`} className="inline-flex">
                    <Button size="sm" variant="outline">Open plan room <ArrowRight size={15} aria-hidden="true" /></Button>
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Capability({ icon, title, detail, tone }: { icon: React.ReactNode; title: string; detail: string; tone: "blue" | "amber" | "green" | "purple" }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <div className="rounded-[var(--radius-card)] border border-[var(--color-border-subtle)] bg-white p-4 shadow-[var(--shadow-small)]">
      <span className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] ${tones[tone]}`}>{icon}</span>
      <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{detail}</p>
    </div>
  );
}

function formatStatus(status: string | null) {
  if (!status) return null;
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
