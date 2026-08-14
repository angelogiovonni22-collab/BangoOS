"use client";

import { useMemo, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";
import type { MemoryCategory, MemoryConfidence, MemoryImportance, MemoryScope } from "@/lib/bango-intelligence/memory/memory-types";

type Translate = (key: string, params?: Record<string, string | number>) => string;

type TaskSummary = {
  id: string;
  title: string;
  phase_id: string | null;
};

type Props = {
  projectId: string;
  projectName: string;
  projectStatus: string;
  customerId: string | null;
  tasks: TaskSummary[];
  phaseNameById: Record<string, string>;
  t: Translate;
};

type SaveState = "idle" | "saving" | "saved" | "duplicate" | "error";

const MANUAL_CATEGORIES: MemoryCategory[] = [
  "preference",
  "decision",
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

const CLOSEOUT_FIELDS: Array<{ key: keyof CloseoutDraft; category: MemoryCategory; labelKey: string }> = [
  { key: "whatWorked", category: "operational_pattern", labelKey: "projects.memoryCloseoutWhatWorked" },
  { key: "whatDidNotWork", category: "lesson_learned", labelKey: "projects.memoryCloseoutWhatDidNotWork" },
  { key: "scheduleLesson", category: "lesson_learned", labelKey: "projects.memoryCloseoutScheduleLesson" },
  { key: "budgetLesson", category: "lesson_learned", labelKey: "projects.memoryCloseoutBudgetLesson" },
  { key: "crewLesson", category: "crew_performance", labelKey: "projects.memoryCloseoutCrewLesson" },
  { key: "vendorLesson", category: "vendor_preference", labelKey: "projects.memoryCloseoutVendorLesson" },
  { key: "customerLesson", category: "customer_preference", labelKey: "projects.memoryCloseoutCustomerLesson" },
  { key: "safetyLesson", category: "safety_observation", labelKey: "projects.memoryCloseoutSafetyLesson" },
  { key: "futureRecommendation", category: "recommendation", labelKey: "projects.memoryCloseoutFutureRecommendation" },
];

type CloseoutDraft = {
  whatWorked: string;
  whatDidNotWork: string;
  scheduleLesson: string;
  budgetLesson: string;
  crewLesson: string;
  vendorLesson: string;
  customerLesson: string;
  safetyLesson: string;
  futureRecommendation: string;
};

const EMPTY_CLOSEOUT: CloseoutDraft = {
  whatWorked: "",
  whatDidNotWork: "",
  scheduleLesson: "",
  budgetLesson: "",
  crewLesson: "",
  vendorLesson: "",
  customerLesson: "",
  safetyLesson: "",
  futureRecommendation: "",
};

export function ProjectMemoryCapturePanel({
  projectId,
  projectName,
  projectStatus,
  customerId,
  tasks,
  phaseNameById,
  t,
}: Props) {
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [closeoutMessage, setCloseoutMessage] = useState<string | null>(null);
  const [isCloseoutSaving, setIsCloseoutSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [scope, setScope] = useState<MemoryScope>("project");
  const [category, setCategory] = useState<MemoryCategory>("lesson_learned");
  const [importance, setImportance] = useState<MemoryImportance>("medium");
  const [confidence, setConfidence] = useState<MemoryConfidence>("observed");
  const [reason, setReason] = useState("");
  const [taskId, setTaskId] = useState("");
  const [phaseId, setPhaseId] = useState("");
  const [tags, setTags] = useState("");
  const [evidenceLabel, setEvidenceLabel] = useState("");
  const [evidenceHref, setEvidenceHref] = useState("");
  const [closeoutConfidence, setCloseoutConfidence] = useState<MemoryConfidence>("observed");
  const [closeoutDraft, setCloseoutDraft] = useState<CloseoutDraft>(EMPTY_CLOSEOUT);

  const taskOptions = useMemo(() => tasks.slice().sort((a, b) => a.title.localeCompare(b.title)), [tasks]);
  const showCloseout = projectStatus.trim().toLowerCase() === "completed";

  const saveMemory = async () => {
    if (!title.trim() || !summary.trim() || !reason.trim()) {
      setSaveState("error");
      setSaveMessage(t("projects.memoryErrorRequired"));
      return;
    }

    const payload = {
      scope,
      category,
      projectId,
      customerId: scope === "customer" ? (customerId ?? null) : null,
      taskId: scope === "task" ? (taskId || null) : null,
      phaseId: scope === "phase" ? (phaseId || null) : null,
      title: title.trim(),
      summary: summary.trim(),
      details: {
        projectName,
        reason: reason.trim(),
      },
      importance,
      confidence,
      source: "user_explicit_save",
      reason: reason.trim(),
      sourceReferences: evidenceLabel.trim()
        ? [{ id: `evidence-${Date.now()}`, label: evidenceLabel.trim(), type: "manual", href: evidenceHref.trim() || null }]
        : [],
      tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      recommendationStatus: null,
    };

    setSaveState("saving");
    setSaveMessage(null);

    try {
      const response = await fetch("/api/bango-intelligence/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json() as { ok: boolean; error?: string; deduplicationOutcome?: string };

      if (!result.ok) {
        if ((result.error || "").toLowerCase().includes("duplicate")) {
          setSaveState("duplicate");
          setSaveMessage(t("projects.memoryDuplicateDetected"));
          return;
        }

        setSaveState("error");
        setSaveMessage(result.error || t("projects.memorySaveError"));
        return;
      }

      if (result.deduplicationOutcome === "rejected_exact_duplicate") {
        setSaveState("duplicate");
        setSaveMessage(t("projects.memoryDuplicateDetected"));
        return;
      }

      setSaveState("saved");
      setSaveMessage(t("projects.memorySaved"));
      setTitle("");
      setSummary("");
      setReason("");
      setTaskId("");
      setPhaseId("");
      setTags("");
      setEvidenceLabel("");
      setEvidenceHref("");
    } catch {
      setSaveState("error");
      setSaveMessage(t("projects.memorySaveError"));
    }
  };

  const saveCloseoutLessons = async () => {
    const entries = CLOSEOUT_FIELDS
      .map((field) => ({
        ...field,
        value: closeoutDraft[field.key].trim(),
      }))
      .filter((item) => item.value.length > 0);

    if (entries.length === 0) {
      setCloseoutMessage(t("projects.memoryCloseoutEmpty"));
      return;
    }

    setIsCloseoutSaving(true);
    setCloseoutMessage(null);

    const source = closeoutConfidence === "verified" ? "verified_project_lesson" : "operational_observation";

    let created = 0;
    for (const entry of entries) {
      const titlePrefix = entry.category === "safety_observation"
        ? t("projects.memorySafetyObservationPrefix")
        : t(entry.labelKey);
      const payload = {
        scope: "project",
        category: entry.category,
        projectId,
        title: `${titlePrefix} - ${projectName}`,
        summary: entry.category === "safety_observation"
          ? `${t("projects.memorySafetyObservationPrefix")}: ${entry.value}`
          : entry.value,
        details: {
          closeout: true,
          field: entry.key,
        },
        importance: "high",
        confidence: closeoutConfidence,
        source,
        reason: t("projects.memoryCloseoutReason"),
        sourceReferences: [{ id: `project-${projectId}`, label: projectName, type: "project", href: `/projects/${projectId}` }],
        tags: ["project_closeout", entry.key],
      };

      const response = await fetch("/api/bango-intelligence/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json() as { ok: boolean; error?: string };
      if (result.ok) {
        created += 1;
      }
    }

    setIsCloseoutSaving(false);

    if (created > 0) {
      setCloseoutMessage(t("projects.memoryCloseoutSaved", { count: created }));
      setCloseoutDraft(EMPTY_CLOSEOUT);
      return;
    }

    setCloseoutMessage(t("projects.memorySaveError"));
  };

  return (
    <div className="space-y-6">
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <CardTitle className="text-[1.05rem] font-bold text-[var(--color-navy-900)]">{t("projects.memorySaveTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 p-5">
          <Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={t("projects.memoryTitle")} aria-label={t("projects.memoryTitle")} />
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            placeholder={t("projects.memorySummary")}
            aria-label={t("projects.memorySummary")}
            className="min-h-[86px] w-full rounded-[12px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <select value={scope} onChange={(event) => setScope(event.target.value as MemoryScope)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryScope")}>
              <option value="project">{t("projects.memoryScopeProject")}</option>
              <option value="customer" disabled={!customerId}>{t("projects.memoryScopeCustomer")}</option>
              <option value="task">{t("projects.memoryScopeTask")}</option>
              <option value="phase">{t("projects.memoryScopePhase")}</option>
            </select>

            <select value={category} onChange={(event) => setCategory(event.target.value as MemoryCategory)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryCategory")}>
              {MANUAL_CATEGORIES.map((option) => (
                <option key={option} value={option}>{t(`projects.memoryCategory_${option}`)}</option>
              ))}
            </select>

            <select value={importance} onChange={(event) => setImportance(event.target.value as MemoryImportance)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryImportance")}>
              <option value="critical">{t("projects.memoryImportanceCritical")}</option>
              <option value="high">{t("projects.memoryImportanceHigh")}</option>
              <option value="medium">{t("projects.memoryImportanceMedium")}</option>
              <option value="low">{t("projects.memoryImportanceLow")}</option>
            </select>

            <select value={confidence} onChange={(event) => setConfidence(event.target.value as MemoryConfidence)} className="rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryConfidence")}>
              <option value="verified">{t("projects.memoryConfidenceVerified")}</option>
              <option value="observed">{t("projects.memoryConfidenceObserved")}</option>
              <option value="inferred">{t("projects.memoryConfidenceInferred")}</option>
              <option value="draft">{t("projects.memoryConfidenceDraft")}</option>
            </select>
          </div>

          {scope === "task" && (
            <select value={taskId} onChange={(event) => setTaskId(event.target.value)} className="w-full rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryTaskLink")}>
              <option value="">{t("projects.memoryTaskLink")}</option>
              {taskOptions.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
            </select>
          )}

          {scope === "phase" && (
            <select value={phaseId} onChange={(event) => setPhaseId(event.target.value)} className="w-full rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryPhaseLink")}>
              <option value="">{t("projects.memoryPhaseLink")}</option>
              {Object.entries(phaseNameById).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          )}

          <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder={t("projects.memoryReason")} aria-label={t("projects.memoryReason")} />
          <Input value={tags} onChange={(event) => setTags(event.target.value)} placeholder={t("projects.memoryTags")} aria-label={t("projects.memoryTags")} />
          <Input value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} placeholder={t("projects.memoryEvidenceLabel")} aria-label={t("projects.memoryEvidenceLabel")} />
          <Input value={evidenceHref} onChange={(event) => setEvidenceHref(event.target.value)} placeholder={t("projects.memoryEvidenceLink")} aria-label={t("projects.memoryEvidenceLink")} />

          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" onClick={saveMemory} disabled={saveState === "saving"}>{saveState === "saving" ? t("projects.memorySaving") : t("projects.memorySaveAction")}</Button>
            {saveMessage && (
              <p className={`text-xs ${saveState === "error" ? "text-[var(--color-danger-700)]" : "text-[var(--color-text-secondary)]"}`}>{saveMessage}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {showCloseout && (
        <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
          <CardHeader className="bg-[var(--color-surface-subtle)]/55">
            <CardTitle className="text-[1.05rem] font-bold text-[var(--color-navy-900)]">{t("projects.memoryCloseoutTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-5">
            <select value={closeoutConfidence} onChange={(event) => setCloseoutConfidence(event.target.value as MemoryConfidence)} className="w-full rounded-[10px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm" aria-label={t("projects.memoryConfidence")}>
              <option value="verified">{t("projects.memoryConfidenceVerified")}</option>
              <option value="observed">{t("projects.memoryConfidenceObserved")}</option>
            </select>

            {CLOSEOUT_FIELDS.map((field) => (
              <textarea
                key={field.key}
                value={closeoutDraft[field.key]}
                onChange={(event) => setCloseoutDraft((previous) => ({ ...previous, [field.key]: event.target.value }))}
                placeholder={t(field.labelKey)}
                aria-label={t(field.labelKey)}
                className="min-h-[72px] w-full rounded-[12px] border border-[var(--color-border-subtle)] px-3 py-2 text-sm"
              />
            ))}

            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" onClick={saveCloseoutLessons} disabled={isCloseoutSaving}>{isCloseoutSaving ? t("projects.memorySaving") : t("projects.memoryCloseoutSaveAction")}</Button>
              {closeoutMessage && <p className="text-xs text-[var(--color-text-secondary)]">{closeoutMessage}</p>}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
