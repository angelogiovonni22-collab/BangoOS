"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, EmptyState, EnterpriseTable, EnterpriseTableBody, EnterpriseTableCell, EnterpriseTableHead, EnterpriseTableHeading, EnterpriseTableRow, ErrorState, PageHeader, SkeletonLoader, TableContainer, getButtonClassName } from "@/components/ui";

type DeletedProject = { historyId: string; projectId: string; projectName: string; customerName: string; previousStatus: string; deletedAt: string };

export default function DeletedProjectsPage() {
  const [projects, setProjects] = useState<DeletedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError("");
      try {
        const response = await fetch("/api/projects/deleted", { cache: "no-store" });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error || "Unable to load deleted projects.");
        if (active) setProjects(body.projects || []);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load deleted projects.");
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, []);

  async function restoreProject(project: DeletedProject) {
    if (!window.confirm(`Restore ${project.projectName}? It will return to the Projects list with its previous status.`)) return;
    setBusyId(project.projectId);
    try {
      const response = await fetch(`/api/projects/${project.projectId}/lifecycle`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "restore" }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to restore project.");
      setProjects((current) => current.filter((item) => item.projectId !== project.projectId));
    } catch (caught) {
      window.alert(caught instanceof Error ? caught.message : "Unable to restore project.");
    } finally { setBusyId(null); }
  }

  return (
    <div className="container-content space-y-[var(--space-section)]">
      <PageHeader compact eyebrow="Projects" title="Previously Deleted" description="Review projects removed from the active list and restore them without losing their project history." primaryAction={<Link href="/projects" className={getButtonClassName({ variant: "outline" })}>Back to Projects</Link>} />
      <div className="flex flex-wrap items-center gap-2" aria-label="Project lifecycle views">
        <Link href="/projects" className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition hover:border-[var(--color-brand-500)] hover:bg-[var(--color-surface-hover)]">Projects</Link>
        <span aria-current="page" className="inline-flex min-h-9 items-center rounded-[var(--radius-md)] border border-[var(--color-brand-500)] bg-[var(--color-brand-600)] px-3 py-2 text-sm font-semibold text-white shadow-[var(--shadow-small)]">Previously Deleted</span>
      </div>
      {loading ? (
        <div className="space-y-3 rounded-[var(--radius-2xl)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4 shadow-[var(--shadow-card)] sm:p-5"><SkeletonLoader className="h-12 w-full" /><SkeletonLoader className="h-12 w-full" /><SkeletonLoader className="h-12 w-full" /></div>
      ) : error ? (
        <ErrorState title="Unable to load deleted projects" description={error} compact />
      ) : projects.length === 0 ? (
        <EmptyState icon="✓" title="No deleted projects" description="Projects you delete will appear here and can be restored later." compact action={<Link href="/projects" className={getButtonClassName({})}>Back to Projects</Link>} />
      ) : (
        <TableContainer title="Deleted Project History" description={`${projects.length} ${projects.length === 1 ? "project" : "projects"} available to restore`}>
          <EnterpriseTable ariaLabel="Previously deleted projects">
            <EnterpriseTableHead><tr><EnterpriseTableHeading>Project</EnterpriseTableHeading><EnterpriseTableHeading>Customer</EnterpriseTableHeading><EnterpriseTableHeading>Previous Status</EnterpriseTableHeading><EnterpriseTableHeading>Deleted</EnterpriseTableHeading><EnterpriseTableHeading align="right">Actions</EnterpriseTableHeading></tr></EnterpriseTableHead>
            <EnterpriseTableBody>{projects.map((project) => (
              <EnterpriseTableRow key={project.historyId}>
                <EnterpriseTableCell className="font-semibold">{project.projectName}</EnterpriseTableCell><EnterpriseTableCell>{project.customerName}</EnterpriseTableCell><EnterpriseTableCell>{formatStatus(project.previousStatus)}</EnterpriseTableCell><EnterpriseTableCell>{formatDeletedAt(project.deletedAt)}</EnterpriseTableCell>
                <EnterpriseTableCell align="right"><Button size="sm" variant="outline" disabled={busyId === project.projectId} onClick={() => void restoreProject(project)}><RotateCcw size={14} aria-hidden="true" />{busyId === project.projectId ? "Restoring…" : "Restore"}</Button></EnterpriseTableCell>
              </EnterpriseTableRow>
            ))}</EnterpriseTableBody>
          </EnterpriseTable>
        </TableContainer>
      )}
    </div>
  );
}

function formatDeletedAt(value: string) { const date = new Date(value); if (Number.isNaN(date.getTime())) return "-"; return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date); }
function formatStatus(value: string) { return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
