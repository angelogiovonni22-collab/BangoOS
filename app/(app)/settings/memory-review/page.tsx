"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, EmptyState, Input } from "@/components/ui";
import { useI18n } from "@/lib/i18n/provider";
import type {
  MemoryCategory,
  MemoryConfidence,
  MemoryImportance,
  MemoryRecord,
  MemoryScope,
  MemoryStatus,
} from "@/lib/bango-intelligence/memory/memory-types";

type VerificationFilter = "all" | "verified" | "unverified";

const CATEGORY_OPTIONS: MemoryCategory[] = [
  "preference",
  "decision",
  "recommendation",
  "outcome",
  "lesson_learned",
  "operational_pattern",
  "customer_preference",
  "vendor_preference",
  "crew_performance",
  "safety_observation",
  "financial_insight",
  "project_milestone",
  "document_summary",
];

const SCOPE_OPTIONS: MemoryScope[] = ["company", "project", "customer", "task", "phase", "user", "global"];
const CONFIDENCE_OPTIONS: MemoryConfidence[] = ["verified", "observed", "inferred", "draft"];
const IMPORTANCE_OPTIONS: MemoryImportance[] = ["critical", "high", "medium", "low"];

export default function MemoryReviewPage() {
  const { t } = useI18n();
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [projectIdFilter, setProjectIdFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");
  const [confidenceFilter, setConfidenceFilter] = useState<string>("all");
  const [importanceFilter, setImportanceFilter] = useState<string>("all");
  const [verificationFilter, setVerificationFilter] = useState<VerificationFilter>("all");
  const [editTitle, setEditTitle] = useState("");
  const [editSummary, setEditSummary] = useState("");
  const [editImportance, setEditImportance] = useState<MemoryImportance>("medium");
  const [editConfidence, setEditConfidence] = useState<MemoryConfidence>("observed");
  const [editTags, setEditTags] = useState("");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const selected = useMemo(() => records.find((record) => record.id === selectedId) ?? null, [records, selectedId]);

  const applyEditDraft = (record: MemoryRecord) => {
    setEditTitle(record.title);
    setEditSummary(record.summary);
    setEditImportance(record.importance);
    setEditConfidence(record.confidence);
    setEditTags(record.tags.join(", "));
  };

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);

    const params = new URLSearchParams();
    params.set("includeArchived", "false");
    params.set("limit", "200");

    if (projectIdFilter.trim()) {
      params.set("projectId", projectIdFilter.trim());
    }
    if (categoryFilter !== "all") {
      params.set("categories", categoryFilter);
    }
    if (scopeFilter !== "all") {
      params.set("scope", scopeFilter);
    }
    if (confidenceFilter !== "all") {
      params.set("confidence", confidenceFilter);
    }
    if (importanceFilter !== "all") {
      params.set("importance", importanceFilter);
    }
    if (verificationFilter !== "all") {
      params.set("verification", verificationFilter);
    }

    try {
      const response = await fetch(`/api/bango-intelligence/memories?${params.toString()}`);
      const payload = await response.json() as { ok: boolean; records?: MemoryRecord[]; error?: string };

      if (!payload.ok) {
        setErrorMessage(payload.error ?? t("projects.memoryReviewLoadError"));
        setRecords([]);
        setSelectedId(null);
        setIsLoading(false);
        return;
      }

      setRecords(payload.records ?? []);
      const nextSelected = payload.records?.[0]?.id ?? null;

      setSelectedId(nextSelected);
      if (nextSelected) {
        const nextRecord = (payload.records ?? []).find((record) => record.id === nextSelected);
        if (nextRecord) {
          applyEditDraft(nextRecord);
        }
      }

      setIsLoading(false);
    } catch {
      setErrorMessage(t("projects.memoryReviewLoadError"));
      setRecords([]);
      setSelectedId(null);
      setIsLoading(false);
    }
  }, [
    categoryFilter,
    confidenceFilter,
    importanceFilter,
    projectIdFilter,
    scopeFilter,
    t,
    verificationFilter,
  ]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadRecords();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadRecords]);

  const selectMemory = (record: MemoryRecord) => {
    setSelectedId(record.id);
    applyEditDraft(record);
  };

  const saveEdit = async () => {
    if (!selected) {
      return;
    }

    setSaveMessage(null);

    const response = await fetch(`/api/bango-intelligence/memories/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: editTitle.trim(),
        summary: editSummary.trim(),
        importance: editImportance,
        confidence: editConfidence,
        tags: editTags.split(",").map((tag) => tag.trim()).filter(Boolean),
      }),
    });

    const payload = await response.json() as { ok: boolean; memory?: MemoryRecord; error?: string };
    if (!payload.ok || !payload.memory) {
      setSaveMessage(payload.error ?? t("projects.memoryReviewSaveError"));
      return;
    }

    setRecords((previous) => previous.map((record) => (record.id === payload.memory!.id ? payload.memory! : record)));
    setSaveMessage(t("projects.memorySaved"));
  };

  const verifyMemory = async () => {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/bango-intelligence/memories/${selected.id}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "verified_in_memory_review" }),
    });
    const payload = await response.json() as { ok: boolean; memory?: MemoryRecord; error?: string };

    if (!payload.ok || !payload.memory) {
      setSaveMessage(payload.error ?? t("projects.memoryReviewVerifyError"));
      return;
    }

    setRecords((previous) => previous.map((record) => (record.id === payload.memory!.id ? payload.memory! : record)));
    setSaveMessage(t("projects.memoryReviewVerified"));
  };

  const archiveMemory = async () => {
    if (!selected) {
      return;
    }

    const response = await fetch(`/api/bango-intelligence/memories/${selected.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "archived_in_memory_review" }),
    });
    const payload = await response.json() as { ok: boolean; memory?: MemoryRecord; error?: string };

    if (!payload.ok) {
      setSaveMessage(payload.error ?? t("projects.memoryReviewArchiveError"));
      return;
    }

    setRecords((previous) => previous.filter((record) => record.id !== selected.id));
    setSelectedId(null);
    setSaveMessage(t("projects.memoryReviewArchived"));
  };

  return (
    <div className="space-y-6">
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/50">
          <CardTitle className="text-[1.15rem] font-bold text-[var(--color-navy-900)]">{t("projects.memoryReviewTitle")}</CardTitle>
          <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.memoryReviewDescription")}</p>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t("projects.memoryReviewVerificationNote")}
          </p>
          <Link href="/settings" className="text-xs font-semibold text-[var(--color-brand-700)] hover:underline">{t("projects.memoryReviewBackToSettings")}</Link>
        </CardHeader>
        <CardContent className="space-y-4 p-5">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input value={projectIdFilter} onChange={(event) => setProjectIdFilter(event.target.value)} placeholder={t("projects.memoryReviewProjectFilter")} aria-label={t("projects.memoryReviewProjectFilter")} />
            <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryCategory")}>
              <option value="all">{t("projects.memoryReviewAll")}</option>
              {CATEGORY_OPTIONS.map((category) => <option key={category} value={category}>{t(`projects.memoryCategory_${category}`)}</option>)}
            </select>
            <select value={scopeFilter} onChange={(event) => setScopeFilter(event.target.value)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryScope")}>
              <option value="all">{t("projects.memoryReviewAll")}</option>
              {SCOPE_OPTIONS.map((scope) => <option key={scope} value={scope}>{t(`projects.memoryScope${scope.charAt(0).toUpperCase()}${scope.slice(1)}`)}</option>)}
            </select>
            <select value={confidenceFilter} onChange={(event) => setConfidenceFilter(event.target.value)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryConfidence")}>
              <option value="all">{t("projects.memoryReviewAll")}</option>
              {CONFIDENCE_OPTIONS.map((confidence) => <option key={confidence} value={confidence}>{t(`projects.memoryConfidence${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}`)}</option>)}
            </select>
            <select value={importanceFilter} onChange={(event) => setImportanceFilter(event.target.value)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryImportance")}>
              <option value="all">{t("projects.memoryReviewAll")}</option>
              {IMPORTANCE_OPTIONS.map((importance) => <option key={importance} value={importance}>{t(`projects.memoryImportance${importance.charAt(0).toUpperCase()}${importance.slice(1)}`)}</option>)}
            </select>
            <select value={verificationFilter} onChange={(event) => setVerificationFilter(event.target.value as VerificationFilter)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryReviewVerificationFilter")}>
              <option value="all">{t("projects.memoryReviewAll")}</option>
              <option value="verified">{t("projects.memoryReviewVerifiedOnly")}</option>
              <option value="unverified">{t("projects.memoryReviewUnverifiedOnly")}</option>
            </select>
          </div>

          {errorMessage && <p className="text-sm text-[var(--color-danger-700)]">{errorMessage}</p>}

          {isLoading ? (
            <p className="text-sm text-[var(--color-text-secondary)]">{t("projects.memoryReviewLoading")}</p>
          ) : records.length === 0 ? (
            <EmptyState compact icon="M" title={t("projects.memoryReviewEmptyTitle")} description={t("projects.memoryReviewEmptyDescription")} />
          ) : (
            <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
              <div className="max-h-[620px] space-y-2 overflow-auto rounded-[12px] border border-[var(--color-border-subtle)] bg-white p-2">
                {records.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => selectMemory(record)}
                    className={`w-full rounded-[10px] border px-3 py-2 text-left ${record.id === selectedId ? "border-[var(--color-brand-400)] bg-[var(--color-primary-50)]" : "border-[var(--color-border-subtle)] bg-white"}`}
                  >
                    <p className="text-sm font-semibold text-[var(--color-navy-900)]">{record.title}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{record.category} · {record.scope}</p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">{record.confidence} · {record.importance}</p>
                  </button>
                ))}
              </div>

              {selected ? (
                <div className="space-y-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-white p-4">
                  <Input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label={t("projects.memoryTitle")} />
                  <textarea
                    value={editSummary}
                    onChange={(event) => setEditSummary(event.target.value)}
                    aria-label={t("projects.memorySummary")}
                    className="min-h-[100px] w-full rounded-[12px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm"
                  />

                  <div className="grid gap-3 sm:grid-cols-2">
                    <select value={editImportance} onChange={(event) => setEditImportance(event.target.value as MemoryImportance)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryImportance")}>
                      {IMPORTANCE_OPTIONS.map((importance) => <option key={importance} value={importance}>{t(`projects.memoryImportance${importance.charAt(0).toUpperCase()}${importance.slice(1)}`)}</option>)}
                    </select>

                    <select value={editConfidence} onChange={(event) => setEditConfidence(event.target.value as MemoryConfidence)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryConfidence")}>
                      {CONFIDENCE_OPTIONS.map((confidence) => <option key={confidence} value={confidence}>{t(`projects.memoryConfidence${confidence.charAt(0).toUpperCase()}${confidence.slice(1)}`)}</option>)}
                    </select>
                  </div>

                  <Input value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder={t("projects.memoryTags")} aria-label={t("projects.memoryTags")} />

                  <div className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
                    <p>{t("projects.memoryReviewMetaCreated", { value: selected.createdAt })}</p>
                    <p>{t("projects.memoryReviewMetaUpdated", { value: selected.updatedAt })}</p>
                    <p>{t("projects.memoryReviewMetaVerified", { value: selected.verifiedAt ?? t("projects.memoryReviewNotVerified") })}</p>
                    <p>{t("projects.memoryReviewMetaOutcome", { value: selected.recommendationStatus ?? t("projects.memoryReviewNotSet") })}</p>
                    <p>{t("projects.memoryReviewMetaStatus", { value: selected.status as MemoryStatus })}</p>
                  </div>

                  <div className="rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">{t("projects.memoryReviewSources")}</p>
                    {selected.sourceReferences.length === 0 ? (
                      <p className="text-xs text-[var(--color-text-secondary)]">{t("projects.memoryReviewNoSources")}</p>
                    ) : (
                      <ul className="mt-1 space-y-1 text-xs text-[var(--color-text-secondary)]">
                        {selected.sourceReferences.map((source) => (
                          <li key={source.id}>{source.label}{source.href ? ` (${source.href})` : ""}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button type="button" onClick={saveEdit}>{t("projects.memoryReviewSave")}</Button>
                    <Button type="button" variant="outline" onClick={verifyMemory}>{t("projects.memoryVerify")}</Button>
                    <Button type="button" variant="outline" onClick={archiveMemory}>{t("projects.memoryArchive")}</Button>
                  </div>

                  {saveMessage && <p className="text-xs text-[var(--color-text-secondary)]">{saveMessage}</p>}
                </div>
              ) : null}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
