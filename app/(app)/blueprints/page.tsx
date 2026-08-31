"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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

type BlueprintWorkspaceMode = "plan-room" | "field-markup" | "measurements" | "layers";

type WorkspaceOption = {
  id: BlueprintWorkspaceMode;
  title: string;
  detail: string;
  actionLabel: string;
  tone: "blue" | "amber" | "green" | "purple";
  icon: React.ReactNode;
};

const workspaceOptions: WorkspaceOption[] = [
  { id: "plan-room", title: "Plan Room", detail: "Sheets and revision history", actionLabel: "Open plan room", tone: "blue", icon: <FileStack size={18} /> },
  { id: "field-markup", title: "Field Markup", detail: "Redlines, pins, and media", actionLabel: "Open field markup", tone: "amber", icon: <ScanLine size={18} /> },
  { id: "measurements", title: "Measurements", detail: "Calibrated takeoffs and scale", actionLabel: "Open measurements", tone: "green", icon: <Ruler size={18} /> },
  { id: "layers", title: "2D / 3D Layers", detail: "Trades, models, and systems", actionLabel: "Open layers / model", tone: "purple", icon: <Layers3 size={18} /> },
];

export default function BlueprintsPage() {
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<BlueprintProject[]>([]);
  const [latestVersionByProject, setLatestVersionByProject] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeWorkspace = resolveWorkspaceMode(searchParams.get("workspace"));

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
        setLoading(false);
        return;
      }

      const projectRows = (response.data ?? []) as BlueprintProject[];
      setProjects(projectRows);

      if (projectRows.length) {
        const versionResponse = await supabase
          .from("blueprint_versions")
          .select("id, project_id, created_at")
          .eq("company_id", workspace.context.companyId)
          .in("project_id", projectRows.map((project) => project.id))
          .order("created_at", { ascending: false });

        if (subscribed && !versionResponse.error) {
          const nextLatestVersionByProject: Record<string, string> = {};
          for (const version of versionResponse.data ?? []) {
            const projectId = typeof version.project_id === "string" ? version.project_id : null;
            const versionId = typeof version.id === "string" ? version.id : null;
            if (projectId && versionId && !nextLatestVersionByProject[projectId]) {
              nextLatestVersionByProject[projectId] = versionId;
            }
          }
          setLatestVersionByProject(nextLatestVersionByProject);
        }
      }

      if (subscribed) setLoading(false);
    };

    void loadProjects();
    return () => { subscribed = false; };
  }, [supabase]);

  const selectWorkspace = (workspace: BlueprintWorkspaceMode) => {
    const nextParams = new URLSearchParams(searchParams.toString());
    if (workspace === "plan-room") nextParams.delete("workspace");
    else nextParams.set("workspace", workspace);
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `${pathname}?${nextQuery}` : pathname, { scroll: false });
  };

  const activeWorkspaceOption = workspaceOptions.find((option) => option.id === activeWorkspace) ?? workspaceOptions[0];

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Project Intelligence"
        title="Blueprints"
        description="Open a project's plan room to manage drawing sheets, revisions, field markups, calibrated takeoffs, and 2D/3D plan intelligence."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Blueprint workspaces">
        {workspaceOptions.map((option) => (
          <Capability
            key={option.id}
            icon={option.icon}
            title={option.title}
            detail={option.detail}
            tone={option.tone}
            active={activeWorkspace === option.id}
            onClick={() => selectWorkspace(option.id)}
          />
        ))}
      </section>

      <section className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Project plan rooms</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {activeWorkspace === "plan-room"
              ? "Blueprints remain project-scoped so revisions, field records, and permissions stay attached to the correct job."
              : `${activeWorkspaceOption.title} selected. Choose a project below to open that project’s existing Blueprint workspace with its current plans, permissions, markups, takeoffs, and layers.`}
          </p>
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
              const latestVersionId = latestVersionByProject[project.id];
              const directPlanRoomHref = `/projects/${project.id}?tab=blueprints`;
              const workspaceHref = latestVersionId
                ? `/projects/${project.id}?tab=blueprints&blueprintVersion=${encodeURIComponent(latestVersionId)}`
                : directPlanRoomHref;

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
                  <div className="flex flex-wrap items-center gap-2">
                    {activeWorkspace !== "plan-room" ? (
                      <Link href={workspaceHref} className="inline-flex">
                        <Button size="sm">{activeWorkspaceOption.actionLabel} <ArrowRight size={15} aria-hidden="true" /></Button>
                      </Link>
                    ) : null}
                    <Link href={directPlanRoomHref} className="inline-flex">
                      <Button size="sm" variant="outline">Open plan room <ArrowRight size={15} aria-hidden="true" /></Button>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function Capability({ icon, title, detail, tone, active, onClick }: { icon: React.ReactNode; title: string; detail: string; tone: "blue" | "amber" | "green" | "purple"; active: boolean; onClick: () => void }) {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    green: "bg-emerald-50 text-emerald-700",
    purple: "bg-purple-50 text-purple-700",
  };

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`group w-full rounded-[var(--radius-card)] border bg-white p-4 text-left shadow-[var(--shadow-small)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${active ? "border-blue-500 ring-2 ring-blue-500/20" : "border-[var(--color-border-subtle)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-md"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] ${tones[tone]}`}>{icon}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${active ? "bg-blue-600 text-white" : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] opacity-0 transition group-hover:opacity-100"}`}>
          {active ? "Active" : "Select"}
        </span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{detail}</p>
    </button>
  );
}

function resolveWorkspaceMode(value: string | null): BlueprintWorkspaceMode {
  return workspaceOptions.some((option) => option.id === value) ? value as BlueprintWorkspaceMode : "plan-room";
}

function formatStatus(status: string | null) {
  if (!status) return null;
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
