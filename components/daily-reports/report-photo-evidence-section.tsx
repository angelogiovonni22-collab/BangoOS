"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { resolveWorkspaceContext } from "@/lib/supabase/workspace";
import { loadReportPhotoEvidence, type ReportPhotoClient, type ReportPhotoEvidence } from "@/lib/daily-reports/report-photo-evidence";
import type { AttachmentItem } from "@/lib/daily-reports";

export function ReportPhotoEvidenceSection({ projectId, attachments, title }: { projectId: string; attachments: AttachmentItem[]; title: string }) {
  const [reload, setReload] = useState(0);
  const [read, setRead] = useState<{ key: string; items: ReportPhotoEvidence[]; error: string | null } | null>(null);
  const key = JSON.stringify([projectId, attachments, reload]);
  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const client = createClient();
        const workspace = await resolveWorkspaceContext(client);
        if (!client || !workspace.context) throw new Error("Sign in to view report photos.");
        const items = await loadReportPhotoEvidence(client as unknown as ReportPhotoClient, workspace.context.companyId, projectId, attachments);
        if (active) setRead({ key, items, error: null });
      } catch (error) {
        if (active) setRead({ key, items: [], error: error instanceof Error ? error.message : "Unable to load report photos." });
      }
    };
    if (attachments.length) void load();
    return () => { active = false; };
  }, [projectId, attachments, key]);
  const current = read?.key === key ? read : null;
  return <Card as="section">
    <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {!attachments.length ? <p className="text-sm text-[var(--color-text-secondary)]">No report photos attached.</p> : <>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => setReload(value => value + 1)}>Refresh photos</Button>
          <a className="text-sm underline" href={`/projects/${projectId}?tab=photos`}>View project photos</a>
        </div>
        {!current ? <p role="status" className="text-sm text-[var(--color-text-secondary)]">Loading report photos…</p> : null}
        {current?.error ? <p role="alert" className="text-sm text-[var(--color-text-primary)]">{current.error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {current?.items.map(item => <PhotoEvidence key={`${item.attachment.id}:${item.url}`} item={item} />)}
        </div>
      </>}
    </CardContent>
  </Card>;
}
function PhotoEvidence({ item }: { item: ReportPhotoEvidence }) {
  const [failed, setFailed] = useState(false);
  return <article className="space-y-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3">
    <p className="break-words text-sm font-semibold text-[var(--color-text-primary)]">{item.attachment.fileName}</p>
    {item.attachment.caption ? <p className="text-sm text-[var(--color-text-secondary)]">{item.attachment.caption}</p> : null}
    {item.url && item.isImage && !failed ? (
      // eslint-disable-next-line @next/next/no-img-element -- Private short-lived signed images must not use a shared image optimizer.
      <img src={item.url} alt={item.attachment.caption || item.attachment.fileName} loading="lazy" className="max-h-72 w-full rounded-[var(--radius-md)] object-contain" onError={() => setFailed(true)} />
    ) : null}
    {item.message || failed ? <p role="status" className="text-sm text-[var(--color-text-secondary)]">{item.message || "Preview is unavailable. Refresh photos or open the original."}</p> : null}
    {item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" className="inline-block text-sm underline">Open original photo</a> : null}
  </article>;
}
