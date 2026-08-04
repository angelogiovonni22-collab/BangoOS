import { createSupabaseOrionEventPublisher } from "@/lib/orion/events";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { createDecisionContext } from "./decision-context";
import { createDecisionRegistry } from "./decision-registry";
import { buildDecisionResult } from "./decision-result";
import { sortDecisionsByPriority } from "./decision-priority";
import type {
  OrionDecisionEngineResult,
  OrionDecisionEventType,
  OrionDecisionRecord,
  OrionDecisionStatus,
} from "./decision-types";
import { canTransitionDecisionStatus, validateDecisionRecord } from "./decision-validation";

type DecisionHistoryState = {
  decisionId: string;
  status: OrionDecisionStatus;
  occurredAt: string;
  eventId: string;
};

type WorkflowDecisionEventRow = {
  id: string;
  company_id: string;
  event_type: string;
  occurred_at: string;
  payload: Record<string, unknown>;
  actor_profile_id: string | null;
};

type LooseSupabase = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

const DECISION_EVENT_TYPES: OrionDecisionEventType[] = [
  "decision.created",
  "decision.acknowledged",
  "decision.resolved",
  "decision.dismissed",
];

function decisionEventToStatus(eventType: OrionDecisionEventType): OrionDecisionStatus {
  if (eventType === "decision.acknowledged") {
    return "acknowledged";
  }

  if (eventType === "decision.resolved") {
    return "resolved";
  }

  if (eventType === "decision.dismissed") {
    return "dismissed";
  }

  return "new";
}

function asRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {} as Record<string, unknown>;
  }

  return value as Record<string, unknown>;
}

function asString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function applyStatus(decision: OrionDecisionRecord, status: OrionDecisionStatus, statusAt: string | null) {
  return {
    ...decision,
    status,
    acknowledged: status === "acknowledged",
    resolved: status === "resolved",
    dismissed: status === "dismissed",
    acknowledgedAt: status === "acknowledged" ? statusAt : null,
    resolvedAt: status === "resolved" ? statusAt : null,
    dismissedAt: status === "dismissed" ? statusAt : null,
  };
}

async function loadDecisionHistory(supabase: SupabaseClient<Database>, companyId: string): Promise<Map<string, DecisionHistoryState>> {
  const db = supabase as unknown as LooseSupabase;
  const { data, error } = await db
    .from("workflow_events")
    .select("id, company_id, event_type, occurred_at, payload, actor_profile_id")
    .eq("company_id", companyId)
    .in("event_type", DECISION_EVENT_TYPES)
    .order("occurred_at", { ascending: true })
    .limit(2000);

  if (error) {
    throw new Error(error.message || "Unable to load decision history.");
  }

  const rows = (data ?? []) as WorkflowDecisionEventRow[];
  const byDecisionId = new Map<string, DecisionHistoryState>();

  for (const row of rows) {
    const payload = asRecord(row.payload);
    const decisionId = asString(payload.decision_id);
    if (!decisionId) {
      continue;
    }

    const eventType = row.event_type as OrionDecisionEventType;
    byDecisionId.set(decisionId, {
      decisionId,
      status: decisionEventToStatus(eventType),
      occurredAt: row.occurred_at,
      eventId: row.id,
    });
  }

  return byDecisionId;
}

async function publishDecisionStatusEvent(input: {
  supabase: SupabaseClient<Database>;
  companyId: string;
  actorProfileId: string | null;
  decision: OrionDecisionRecord;
  eventType: OrionDecisionEventType;
  occurredAt: string;
  correlationId?: string | null;
}) {
  const publisher = createSupabaseOrionEventPublisher(input.supabase);
  await publisher.publishEvent({
    company_id: input.companyId,
    actor_profile_id: input.actorProfileId,
    event_type: input.eventType,
    aggregate_type: "decision",
    aggregate_id: input.decision.decisionId,
    source_module: "decision",
    occurred_at: input.occurredAt,
    correlation_id: input.correlationId || null,
    causation_id: input.correlationId || null,
    idempotency_key: `decision:${input.eventType}:${input.decision.decisionId}:${input.occurredAt}`,
    payload: {
      decision_id: input.decision.decisionId,
      rule_id: input.decision.ruleId,
      priority: input.decision.priority,
      category: input.decision.category,
      severity: input.decision.severity,
      title: input.decision.title,
      summary: input.decision.summary,
      recommendation: input.decision.recommendation,
      action_label: input.decision.actionLabel,
      action_href: input.decision.actionHref,
      related_entity_type: input.decision.relatedEntity.type,
      related_entity_id: input.decision.relatedEntity.id,
      related_entity_href: input.decision.relatedEntity.href,
      related_event_id: input.decision.relatedEventId,
      detected_at: input.decision.detectedAt,
      status: decisionEventToStatus(input.eventType),
    },
  });
}

export type OrionDecisionEngine = {
  evaluateCompanyDecisions: (params: {
    companyId: string;
    actorProfileId: string | null;
    companyName?: string | null;
  }) => Promise<OrionDecisionEngineResult>;
  acknowledgeDecision: (params: {
    companyId: string;
    actorProfileId: string | null;
    decision: OrionDecisionRecord;
  }) => Promise<void>;
  dismissDecision: (params: {
    companyId: string;
    actorProfileId: string | null;
    decision: OrionDecisionRecord;
  }) => Promise<void>;
};

export function createOrionDecisionEngine(supabase: SupabaseClient<Database>): OrionDecisionEngine {
  return {
    async evaluateCompanyDecisions(params) {
      const context = createDecisionContext(supabase, params.companyId);
      const rules = createDecisionRegistry().filter((rule) => rule.enabled);
      const detectedAt = context.now().toISOString();
      const history = await loadDecisionHistory(supabase, params.companyId);

      const candidateMap = new Map<string, OrionDecisionRecord>();

      for (const rule of rules) {
        const candidates = await rule.evaluate(context);
        for (const candidate of candidates) {
          const next = applyStatus({
            ...candidate,
            status: "new",
            acknowledged: false,
            resolved: false,
            dismissed: false,
            acknowledgedAt: null,
            resolvedAt: null,
            dismissedAt: null,
          }, "new", null);

          const validation = validateDecisionRecord(next);
          if (!validation.ok) {
            continue;
          }

          const existing = candidateMap.get(next.decisionId);
          if (!existing) {
            candidateMap.set(next.decisionId, next);
            continue;
          }

          if (sortDecisionsByPriority(next, existing) < 0) {
            continue;
          }

          candidateMap.set(next.decisionId, next);
        }
      }

      const decisions = Array.from(candidateMap.values()).map((decision) => {
        const prior = history.get(decision.decisionId);
        if (!prior) {
          return decision;
        }

        if (prior.status === "acknowledged") {
          return applyStatus(decision, "acknowledged", prior.occurredAt);
        }

        if (prior.status === "dismissed") {
          return applyStatus(decision, "dismissed", prior.occurredAt);
        }

        return decision;
      });

      const activeDecisionIds = new Set(decisions
        .filter((decision) => decision.status === "new" || decision.status === "acknowledged")
        .map((decision) => decision.decisionId));

      for (const decision of decisions) {
        const prior = history.get(decision.decisionId);
        if (!prior || prior.status === "resolved" || prior.status === "dismissed") {
          await publishDecisionStatusEvent({
            supabase,
            companyId: params.companyId,
            actorProfileId: params.actorProfileId,
            decision,
            eventType: "decision.created",
            occurredAt: detectedAt,
            correlationId: decision.relatedEventId,
          });
          history.set(decision.decisionId, {
            decisionId: decision.decisionId,
            status: "new",
            occurredAt: detectedAt,
            eventId: `decision-created:${decision.decisionId}`,
          });
        }
      }

      const previouslyOpen = Array.from(history.values()).filter((item) => item.status === "new" || item.status === "acknowledged");
      for (const prior of previouslyOpen) {
        if (activeDecisionIds.has(prior.decisionId)) {
          continue;
        }

        const stale = decisions.find((item) => item.decisionId === prior.decisionId) || {
          decisionId: prior.decisionId,
          companyId: params.companyId,
          ruleId: "historical",
          priority: "low",
          category: "operations",
          severity: "low",
          title: "Decision resolved",
          summary: "Previous decision is no longer active.",
          recommendation: "No action required.",
          relatedEntity: { type: "company", id: null, href: "/dashboard" },
          relatedEventId: null,
          detectedAt,
          status: "resolved",
          acknowledged: false,
          resolved: true,
          dismissed: false,
          acknowledgedAt: null,
          resolvedAt: detectedAt,
          dismissedAt: null,
          actionLabel: "Open Schedule",
          actionHref: "/dashboard",
        } as OrionDecisionRecord;

        await publishDecisionStatusEvent({
          supabase,
          companyId: params.companyId,
          actorProfileId: params.actorProfileId,
          decision: stale,
          eventType: "decision.resolved",
          occurredAt: detectedAt,
          correlationId: stale.relatedEventId,
        });
      }

      return buildDecisionResult({
        companyId: params.companyId,
        detectedAt,
        decisions,
        companyName: params.companyName || null,
        now: context.now(),
      });
    },

    async acknowledgeDecision(params) {
      if (!canTransitionDecisionStatus(params.decision.status, "acknowledged")) {
        return;
      }

      await publishDecisionStatusEvent({
        supabase,
        companyId: params.companyId,
        actorProfileId: params.actorProfileId,
        decision: params.decision,
        eventType: "decision.acknowledged",
        occurredAt: new Date().toISOString(),
        correlationId: params.decision.relatedEventId,
      });
    },

    async dismissDecision(params) {
      if (!canTransitionDecisionStatus(params.decision.status, "dismissed")) {
        return;
      }

      await publishDecisionStatusEvent({
        supabase,
        companyId: params.companyId,
        actorProfileId: params.actorProfileId,
        decision: params.decision,
        eventType: "decision.dismissed",
        occurredAt: new Date().toISOString(),
        correlationId: params.decision.relatedEventId,
      });
    },
  };
}
