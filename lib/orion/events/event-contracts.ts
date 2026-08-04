import type { OrionAggregateType, OrionEventType, OrionSourceModule } from "./event-types";

export type OrionEventPayload = Record<string, unknown>;

export type OrionEventMetadata = Record<string, unknown>;

export type OrionEventInput = {
  event_id?: string;
  company_id: string;
  workspace_id?: string | null;
  actor_profile_id: string | null;
  event_type: OrionEventType;
  aggregate_type: OrionAggregateType;
  aggregate_id: string;
  occurred_at?: string;
  version?: number;
  source_module: OrionSourceModule;
  payload: OrionEventPayload;
  metadata?: OrionEventMetadata;
  correlation_id?: string | null;
  causation_id?: string | null;
  idempotency_key?: string;
};

export type OrionEventRecord = {
  event_id: string;
  company_id: string;
  workspace_id: string | null;
  actor_profile_id: string | null;
  event_type: OrionEventType;
  aggregate_type: OrionAggregateType;
  aggregate_id: string;
  occurred_at: string;
  version: number;
  source_module: OrionSourceModule;
  payload: OrionEventPayload;
  metadata: OrionEventMetadata;
  correlation_id: string | null;
  causation_id: string | null;
  idempotency_key: string | null;
};

export type OrionPublishResult = {
  event: OrionEventRecord;
  idempotent: boolean;
};
