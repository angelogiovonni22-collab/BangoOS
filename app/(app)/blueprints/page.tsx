"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ArrowRight, Building2, FileStack, Layers3, Ruler, ScanLine } from "lucide-react";
import { Button, EmptyState, ErrorState, PageHeader } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
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

const WORKSPACE_MODES: BlueprintWorkspaceMode[] = ["plan-room", "field-markup", "measurements", "layers"];

export default function BlueprintsPage() {
  const { t } = useI18n();
  const supabase = useMemo(() => createClient(), []);
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [projects, setProjects] = useState<BlueprintProject[]>([]);
  const [latestVersionByProject, setLatestVersionByProject] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const activeWorkspace = resolveWorkspaceMode(searchParams.get("workspace"));
  const workspaceOptions = useMemo<WorkspaceOption[]>(() => [
    { id: "plan-room", title: t("blueprints.planRoom"), detail: t("blueprints.planRoomDetail"), actionLabel: t("blueprints.openPlanRoom"), tone: "blue", icon: <FileStack size={18} /> },
    { id: "field-markup", title: t("blueprints.fieldMarkup"), detail: t("blueprints.fieldMarkupDetail"), actionLabel: t("blueprints.openFieldMarkup"), tone: "amber", icon: <ScanLine size={18} /> },
    { id: "measurements", title: t("blueprints.measurements"), detail: t("blueprints.measurementsDetail"), actionLabel: t("blueprints.openMeasurements"), tone: "green", icon: <Ruler size={18} /> },
    { id: "layers", title: t("blueprints.layers"), detail: t("blueprints.layersDetail"), actionLabel: t("blueprints.openLayers"), tone: "purple", icon: <Layers3 size={18} /> },
  ], [t]);

  useEffect(() => {
    let subscribed = true;

    const loadProjects = async () => {
      const workspace = await resolveWorkspaceContext(supabase);

      if (!supabase || !workspace.context) {
        if (subscribed) {
          setError(workspace.errorMessage || t("blueprints.loadError"));
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
        setError(t("blueprints.loadProjectsError"));
        setLoading(false);
        return;
      }

      const projectRows = (response.data ?? []) as BlueprintProject[];
      setProjects(projectRows);

      if (projectRows.length) {
        const db = supabase as unknown as { from: (table: string) => ReturnType<SupabaseClient["from"]> };
        const versionResponse = await db
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
            if (projectId && versionId && !nextLatestVersionByProject[projectId]) nextLatestVersionByProject[projectId] = versionId;
          }
          setLatestVersionByProject(nextLatestVersionByProject);
        }
      }

      if (subscribed) setLoading(false);
    };

    void loadProjects();
    return () => { subscribed = false; };
  }, [supabase, t]);

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
      <PageHeader eyebrow={t("blueprints.eyebrow")} title={t("blueprints.title")} description={t("blueprints.description")} />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label={t("blueprints.workspacesAria")}>
        {workspaceOptions.map((option) => (
          <Capability key={option.id} icon={option.icon} title={option.title} detail={option.detail} tone={option.tone} active={activeWorkspace === option.id} activeLabel={t("blueprints.active")} selectLabel={t("blueprints.select")} onClick={() => selectWorkspace(option.id)} />
        ))}
      </section>

      <section className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-white shadow-[var(--shadow-small)]">
        <div className="border-b border-[var(--color-border-subtle)] px-5 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{t("blueprints.projectPlanRooms")}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {activeWorkspace === "plan-room"
              ? t("blueprints.projectPlanRoomsDescription")
              : t("blueprints.workspaceSelected", { workspace: activeWorkspaceOption.title })}
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-[var(--color-text-secondary)]" role="status">{t("blueprints.loading")}</div>
        ) : error ? (
          <ErrorState title={t("blueprints.unavailable")} description={error} />
        ) : projects.length === 0 ? (
          <EmptyState icon="B" title={t("blueprints.noPlanRooms")} description={t("blueprints.noPlanRoomsDescription")} />
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
                      <h3 className="truncate font-semibold text-[var(--color-text-primary)]">{project.name || t("blueprints.untitledProject")}</h3>
                      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{[project.project_number, location, formatStatus(project.status)].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {activeWorkspace !== "plan-room" ? <Link href={workspaceHref} className="inline-flex"><Button size="sm">{activeWorkspaceOption.actionLabel} <ArrowRight size={15} aria-hidden="true" /></Button></Link> : null}
                    <Link href={directPlanRoomHref} className="inline-flex"><Button size="sm" variant="outline">{t("blueprints.openPlanRoom")} <ArrowRight size={15} aria-hidden="true" /></Button></Link>
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

function Capability({ icon, title, detail, tone, active, activeLabel, selectLabel, onClick }: { icon: React.ReactNode; title: string; detail: string; tone: "blue" | "amber" | "green" | "purple"; active: boolean; activeLabel: string; selectLabel: string; onClick: () => void }) {
  const tones = { blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", green: "bg-emerald-50 text-emerald-700", purple: "bg-purple-50 text-purple-700" };
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`group w-full rounded-[var(--radius-card)] border bg-white p-4 text-left shadow-[var(--shadow-small)] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${active ? "border-blue-500 ring-2 ring-blue-500/20" : "border-[var(--color-border-subtle)] hover:-translate-y-0.5 hover:border-[var(--color-border-strong)] hover:shadow-md"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-[var(--radius-lg)] ${tones[tone]}`}>{icon}</span>
        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${active ? "bg-blue-600 text-white" : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)] opacity-0 transition group-hover:opacity-100"}`}>{active ? activeLabel : selectLabel}</span>
      </div>
      <p className="mt-3 text-sm font-semibold text-[var(--color-text-primary)]">{title}</p>
      <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{detail}</p>
    </button>
  );
}

function resolveWorkspaceMode(value: string | null): BlueprintWorkspaceMode {
  return WORKSPACE_MODES.includes(value as BlueprintWorkspaceMode) ? value as BlueprintWorkspaceMode : "plan-room";
}

function formatStatus(status: string | null) {
  if (!status) return null;
  return status.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());
}
