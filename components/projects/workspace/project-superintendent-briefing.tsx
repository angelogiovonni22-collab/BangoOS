"use client";

import { useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Info,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Zap,
} from "lucide-react";
import { FadeIn, IntelligenceActivity, PageTransition, StaggerGroup } from "@/components/motion";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { ProjectSuperintendentBriefing, BriefingState } from "@/lib/project-intelligence/briefing/briefing-types";
import type { BangoAIResponse, NarratedBriefing } from "@/lib/bango-intelligence/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

type PanelMode = "deterministic" | "loading" | "ai" | "error" | "fallback";

type ProjectSuperintendentBriefingPanelProps = {
  briefing: ProjectSuperintendentBriefing;
  projectId: string;
  projectName: string;
  locale: string;
  t: TranslateFn;
  /** Format a currency value using the workspace locale. */
  formatCurrency: (amount: number) => string;
};

const ENABLE_BRIEFING_AI_NARRATION = process.env.NEXT_PUBLIC_BANGOFLOW_ENABLE_BRIEFING_NARRATION === "true";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProjectSuperintendentBriefingPanel({
  briefing,
  projectId,
  projectName,
  locale,
  t,
  formatCurrency,
}: ProjectSuperintendentBriefingPanelProps) {
  const { metadata, state, greeting, executiveSummaryKey, executiveSummaryParams, focusItems, riskItems, progressSnapshot, recommendedActions } = briefing;

  const [mode, setMode] = useState<PanelMode>("deterministic");
  const [narration, setNarration] = useState<NarratedBriefing | null>(null);
  const [aiGeneratedAt, setAiGeneratedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const stateColors = stateColorMap(state);
  const generatedTimeLabel = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(metadata.generatedAt));
    } catch { return ""; }
  }, [metadata.generatedAt]);

  const aiGeneratedLabel = useMemo(() => {
    if (!aiGeneratedAt) return null;
    try {
      return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(new Date(aiGeneratedAt));
    } catch { return null; }
  }, [aiGeneratedAt]);

  const requestNarration = useCallback(async () => {
    if (!ENABLE_BRIEFING_AI_NARRATION) {
      return;
    }

    setMode("loading");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/bango-intelligence/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, requestType: "narrate_briefing", locale }),
      });
      const payload = await res.json() as BangoAIResponse;
      if (payload.ok && payload.isAiNarration && payload.narration) {
        setNarration(payload.narration);
        setAiGeneratedAt(payload.generatedAt);
        setMode("ai");
      } else if (payload.ok && !payload.isAiNarration) {
        setMode("fallback");
      } else {
        setErrorMessage(!payload.ok && "error" in payload ? payload.error : t("briefingAIError"));
        setMode("error");
      }
    } catch {
      setErrorMessage(t("briefingAIError"));
      setMode("error");
    }
  }, [projectId, locale, t]);

  const returnToDeterministic = useCallback(() => setMode("deterministic"), []);

  const isAI = mode === "ai" && narration !== null;

  return (
    <div className="space-y-5">
      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card as="section" variant="elevated" className="overflow-hidden rounded-[18px] border-[var(--color-border-subtle)] shadow-[0_20px_42px_-28px_rgba(15,23,42,0.35)]">
        <CardHeader className={`border-b border-[var(--color-border-subtle)] ${stateColors.headerGradient}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] ${stateColors.iconBg}`}>
                <Zap size={18} aria-hidden="true" />
              </span>
              <div>
                <p className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--color-text-secondary)]">{t("briefingPanelLabel")}</p>
                <CardTitle className="text-[1.25rem] font-bold leading-tight tracking-[-0.01em] text-[var(--color-navy-900)]">{greeting.projectName}</CardTitle>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {metadata.healthScore !== null && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${stateColors.scoreBadge}`}>
                  {t("briefingHealthScore", { score: metadata.healthScore })}
                </span>
              )}
              {generatedTimeLabel && mode !== "ai" && (
                <span className="text-[0.7rem] font-medium text-[var(--color-text-muted)]">{t("briefingGeneratedAt", { time: generatedTimeLabel })}</span>
              )}
              {ENABLE_BRIEFING_AI_NARRATION && isAI && aiGeneratedLabel && (
                <span className="text-[0.7rem] font-medium text-[var(--color-info-600)]">{t("briefingAILastGenerated", { time: aiGeneratedLabel })}</span>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 p-5">
          <div className="min-h-6">
            <IntelligenceActivity active={mode === "loading"} label={t("briefingAIGenerating")} />
          </div>

          <PageTransition transitionKey={`briefing-mode-${mode}`}>
          {/* Deterministic executive summary */}
          {!isAI && mode !== "loading" && (
            <div className={`flex items-start gap-3 rounded-[14px] border px-4 py-3.5 ${stateColors.summaryStrip}`}>
              <span className={`mt-0.5 shrink-0 ${stateColors.summaryIcon}`}><StateIcon state={state} /></span>
              <p className="text-sm font-semibold leading-6 text-[var(--color-navy-900)]">{t(executiveSummaryKey, executiveSummaryParams)}</p>
            </div>
          )}

          {/* Loading */}
          {mode === "loading" && (
            <div className="flex items-center gap-3 rounded-[14px] border border-[var(--color-info-100)] bg-[var(--color-info-50)] px-4 py-3.5">
              <RefreshCw size={15} className="shrink-0 text-[var(--color-info-600)]" aria-hidden="true" />
              <p className="text-sm font-semibold text-[var(--color-info-700)]">{t("briefingAIGenerating")}</p>
            </div>
          )}

          {/* AI narration */}
          {isAI && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="shrink-0 text-[var(--color-brand-700)]" aria-hidden="true" />
                <span className="text-[0.7rem] font-bold uppercase tracking-[0.1em] text-[var(--color-brand-700)]">{t("briefingAIHeadline")}</span>
                <ConfidencePill confidence={narration.confidence} t={t} />
              </div>
              <p className="text-[1.05rem] font-bold leading-tight text-[var(--color-navy-900)]">{narration.headline}</p>
              <p className="text-sm leading-6 text-[var(--color-text-secondary)]">{narration.executive_summary}</p>
              {narration.limitations.length > 0 && (
                <div className="rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
                  <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--color-text-muted)]">{t("briefingAILimitations")}</p>
                  <ul className="space-y-0.5">{narration.limitations.map((lim, i) => <li key={i} className="text-xs text-[var(--color-text-secondary)]">{lim}</li>)}</ul>
                </div>
              )}
            </div>
          )}

          {/* Status notices */}
          {mode === "fallback" && (
            <div className="flex items-center gap-2 rounded-[10px] border border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-2">
              <Info size={13} className="shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-text-secondary)]">{t("briefingAIStandardShown")}</p>
            </div>
          )}
          {mode === "error" && (
            <div className="flex items-center gap-2 rounded-[10px] border border-[var(--color-warning-200)] bg-[var(--color-warning-50)] px-3 py-2">
              <AlertTriangle size={13} className="shrink-0 text-[var(--color-warning-600)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-warning-700)]">{errorMessage ?? t("briefingAIError")}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2 pt-1">
            {ENABLE_BRIEFING_AI_NARRATION && (mode === "deterministic" || mode === "error" || mode === "fallback") && (
              <button type="button" onClick={requestNarration} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-primary-200)] bg-[var(--color-primary-100)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-700)] hover:bg-[var(--color-primary-200)]">
                <Bot size={13} aria-hidden="true" />
                {mode === "error" ? t("briefingRefreshAI") : t("briefingGenerateAI")}
              </button>
            )}
            {ENABLE_BRIEFING_AI_NARRATION && isAI && (
              <>
                <button type="button" onClick={requestNarration} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-primary-200)] bg-[var(--color-primary-100)] px-3 py-1.5 text-xs font-semibold text-[var(--color-brand-700)] hover:bg-[var(--color-primary-200)]">
                  <RefreshCw size={13} aria-hidden="true" />
                  {t("briefingRefreshAI")}
                </button>
                <button type="button" onClick={returnToDeterministic} className="inline-flex items-center gap-1.5 rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]">
                  {t("briefingReturnToStandard")}
                </button>
              </>
            )}
          </div>
          </PageTransition>
        </CardContent>
      </Card>

      {/* â”€â”€ Today's Focus â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {mode !== "loading" && (
        <StaggerGroup startDelayMs={10} staggerMs={32}>
          <FadeIn delayMs={0}>
            <FocusSection
              mode={mode}
              narration={narration}
              focusItems={focusItems}
              t={t}
            />
          </FadeIn>
        </StaggerGroup>
      )}

      {/* â”€â”€ Risks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {mode !== "loading" && (
        <FadeIn delayMs={25}>
          <RisksSection
            mode={mode}
            narration={narration}
            riskItems={riskItems}
            t={t}
          />
        </FadeIn>
      )}

      {/* â”€â”€ Progress Snapshot â€” always deterministic â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <SectionHeader icon={<Info size={15} aria-hidden="true" />} iconClass="bg-[var(--color-info-100)] text-[var(--color-info-700)]" title={t("briefingProgressTitle")} />
        </CardHeader>
        <CardContent className="p-5">
          <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
            <SnapshotMetric label={t("briefingProgressCompletion")} value={`${progressSnapshot.completionPercent}%`} />
            <SnapshotMetric label={t("briefingProgressActiveTasks")} value={String(progressSnapshot.activeTasks)} />
            <SnapshotMetric label={t("briefingProgressOverdue")} value={String(progressSnapshot.overdueTasks)} tone={progressSnapshot.overdueTasks > 0 ? "danger" : "neutral"} />
            <SnapshotMetric label={t("briefingProgressBlocked")} value={String(progressSnapshot.blockedTasks)} tone={progressSnapshot.blockedTasks > 0 ? "warning" : "neutral"} />
            <SnapshotMetric label={t("briefingProgressDueToday")} value={String(progressSnapshot.tasksDueToday)} />
            <SnapshotMetric label={t("briefingProgressDueThisWeek")} value={String(progressSnapshot.tasksDueThisWeek)} />
            <SnapshotMetric label={t("briefingProgressActivePhases")} value={String(progressSnapshot.activePhasesCount)} />
            <SnapshotMetric label={t("briefingProgressPhotos")} value={String(progressSnapshot.photosCount)} />
            <SnapshotMetric label={t("briefingProgressWorkers")} value={String(progressSnapshot.assignedWorkers)} />
            <SnapshotMetric label={t("briefingProgressUnassigned")} value={String(progressSnapshot.unassignedTaskCount)} tone={progressSnapshot.unassignedTaskCount > 0 ? "warning" : "neutral"} />
            <SnapshotMetric label={t("briefingProgressInvoicePaid")} value={formatCurrency(progressSnapshot.invoicePaid)} />
            <SnapshotMetric label={t("briefingProgressChangeOrders")} value={String(progressSnapshot.changeOrderCount)} />
          </dl>
        </CardContent>
      </Card>

      {/* â”€â”€ Recommended Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {mode !== "loading" && (
        <FadeIn delayMs={40}>
          <ActionsSection
            mode={mode}
            narration={narration}
            recommendedActions={recommendedActions}
            projectId={projectId}
            projectName={projectName}
            t={t}
          />
        </FadeIn>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section sub-components
// ---------------------------------------------------------------------------

function FocusSection({ mode, narration, focusItems, t }: { mode: PanelMode; narration: NarratedBriefing | null; focusItems: import("@/lib/project-intelligence/briefing/briefing-types").BriefingFocusItem[]; t: TranslateFn }) {
  const aiItems = mode === "ai" && narration ? narration.today_focus : null;
  const deterministicItems = focusItems;

  if (aiItems && aiItems.length > 0) {
    return (
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <SectionHeader icon={<ClipboardList size={15} aria-hidden="true" />} iconClass="bg-[var(--color-primary-100)] text-[var(--color-brand-700)]" title={t("briefingTodaysFocusTitle")} aiLabel={t("briefingAIBadgeLabel")} />
        </CardHeader>
        <CardContent className="p-5">
          <ol className="space-y-2.5">
            {aiItems.map((item, i) => (
              <li key={i} className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 ${urgencyCardClass(item.priority)}`}>
                <span className="mt-0.5 shrink-0 text-[0.65rem] font-bold text-[var(--color-text-muted)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-navy-900)]">{item.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{item.explanation}</p>
                </div>
                <UrgencyBadge urgency={item.priority} t={t} />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    );
  }

  if (deterministicItems.length === 0) return null;

  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="bg-[var(--color-surface-subtle)]/55">
        <SectionHeader icon={<ClipboardList size={15} aria-hidden="true" />} iconClass="bg-[var(--color-primary-100)] text-[var(--color-brand-700)]" title={t("briefingTodaysFocusTitle")} />
      </CardHeader>
      <CardContent className="p-5">
        <ol className="space-y-2.5" aria-label={t("briefingTodaysFocusTitle")}>
          {deterministicItems.map((item, index) => (
            <li key={item.id} className={`flex items-start gap-3 rounded-[12px] border px-4 py-3 ${urgencyCardClass(item.urgency)}`}>
              <span className="mt-0.5 shrink-0 text-[0.65rem] font-bold text-[var(--color-text-muted)]">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-navy-900)]">{t(item.titleKey, item.params)}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{t(item.descriptionKey, item.params)}</p>
              </div>
              <UrgencyBadge urgency={item.urgency} t={t} />
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function RisksSection({ mode, narration, riskItems, t }: { mode: PanelMode; narration: NarratedBriefing | null; riskItems: import("@/lib/project-intelligence/briefing/briefing-types").BriefingRiskItem[]; t: TranslateFn }) {
  const aiRisks = mode === "ai" && narration ? narration.risks : null;
  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="bg-[var(--color-surface-subtle)]/55">
        <SectionHeader icon={<ShieldAlert size={15} aria-hidden="true" />} iconClass="bg-[var(--color-danger-100)] text-[var(--color-danger-700)]" title={t("briefingRisksTitle")} aiLabel={mode === "ai" ? t("briefingAIBadgeLabel") : undefined} />
      </CardHeader>
      <CardContent className="p-5">
        {aiRisks && aiRisks.length > 0 ? (
          <ul className="space-y-2.5">
            {aiRisks.map((item, i) => (
              <li key={i} className={`rounded-[12px] border px-4 py-3 ${severityCardClass(item.severity)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-navy-900)]">{item.title}</p>
                  <SeverityBadge severity={item.severity} t={t} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{item.explanation}</p>
              </li>
            ))}
          </ul>
        ) : riskItems.length > 0 ? (
          <ul className="space-y-2.5">
            {riskItems.map((item) => (
              <li key={item.riskId} className={`rounded-[12px] border px-4 py-3 ${severityCardClass(item.severity)}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-[var(--color-navy-900)]">{t(item.titleKey, item.params)}</p>
                  <SeverityBadge severity={item.severity} t={t} />
                </div>
                <p className="mt-1 text-xs text-[var(--color-text-secondary)]">{t(item.explanationKey, item.params)}</p>
                <p className="mt-2 text-xs font-semibold text-[var(--color-text-secondary)]">{t(item.recommendedResponseKey)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-3 rounded-[12px] border border-[var(--color-success-200)] bg-[var(--color-success-50)] px-4 py-3">
            <CheckCircle2 size={16} className="shrink-0 text-[var(--color-success-600)]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--color-success-700)]">{t("briefingRisksHealthyState")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionsSection({ mode, narration, recommendedActions, projectId, projectName, t }: {
  mode: PanelMode;
  narration: NarratedBriefing | null;
  recommendedActions: import("@/lib/project-intelligence/briefing/briefing-types").BriefingAction[];
  projectId: string;
  projectName: string;
  t: TranslateFn;
}) {
  const aiActions = mode === "ai" && narration ? narration.recommended_actions : null;
  const [recommendationState, setRecommendationState] = useState<Record<string, {
    memoryId: string | null;
    outcome: string | null;
    isBusy: boolean;
    message: string | null;
  }>>({});

  const setActionState = (
    actionId: string,
    updater: (current: { memoryId: string | null; outcome: string | null; isBusy: boolean; message: string | null }) => {
      memoryId: string | null;
      outcome: string | null;
      isBusy: boolean;
      message: string | null;
    },
  ) => {
    setRecommendationState((previous) => {
      const current = previous[actionId] ?? { memoryId: null, outcome: null, isBusy: false, message: null };
      return {
        ...previous,
        [actionId]: updater(current),
      };
    });
  };

  const saveRecommendation = async (actionId: string, title: string, summary: string) => {
    setActionState(actionId, (current) => ({ ...current, isBusy: true, message: null }));

    try {
      const response = await fetch("/api/bango-intelligence/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scope: "project",
          category: "recommendation",
          projectId,
          title,
          summary,
          details: {
            source: "briefing_action",
            projectName,
          },
          importance: "high",
          confidence: "observed",
          source: "user_explicit_save",
          reason: "Briefing recommendation captured for explicit review.",
          sourceReferences: [{ id: `project-${projectId}`, label: projectName, type: "project", href: `/projects/${projectId}` }],
          tags: ["briefing_recommendation"],
        }),
      });

      const payload = await response.json() as {
        ok: boolean;
        error?: string;
        memory?: { id: string; recommendationStatus?: string | null };
      };
      const savedMemory = payload.memory;

      if (!payload.ok || !savedMemory) {
        setActionState(actionId, (current) => ({
          ...current,
          isBusy: false,
          message: payload.error ?? t("projects.memorySaveError"),
        }));
        return;
      }

      setActionState(actionId, () => ({
        memoryId: savedMemory.id,
        outcome: savedMemory.recommendationStatus ?? null,
        isBusy: false,
        message: t("projects.memorySaved"),
      }));
    } catch {
      setActionState(actionId, (current) => ({
        ...current,
        isBusy: false,
        message: t("projects.memorySaveError"),
      }));
    }
  };

  const setOutcome = async (actionId: string, outcome: "accepted" | "rejected" | "implemented" | "ignored" | "expired") => {
    const state = recommendationState[actionId];
    if (!state?.memoryId) {
      return;
    }

    if (!window.confirm(t("projects.memoryOutcomeConfirm"))) {
      return;
    }

    setActionState(actionId, (current) => ({ ...current, isBusy: true, message: null }));

    try {
      const response = await fetch(`/api/bango-intelligence/memories/${state.memoryId}/recommendation-outcome`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: outcome, confirm: true }),
      });

      const payload = await response.json() as {
        ok: boolean;
        error?: string;
        memory?: { recommendationStatus?: string | null };
      };

      if (!payload.ok) {
        setActionState(actionId, (current) => ({
          ...current,
          isBusy: false,
          message: payload.error ?? t("projects.memoryOutcomeSaveError"),
        }));
        return;
      }

      setActionState(actionId, (current) => ({
        ...current,
        isBusy: false,
        outcome: payload.memory?.recommendationStatus ?? outcome,
        message: t("projects.memoryOutcomeSaved"),
      }));
    } catch {
      setActionState(actionId, (current) => ({
        ...current,
        isBusy: false,
        message: t("projects.memoryOutcomeSaveError"),
      }));
    }
  };

  if (aiActions && aiActions.length > 0) {
    return (
      <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
        <CardHeader className="bg-[var(--color-surface-subtle)]/55">
          <SectionHeader icon={<AlertTriangle size={15} aria-hidden="true" />} iconClass="bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" title={t("briefingActionsTitle")} aiLabel={t("briefingAIBadgeLabel")} />
        </CardHeader>
        <CardContent className="p-5">
          <ol className="space-y-2.5">
            {aiActions.map((action, i) => (
              <li key={i} className="flex items-start gap-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-white px-4 py-3">
                <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] text-[0.6rem] font-bold text-[var(--color-text-secondary)]">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--color-navy-900)]">{action.title}</p>
                  <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{action.explanation}</p>

                  {(() => {
                    const actionId = `ai-${i}`;
                    const state = recommendationState[actionId] ?? { memoryId: null, outcome: null, isBusy: false, message: null };
                    return (
                      <div className="mt-2.5 space-y-2">
                        {!state.memoryId ? (
                          <button
                            type="button"
                            onClick={() => void saveRecommendation(actionId, action.title, action.explanation)}
                            disabled={state.isBusy}
                            className="inline-flex items-center rounded-[8px] border border-[var(--color-primary-200)] bg-[var(--color-primary-100)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-700)] hover:bg-[var(--color-primary-200)] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {state.isBusy ? t("projects.memorySaving") : t("projects.memorySaveAction")}
                          </button>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {(["accepted", "implemented", "rejected", "ignored", "expired"] as const).map((value) => (
                              <button
                                key={value}
                                type="button"
                                onClick={() => void setOutcome(actionId, value)}
                                disabled={state.isBusy}
                                className={`rounded-[8px] border px-2 py-1 text-[11px] font-semibold ${state.outcome === value ? "border-[var(--color-brand-500)] bg-[var(--color-primary-100)] text-[var(--color-brand-700)]" : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)]"}`}
                              >
                                {t(`projects.memoryOutcome_${value}`)}
                              </button>
                            ))}
                          </div>
                        )}

                        {state.outcome && <p className="text-[11px] text-[var(--color-text-muted)]">{t("projects.memoryOutcomeCurrent", { status: t(`projects.memoryOutcome_${state.outcome}`) })}</p>}
                        {state.message && <p className="text-[11px] text-[var(--color-text-muted)]">{state.message}</p>}
                      </div>
                    );
                  })()}
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    );
  }

  if (recommendedActions.length === 0) return null;

  return (
    <Card as="section" variant="elevated" className="rounded-[16px] shadow-[var(--shadow-small)]">
      <CardHeader className="bg-[var(--color-surface-subtle)]/55">
        <SectionHeader icon={<AlertTriangle size={15} aria-hidden="true" />} iconClass="bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" title={t("briefingActionsTitle")} />
      </CardHeader>
      <CardContent className="p-5">
        <ol className="space-y-2.5">
          {recommendedActions.map((action, index) => (
            <li key={action.id} className="flex items-start gap-3 rounded-[12px] border border-[var(--color-border-subtle)] bg-white px-4 py-3 shadow-[var(--shadow-small)]">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-subtle)] text-[0.6rem] font-bold text-[var(--color-text-secondary)]">{index + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--color-navy-900)]">{t(action.titleKey)}</p>
                <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{t(action.explanationKey)}</p>
              </div>
              {action.isActionable && action.href && (
                <a href={action.href} className="shrink-0 inline-flex items-center gap-1 rounded-[8px] border border-[var(--color-border-subtle)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-700)] hover:bg-[var(--color-surface-subtle)]">
                  {t("briefingActionOpen")}<ChevronRight size={12} aria-hidden="true" />
                </a>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SectionHeader({ icon, iconClass, title, aiLabel }: { icon: React.ReactNode; iconClass: string; title: string; aiLabel?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={`inline-flex h-7 w-7 items-center justify-center rounded-[8px] ${iconClass}`}>{icon}</span>
      <CardTitle className="text-[1.05rem] font-bold text-[var(--color-navy-900)]">{title}</CardTitle>
      {aiLabel && (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-primary-100)] px-2 py-0.5 text-[0.6rem] font-bold text-[var(--color-brand-700)]">
          <Sparkles size={9} aria-hidden="true" />{aiLabel}
        </span>
      )}
    </div>
  );
}

function StateIcon({ state }: { state: BriefingState }) {
  if (state === "critical" || state === "attention") return <AlertTriangle size={15} aria-hidden="true" />;
  if (state === "healthy") return <CheckCircle2 size={15} aria-hidden="true" />;
  return <Info size={15} aria-hidden="true" />;
}

function ConfidencePill({ confidence, t }: { confidence: "high" | "medium" | "low"; t: TranslateFn }) {
  const map = {
    high: { key: "briefingAIConfidenceHigh", cls: "bg-[var(--color-success-100)] text-[var(--color-success-700)]" },
    medium: { key: "briefingAIConfidenceMedium", cls: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" },
    low: { key: "briefingAIConfidenceLow", cls: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]" },
  };
  const { key, cls } = map[confidence];
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[0.6rem] font-bold ${cls}`}>{t(key)}</span>;
}

function SnapshotMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" | "warning" }) {
  const valueClass = tone === "danger" ? "text-[var(--color-danger-700)]" : tone === "warning" ? "text-[var(--color-warning-700)]" : "text-[var(--color-navy-900)]";
  return (
    <div className="rounded-[10px] border border-[var(--color-border-subtle)] bg-white px-3 py-2.5">
      <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.07em] text-[var(--color-text-muted)]">{label}</dt>
      <dd className={`mt-1 text-base font-bold ${valueClass}`}>{value}</dd>
    </div>
  );
}

function UrgencyBadge({ urgency, t }: { urgency: string; t: TranslateFn }) {
  const map: Record<string, { key: string; cls: string }> = {
    critical: { key: "briefingSeverityCritical", cls: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]" },
    high: { key: "briefingSeverityHigh", cls: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]" },
    medium: { key: "briefingSeverityMedium", cls: "bg-[var(--color-info-100)] text-[var(--color-info-700)]" },
    low: { key: "briefingSeverityLow", cls: "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]" },
    info: { key: "briefingSeverityInfo", cls: "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]" },
  };
  const entry = map[urgency] ?? map.info;
  return <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[0.65rem] font-bold ${entry.cls}`}>{t(entry.key)}</span>;
}

function SeverityBadge({ severity, t }: { severity: string; t: TranslateFn }) {
  const toneMap: Record<string, string> = { critical: "danger", high: "warning", medium: "info", low: "neutral" };
  return <Badge tone={(toneMap[severity] ?? "neutral") as Parameters<typeof Badge>[0]["tone"]}>{t(`briefingSeverity${capitalize(severity)}`)}</Badge>;
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function urgencyCardClass(urgency: string): string {
  if (urgency === "critical") return "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]";
  if (urgency === "high") return "border-[var(--color-warning-200)] bg-[var(--color-warning-50)]";
  if (urgency === "medium") return "border-[var(--color-info-100)] bg-[var(--color-info-50)]";
  return "border-[var(--color-border-subtle)] bg-white";
}

function severityCardClass(severity: string): string {
  if (severity === "critical") return "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]";
  if (severity === "high") return "border-[var(--color-warning-200)] bg-[var(--color-warning-50)]";
  if (severity === "medium") return "border-[var(--color-info-100)] bg-[var(--color-info-50)]";
  return "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]";
}

type StateColorMap = { headerGradient: string; iconBg: string; scoreBadge: string; summaryStrip: string; summaryIcon: string };
function stateColorMap(state: BriefingState): StateColorMap {
  switch (state) {
    case "critical": return { headerGradient: "bg-[linear-gradient(145deg,rgba(239,68,68,0.1),rgba(255,255,255,0.98)_50%,rgba(249,115,22,0.08))]", iconBg: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]", scoreBadge: "bg-[var(--color-danger-100)] text-[var(--color-danger-700)]", summaryStrip: "border-[var(--color-danger-200)] bg-[var(--color-danger-50)]", summaryIcon: "text-[var(--color-danger-600)]" };
    case "attention": return { headerGradient: "bg-[linear-gradient(145deg,rgba(249,115,22,0.1),rgba(255,255,255,0.98)_50%,rgba(234,179,8,0.08))]", iconBg: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]", scoreBadge: "bg-[var(--color-warning-100)] text-[var(--color-warning-700)]", summaryStrip: "border-[var(--color-warning-200)] bg-[var(--color-warning-50)]", summaryIcon: "text-[var(--color-warning-600)]" };
    case "healthy": return { headerGradient: "bg-[linear-gradient(145deg,rgba(34,197,94,0.1),rgba(255,255,255,0.98)_50%,rgba(37,99,235,0.08))]", iconBg: "bg-[var(--color-success-100)] text-[var(--color-success-700)]", scoreBadge: "bg-[var(--color-success-100)] text-[var(--color-success-700)]", summaryStrip: "border-[var(--color-success-200)] bg-[var(--color-success-50)]", summaryIcon: "text-[var(--color-success-600)]" };
    default: return { headerGradient: "bg-[linear-gradient(145deg,rgba(148,163,184,0.1),rgba(255,255,255,0.98))]", iconBg: "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]", scoreBadge: "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)]", summaryStrip: "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)]", summaryIcon: "text-[var(--color-text-secondary)]" };
  }
}

function capitalize(s: string): string { return s.charAt(0).toUpperCase() + s.slice(1); }
