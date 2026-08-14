import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/types/database.types";
import type {
  OrionRecommendation,
  OrionRecommendationOutcomeStatus,
  OrionRecommendationStatus,
  OrionWorkforceScore,
  WorkforceTimelineEvent,
} from "./workforce-operations-types";

type RecommendationRow = {
  id: string;
  company_id: string;
  fingerprint: string;
  recommendation_identity: string;
  recommendation_type: string;
  title: string;
  reason: string;
  priority: "critical" | "high" | "medium" | "low";
  expected_impact: string;
  confidence: number;
  status: OrionRecommendationStatus;
  affected_crew_id: string | null;
  affected_employee_id: string | null;
  affected_project_id: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
  acknowledged_at: string | null;
  accepted_at: string | null;
  dismissed_at: string | null;
  completed_at: string | null;
  expired_at: string | null;
  actor_profile_id: string | null;
  outcome_status: OrionRecommendationOutcomeStatus | null;
  outcome_notes: string | null;
};

type TimelineRow = {
  id: string;
  company_id: string;
  event_fingerprint: string;
  event_type: string;
  occurred_at: string;
  title: string;
  detail: string;
  severity: "critical" | "high" | "medium" | "low";
  crew_id: string | null;
  employee_id: string | null;
  project_id: string | null;
  assignment_id: string | null;
  actor_profile_id: string | null;
  metadata: Json;
  source: string;
};

type ReconcileInput = {
  companyId: string;
  actorProfileId: string;
  evaluatedAtIso: string;
  recommendations: OrionRecommendation[];
  scores: OrionWorkforceScore[];
  timeline: WorkforceTimelineEvent[];
};

type LifecycleInput = {
  companyId: string;
  recommendationId: string;
  actorProfileId: string;
  note?: string;
};

type OutcomeInput = {
  companyId: string;
  recommendationId: string;
  actorProfileId: string;
  outcomeStatus: OrionRecommendationOutcomeStatus;
  note?: string;
  metrics?: Record<string, unknown>;
};

export type WorkforceIntelligencePersistenceService = {
  reconcileEvaluation: (input: ReconcileInput) => Promise<{
    recommendations: OrionRecommendation[];
    timeline: WorkforceTimelineEvent[];
  }>;
  acknowledgeRecommendation: (input: LifecycleInput) => Promise<void>;
  acceptRecommendation: (input: LifecycleInput) => Promise<void>;
  dismissRecommendation: (input: LifecycleInput) => Promise<void>;
  completeRecommendation: (input: LifecycleInput) => Promise<void>;
  recordRecommendationOutcome: (input: OutcomeInput) => Promise<void>;
};

const ACTIVE_RECOMMENDATION_STATUSES: OrionRecommendationStatus[] = ["open", "acknowledged", "accepted"];

const ALLOWED_TRANSITIONS: Record<OrionRecommendationStatus, OrionRecommendationStatus[]> = {
  open: ["acknowledged", "accepted", "dismissed", "completed", "expired"],
  acknowledged: ["accepted", "dismissed", "completed", "expired"],
  accepted: ["dismissed", "completed", "expired"],
  dismissed: [],
  completed: [],
  expired: [],
};

function cleanText(value: string | undefined | null) {
  return (value || "").trim().replace(/\s+/g, " ");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableJson(entry)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort((left, right) => left.localeCompare(right));
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }

  return JSON.stringify(value);
}

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function resolveRecommendationTitle(type: OrionRecommendation["type"]) {
  switch (type) {
    case "add_additional_workers":
      return "Add Additional Workers";
    case "move_employee_to_another_crew":
      return "Move Employee To Another Crew";
    case "reassign_supervisor":
      return "Reassign Supervisor";
    case "remove_excess_labor":
      return "Remove Excess Labor";
    case "shift_equipment":
      return "Shift Equipment";
    case "delay_assignment":
      return "Delay Assignment";
    case "start_assignment_early":
      return "Start Assignment Early";
    case "resolve_staffing_conflicts":
      return "Resolve Staffing Conflicts";
    case "reduce_overtime":
      return "Reduce Overtime";
    default:
      return "Workforce Recommendation";
  }
}

export function createRecommendationFingerprint(input: Pick<OrionRecommendation, "type" | "title" | "reason" | "affectedCrewId" | "affectedEmployeeId" | "affectedProjectId">) {
  const source = stableJson({
    type: cleanText(input.type),
    title: cleanText(input.title),
    reason: cleanText(input.reason).toLowerCase(),
    affectedCrewId: cleanText(input.affectedCrewId || "") || null,
    affectedEmployeeId: cleanText(input.affectedEmployeeId || "") || null,
    affectedProjectId: cleanText(input.affectedProjectId || "") || null,
  });

  return `workforce-recommendation:${hashString(source)}`;
}

export function createTimelineFingerprint(event: WorkforceTimelineEvent) {
  const source = stableJson({
    type: cleanText(event.type),
    title: cleanText(event.title),
    detail: cleanText(event.detail),
    crewId: cleanText(event.crewId || "") || null,
    employeeId: cleanText(event.employeeId || "") || null,
    projectId: cleanText(event.projectId || "") || null,
    assignmentId: cleanText(event.assignmentId || "") || null,
    source: cleanText(event.source || "orion_workforce_evaluator"),
  });

  return `workforce-timeline:${hashString(source)}`;
}

export function isValidLifecycleTransition(fromStatus: OrionRecommendationStatus, toStatus: OrionRecommendationStatus) {
  return ALLOWED_TRANSITIONS[fromStatus].includes(toStatus);
}

function assertNoError(error: { message?: string } | null, fallbackMessage: string) {
  if (!error) {
    return;
  }

  throw new Error(error.message || fallbackMessage);
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(3))));
}

function mapRowToRecommendation(row: RecommendationRow): OrionRecommendation {
  return {
    id: row.id,
    originalRecommendationId: row.recommendation_identity,
    fingerprint: row.fingerprint,
    type: row.recommendation_type as OrionRecommendation["type"],
    title: row.title,
    reason: row.reason,
    priority: row.priority,
    expectedImpact: row.expected_impact,
    confidence: row.confidence,
    status: row.status,
    affectedCrewId: row.affected_crew_id,
    affectedEmployeeId: row.affected_employee_id,
    affectedProjectId: row.affected_project_id,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    acceptedAt: row.accepted_at,
    dismissedAt: row.dismissed_at,
    completedAt: row.completed_at,
    expiredAt: row.expired_at,
    actorProfileId: row.actor_profile_id,
    outcomeStatus: row.outcome_status,
    outcomeNotes: row.outcome_notes,
  };
}

function mapRowToTimelineEvent(row: TimelineRow): WorkforceTimelineEvent {
  return {
    id: row.id,
    type: row.event_type as WorkforceTimelineEvent["type"],
    timestamp: row.occurred_at,
    title: row.title,
    detail: row.detail,
    severity: row.severity,
    crewId: row.crew_id,
    employeeId: row.employee_id,
    projectId: row.project_id,
    assignmentId: row.assignment_id,
    actorProfileId: row.actor_profile_id,
    metadata: (row.metadata as Record<string, unknown>) || {},
    source: row.source,
  };
}

function trimNote(note?: string) {
  const value = cleanText(note);
  return value.length > 0 ? value : null;
}

export function mapScoreSnapshots(companyId: string, generatedAtIso: string, scores: OrionWorkforceScore[]) {
  return scores.map((score) => ({
    company_id: companyId,
    score_id: score.id,
    score_label: score.label,
    score_value: score.value,
    confidence: clampConfidence(score.confidence),
    explanation: score.explanation,
    recommended_action: score.recommendedAction,
    generated_at: generatedAtIso,
  }));
}

async function loadRecommendationById(
  supabase: SupabaseClient<Database>,
  companyId: string,
  recommendationId: string,
) {
  const { data, error } = await supabase
    .from("workforce_orion_recommendations" as never)
    .select("*")
    .eq("company_id", companyId)
    .eq("id", recommendationId)
    .maybeSingle();

  assertNoError(error, "Unable to load recommendation record.");
  return (data as RecommendationRow | null) || null;
}

async function insertHistory(params: {
  supabase: SupabaseClient<Database>;
  recommendationId: string;
  companyId: string;
  actorProfileId: string;
  action: string;
  fromStatus?: OrionRecommendationStatus | null;
  toStatus?: OrionRecommendationStatus | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.supabase
    .from("workforce_orion_recommendation_history" as never)
    .insert({
      recommendation_id: params.recommendationId,
      company_id: params.companyId,
      actor_profile_id: params.actorProfileId,
      action: params.action,
      from_status: params.fromStatus || null,
      to_status: params.toStatus || null,
      note: params.note || null,
      metadata: (params.metadata || {}) as Json,
    } as never);

  assertNoError(error, "Unable to write recommendation history.");
}

async function transitionStatus(params: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  recommendationId: string;
  actorProfileId: string;
  toStatus: OrionRecommendationStatus;
  note?: string;
}) {
  const row = await loadRecommendationById(params.supabase, params.companyId, params.recommendationId);
  if (!row) {
    throw new Error("Recommendation was not found in this company workspace.");
  }

  if (row.status === params.toStatus) {
    return;
  }

  if (!isValidLifecycleTransition(row.status, params.toStatus)) {
    throw new Error(`Recommendation transition ${row.status} -> ${params.toStatus} is not allowed.`);
  }

  const nowIso = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status: params.toStatus,
    actor_profile_id: params.actorProfileId,
  };

  if (params.toStatus === "acknowledged") {
    patch.acknowledged_at = nowIso;
  }

  if (params.toStatus === "accepted") {
    patch.accepted_at = nowIso;
    patch.acknowledged_at = row.acknowledged_at || nowIso;
  }

  if (params.toStatus === "dismissed") {
    patch.dismissed_at = nowIso;
  }

  if (params.toStatus === "completed") {
    patch.completed_at = nowIso;
  }

  if (params.toStatus === "expired") {
    patch.expired_at = nowIso;
  }

  const note = trimNote(params.note);
  if ((params.toStatus === "dismissed" || params.toStatus === "completed") && note) {
    patch.outcome_notes = note;
  }

  const { error } = await params.supabase
    .from("workforce_orion_recommendations" as never)
    .update(patch as never)
    .eq("company_id", params.companyId)
    .eq("id", params.recommendationId);

  assertNoError(error, "Unable to update recommendation lifecycle status.");

  await insertHistory({
    supabase: params.supabase,
    recommendationId: params.recommendationId,
    companyId: params.companyId,
    actorProfileId: params.actorProfileId,
    action: params.toStatus,
    fromStatus: row.status,
    toStatus: params.toStatus,
    note,
  });
}

export function createWorkforceIntelligencePersistenceService(
  supabase: SupabaseClient<Database>,
): WorkforceIntelligencePersistenceService {
  return {
    async reconcileEvaluation(input) {
      const evaluatedAtIso = input.evaluatedAtIso;

      const scoreSnapshotRows = mapScoreSnapshots(input.companyId, evaluatedAtIso, input.scores);
      if (scoreSnapshotRows.length > 0) {
        const { error } = await supabase
          .from("workforce_orion_score_snapshots" as never)
          .insert(scoreSnapshotRows as never);

        assertNoError(error, "Unable to persist workforce Orion score snapshots.");
      }

      const { data: activeRowsData, error: activeRowsError } = await supabase
        .from("workforce_orion_recommendations" as never)
        .select("*")
        .eq("company_id", input.companyId)
        .in("status", ACTIVE_RECOMMENDATION_STATUSES)
        .order("created_at", { ascending: false });

      assertNoError(activeRowsError, "Unable to load active recommendations.");
      const activeRows = ((activeRowsData as RecommendationRow[] | null) || []);
      const activeByFingerprint = new Map(activeRows.map((row) => [row.fingerprint, row]));
      const seenFingerprints = new Set<string>();

      for (const recommendation of input.recommendations) {
        const title = cleanText(recommendation.title) || resolveRecommendationTitle(recommendation.type);
        const fingerprint = createRecommendationFingerprint({
          type: recommendation.type,
          title,
          reason: recommendation.reason,
          affectedCrewId: recommendation.affectedCrewId,
          affectedEmployeeId: recommendation.affectedEmployeeId,
          affectedProjectId: recommendation.affectedProjectId,
        });

        seenFingerprints.add(fingerprint);

        const existing = activeByFingerprint.get(fingerprint);
        if (existing) {
          const { error } = await supabase
            .from("workforce_orion_recommendations" as never)
            .update({
              recommendation_identity: recommendation.originalRecommendationId || recommendation.id,
              recommendation_type: recommendation.type,
              title,
              reason: recommendation.reason,
              priority: recommendation.priority,
              expected_impact: recommendation.expectedImpact,
              confidence: clampConfidence(recommendation.confidence),
              affected_crew_id: recommendation.affectedCrewId || null,
              affected_employee_id: recommendation.affectedEmployeeId || null,
              affected_project_id: recommendation.affectedProjectId || null,
              last_seen_at: evaluatedAtIso,
            } as never)
            .eq("company_id", input.companyId)
            .eq("id", existing.id);

          assertNoError(error, "Unable to refresh existing active recommendation.");
          continue;
        }

        const { data: createdData, error: createError } = await supabase
          .from("workforce_orion_recommendations" as never)
          .insert({
            company_id: input.companyId,
            fingerprint,
            recommendation_identity: recommendation.originalRecommendationId || recommendation.id,
            recommendation_type: recommendation.type,
            title,
            reason: recommendation.reason,
            priority: recommendation.priority,
            expected_impact: recommendation.expectedImpact,
            confidence: clampConfidence(recommendation.confidence),
            status: "open",
            affected_crew_id: recommendation.affectedCrewId || null,
            affected_employee_id: recommendation.affectedEmployeeId || null,
            affected_project_id: recommendation.affectedProjectId || null,
            last_seen_at: evaluatedAtIso,
          } as never)
          .select("id")
          .single();

        assertNoError(createError, "Unable to create new recommendation record.");

        if (!createdData || typeof (createdData as { id?: unknown }).id !== "string") {
          throw new Error("Recommendation persistence returned no id.");
        }

        const createdId = (createdData as { id: string }).id;
        await insertHistory({
          supabase,
          recommendationId: createdId,
          companyId: input.companyId,
          actorProfileId: input.actorProfileId,
          action: "created",
          fromStatus: null,
          toStatus: "open",
          metadata: {
            fingerprint,
            recommendationType: recommendation.type,
          },
        });
      }

      for (const existing of activeRows) {
        if (seenFingerprints.has(existing.fingerprint)) {
          continue;
        }

        await transitionStatus({
          supabase,
          companyId: input.companyId,
          recommendationId: existing.id,
          actorProfileId: input.actorProfileId,
          toStatus: "expired",
          note: "Recommendation no longer generated by deterministic evaluator.",
        });
      }

      const timelineRowsToInsert = input.timeline.map((event) => ({
        company_id: input.companyId,
        event_fingerprint: createTimelineFingerprint(event),
        event_type: event.type,
        occurred_at: event.timestamp,
        title: event.title,
        detail: event.detail,
        severity: event.severity,
        crew_id: event.crewId || null,
        employee_id: event.employeeId || null,
        project_id: event.projectId || null,
        assignment_id: event.assignmentId || null,
        actor_profile_id: event.actorProfileId || null,
        metadata: (event.metadata || {}) as Json,
        source: event.source || "orion_workforce_evaluator",
      }));

      if (timelineRowsToInsert.length > 0) {
        const uniqueFingerprints = Array.from(new Set(timelineRowsToInsert.map((row) => row.event_fingerprint)));
        const lookbackStart = new Date(Date.parse(evaluatedAtIso) - 6 * 60 * 60 * 1000).toISOString();

        const { data: existingTimelineRows, error: existingTimelineError } = await supabase
          .from("workforce_orion_timeline_events" as never)
          .select("event_fingerprint")
          .eq("company_id", input.companyId)
          .in("event_fingerprint", uniqueFingerprints)
          .gte("occurred_at", lookbackStart);

        assertNoError(existingTimelineError, "Unable to load timeline dedupe scope.");

        const existingFingerprints = new Set(
          (((existingTimelineRows as Array<{ event_fingerprint: string }> | null) || []).map((row) => row.event_fingerprint)),
        );

        const newRows = timelineRowsToInsert.filter((row) => !existingFingerprints.has(row.event_fingerprint));

        if (newRows.length > 0) {
          const { error } = await supabase
            .from("workforce_orion_timeline_events" as never)
            .insert(newRows as never);

          assertNoError(error, "Unable to persist workforce intelligence timeline events.");
        }
      }

      const { data: recommendationRowsData, error: recommendationRowsError } = await supabase
        .from("workforce_orion_recommendations" as never)
        .select("*")
        .eq("company_id", input.companyId)
        .order("created_at", { ascending: false })
        .limit(40);

      assertNoError(recommendationRowsError, "Unable to load recommendations for dashboard.");

      const { data: timelineRowsData, error: timelineRowsError } = await supabase
        .from("workforce_orion_timeline_events" as never)
        .select("*")
        .eq("company_id", input.companyId)
        .order("occurred_at", { ascending: false })
        .limit(60);

      assertNoError(timelineRowsError, "Unable to load timeline events for dashboard.");

      return {
        recommendations: ((recommendationRowsData as RecommendationRow[] | null) || []).map(mapRowToRecommendation),
        timeline: ((timelineRowsData as TimelineRow[] | null) || []).map(mapRowToTimelineEvent),
      };
    },

    async acknowledgeRecommendation(input) {
      await transitionStatus({
        supabase,
        companyId: input.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: input.actorProfileId,
        toStatus: "acknowledged",
        note: input.note,
      });
    },

    async acceptRecommendation(input) {
      await transitionStatus({
        supabase,
        companyId: input.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: input.actorProfileId,
        toStatus: "accepted",
        note: input.note,
      });
    },

    async dismissRecommendation(input) {
      await transitionStatus({
        supabase,
        companyId: input.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: input.actorProfileId,
        toStatus: "dismissed",
        note: input.note,
      });
    },

    async completeRecommendation(input) {
      await transitionStatus({
        supabase,
        companyId: input.companyId,
        recommendationId: input.recommendationId,
        actorProfileId: input.actorProfileId,
        toStatus: "completed",
        note: input.note,
      });
    },

    async recordRecommendationOutcome(input) {
      const recommendation = await loadRecommendationById(supabase, input.companyId, input.recommendationId);
      if (!recommendation) {
        throw new Error("Recommendation was not found in this company workspace.");
      }

      const note = trimNote(input.note);
      const nowIso = new Date().toISOString();

      const { error: updateError } = await supabase
        .from("workforce_orion_recommendations" as never)
        .update({
          outcome_status: input.outcomeStatus,
          outcome_notes: note,
          actor_profile_id: input.actorProfileId,
        } as never)
        .eq("company_id", input.companyId)
        .eq("id", input.recommendationId);

      assertNoError(updateError, "Unable to update recommendation outcome state.");

      const { error: insertOutcomeError } = await supabase
        .from("workforce_orion_recommendation_outcomes" as never)
        .insert({
          recommendation_id: input.recommendationId,
          company_id: input.companyId,
          outcome_status: input.outcomeStatus,
          notes: note,
          metrics: (input.metrics || {}) as Json,
          actor_profile_id: input.actorProfileId,
          recorded_at: nowIso,
        } as never);

      assertNoError(insertOutcomeError, "Unable to persist recommendation outcome record.");

      await insertHistory({
        supabase,
        recommendationId: input.recommendationId,
        companyId: input.companyId,
        actorProfileId: input.actorProfileId,
        action: "outcome_recorded",
        fromStatus: recommendation.status,
        toStatus: recommendation.status,
        note,
        metadata: {
          outcomeStatus: input.outcomeStatus,
          hasMetrics: Boolean(input.metrics && Object.keys(input.metrics).length > 0),
        },
      });
    },
  };
}
