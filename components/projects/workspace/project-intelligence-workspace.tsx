"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BrainCircuit, FileImage, FileText, RefreshCw, ScanSearch, ShieldCheck, Sparkles } from "lucide-react";
import { Button, EmptyState, ErrorState } from "@/components/ui";

type IntelligenceSource = {
  sourceType: "photo" | "attachment" | "blueprint";
  sourceId: string;
  sourceKey: string;
  label: string;
  mimeType: string | null;
  note: string | null;
  createdAt: string | null;
};

type IntelligenceAnalysis = {
  id: string;
  source_type: "project" | "photo" | "attachment" | "blueprint";
  source_id: string | null;
  source_key: string;
  source_label: string;
  source_mime_type: string | null;
  model: string | null;
  summary: string;
  observations: unknown;
  risks: unknown;
  recommendations: unknown;
  extracted_facts: unknown;
  confidence: number | string | null;
  analyzed_at: string;
};

type IntelligencePayload = {
  project: { id: string; name: string | null; project_number: string | null };
  counts: { sources: number; photos: number; attachments: number; blueprints: number; analyses: number };
  sources: IntelligenceSource[];
  analyses: IntelligenceAnalysis[];
  error?: string;
};

type ProjectIntelligenceWorkspaceProps = {
  projectId: string;
  projectName: string;
  localeTag: string;
};

export function ProjectIntelligenceWorkspace({ projectId, projectName, localeTag }: ProjectIntelligenceWorkspaceProps) {
  const [payload, setPayload] = useState<IntelligencePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const analysisBySource = useMemo(() => new Map((payload?.analyses ?? []).map((analysis) => [analysis.source_key, analysis])), [payload?.analyses]);
  const projectAnalysis = analysisBySource.get("project") || null;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/intelligence`, { cache: "no-store" });
      const result = await response.json() as IntelligencePayload;
      if (!response.ok) throw new Error(result.error || "Unable to load Orion Project Intelligence.");
      setPayload(result);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load Orion Project Intelligence.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void load(); }, [load]);

  const analyze = async (sourceType: "project" | "photo" | "attachment" | "blueprint", sourceId?: string) => {
    const key = sourceType === "project" ? "project" : `${sourceType}:${sourceId}`;
    setRunningKey(key);
    setNotice(null);
    setError(null);
    try {
      const response = await fetch(`/api/projects/${encodeURIComponent(projectId)}/intelligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, sourceId: sourceId || null }),
      });
      const result = await response.json() as { analysis?: IntelligenceAnalysis; error?: string };
      if (!response.ok || !result.analysis) throw new Error(result.error || "Orion could not analyze that source.");
      setNotice(sourceType === "project" ? "Project briefing refreshed." : "Project evidence analyzed and saved.");
      await load();
    } catch (analysisError) {
      setError(analysisError instanceof Error ? analysisError.message : "Orion could not analyze that source.");
    } finally {
      setRunningKey(null);
    }
  };

  if (loading && !payload) {
    return <div className="h-48 animate-pulse rounded-[18px] border border-[var(--bos-border-light)] bg-white" aria-label="Loading Orion Project Intelligence" />;
  }
  if (error && !payload) return <ErrorState title="Orion Project Intelligence unavailable" description={error} />;

  return (
    <section className="space-y-4" data-orion-role="project intelligence workspace">
      <div className="rounded-[18px] border border-[var(--bos-border-light)] bg-white p-5 shadow-[var(--bos-shadow-workspace-card)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-[var(--color-primary-50)] text-[var(--color-primary-700)]"><BrainCircuit size={20} aria-hidden="true" /></span>
            <div className="min-w-0">
              <p className="text-xl font-bold text-[var(--bos-text-strong-on-light)]">Orion Project Intelligence</p>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--bos-text-medium-on-light)]">Orion connects project records, photos, attachments, blueprints, RFIs, inspections, change orders, scope, schedule, and prior evidence into one project-aware intelligence layer for {projectName}.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}><RefreshCw size={14} aria-hidden="true" />Refresh</Button>
            <Button size="sm" data-orion-action="refresh-project-intelligence-briefing" data-orion-role="project intelligence action: build project briefing" onClick={() => void analyze("project")} disabled={runningKey !== null}>
              <Sparkles size={14} aria-hidden="true" />{runningKey === "project" ? "Building…" : projectAnalysis ? "Refresh Briefing" : "Build Briefing"}
            </Button>
          </div>
        </div>
        {notice ? <p className="mt-3 rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] px-3 py-2 text-sm font-medium text-[var(--bos-text-medium-on-light)]">{notice}</p> : null}
        {error ? <p className="mt-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p> : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Evidence sources" value={payload?.counts.sources ?? 0} />
        <Metric label="Photos" value={payload?.counts.photos ?? 0} />
        <Metric label="Attachments" value={payload?.counts.attachments ?? 0} />
        <Metric label="Blueprint revisions" value={payload?.counts.blueprints ?? 0} />
        <Metric label="Saved analyses" value={payload?.counts.analyses ?? 0} />
      </div>

      {projectAnalysis ? <AnalysisCard analysis={projectAnalysis} localeTag={localeTag} heading="Project briefing" icon={<Sparkles size={18} aria-hidden="true" />} /> : (
        <div className="rounded-[18px] border border-dashed border-[var(--bos-border-light-strong)] bg-white p-5">
          <div className="flex items-start gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-[var(--color-primary-700)]" size={19} /><div><p className="font-bold text-[var(--bos-text-strong-on-light)]">Evidence-first briefing</p><p className="mt-1 text-sm leading-6 text-[var(--bos-text-medium-on-light)]">Analyze project evidence first, then build the briefing. Orion preserves uncertainty and does not claim it created operational records unless an authorized B.O.S. action actually succeeds.</p></div></div>
        </div>
      )}

      <div className="rounded-[18px] border border-[var(--bos-border-light)] bg-white p-5 shadow-[var(--bos-shadow-workspace-card)]">
        <div className="flex items-center gap-3"><ScanSearch size={19} className="text-[var(--color-primary-700)]" aria-hidden="true" /><div><p className="text-lg font-bold text-[var(--bos-text-strong-on-light)]">Project evidence</p><p className="text-sm text-[var(--bos-text-medium-on-light)]">Photos and project images use vision; text-readable blueprint PDFs use extracted document text. Every result stays tied to its source.</p></div></div>
        {!payload?.sources.length ? <div className="mt-4"><EmptyState title="No project evidence yet" description="Add project photos, project attachments, or blueprints and Orion will surface them here." /></div> : (
          <div className="mt-4 grid gap-3">
            {payload.sources.map((source) => {
              const sourceAnalysis = analysisBySource.get(source.sourceKey) || null;
              const analyzing = runningKey === source.sourceKey;
              return (
                <article key={source.sourceKey} className="rounded-[16px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-4" data-orion-role={`project intelligence source: ${source.label}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 gap-3">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[var(--bos-border-light-strong)] bg-white text-[var(--bos-text-medium-on-light)]">{source.sourceType === "photo" ? <FileImage size={17} /> : <FileText size={17} />}</span>
                      <div className="min-w-0"><p className="break-words text-sm font-bold text-[var(--bos-text-strong-on-light)]">{source.label}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{source.sourceType} · {source.mimeType || "unknown type"}{sourceAnalysis ? " · analyzed" : " · not analyzed"}</p>{source.note ? <p className="mt-1 text-sm text-[var(--bos-text-medium-on-light)]">{source.note}</p> : null}</div>
                    </div>
                    <Button size="sm" variant={sourceAnalysis ? "outline" : "default"} data-orion-action={`analyze-${source.sourceKey}`} data-orion-role={`project intelligence action: analyze ${source.label}`} disabled={runningKey !== null} onClick={() => void analyze(source.sourceType, source.sourceId)}>{analyzing ? "Analyzing…" : sourceAnalysis ? "Reanalyze" : "Analyze"}</Button>
                  </div>
                  {sourceAnalysis ? <div className="mt-4"><AnalysisCard analysis={sourceAnalysis} localeTag={localeTag} compact heading="Orion findings" icon={<BrainCircuit size={16} aria-hidden="true" />} /></div> : null}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-[15px] border border-[var(--bos-border-light)] bg-white p-4 shadow-[var(--bos-shadow-workspace-card)]"><p className="text-2xl font-bold text-[var(--bos-text-strong-on-light)]">{value}</p><p className="mt-1 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{label}</p></div>;
}

function AnalysisCard({ analysis, localeTag, heading, icon, compact = false }: { analysis: IntelligenceAnalysis; localeTag: string; heading: string; icon: React.ReactNode; compact?: boolean }) {
  const observations = stringArray(analysis.observations);
  const risks = stringArray(analysis.risks);
  const recommendations = stringArray(analysis.recommendations);
  const confidence = Math.round(Math.max(0, Math.min(1, Number(analysis.confidence || 0))) * 100);
  return (
    <div className={compact ? "rounded-[14px] border border-[var(--bos-border-light)] bg-white p-4" : "rounded-[18px] border border-[var(--bos-border-light)] bg-white p-5 shadow-[var(--bos-shadow-workspace-card)]"} data-orion-role={`project intelligence analysis: ${analysis.source_label}`}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div className="flex items-center gap-2 font-bold text-[var(--bos-text-strong-on-light)]">{icon}{heading}</div><p className="text-xs font-semibold text-[var(--bos-text-medium-on-light)]">Confidence {confidence}% · {formatDate(analysis.analyzed_at, localeTag)}</p></div>
      <p className="mt-3 text-sm leading-6 text-[var(--bos-text-strong-on-light)]">{analysis.summary}</p>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <FindingList title="Observations" items={observations} empty="No evidence-backed observations." />
        <FindingList title="Risks to verify" items={risks} empty="No specific risks identified." warning />
        <FindingList title="Recommended next steps" items={recommendations} empty="No additional action recommended." />
      </div>
    </div>
  );
}

function FindingList({ title, items, empty, warning = false }: { title: string; items: string[]; empty: string; warning?: boolean }) {
  return <div className="rounded-[12px] border border-[var(--bos-border-light)] bg-[var(--color-neutral-50)] p-3"><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.06em] text-[var(--bos-text-medium-on-light)]">{warning ? <AlertTriangle size={14} aria-hidden="true" /> : null}{title}</p>{items.length ? <ul className="mt-2 space-y-2">{items.map((item, index) => <li key={`${title}-${index}`} className="text-sm leading-5 text-[var(--bos-text-strong-on-light)]">• {item}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--bos-text-medium-on-light)]">{empty}</p>}</div>;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function formatDate(value: string, localeTag: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";
  return new Intl.DateTimeFormat(localeTag, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}
