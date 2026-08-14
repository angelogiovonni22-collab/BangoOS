import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type OrionCommandPermission =
  | "owner"
  | "administrator"
  | "operations_manager"
  | "accountant"
  | "project_manager"
  | "superintendent"
  | "employee";

export type OrionCommandEntityType =
  | "customer"
  | "estimate"
  | "project"
  | "invoice"
  | "employee"
  | "crew"
  | "task"
  | "schedule"
  | "daily_report"
  | "inspection"
  | "permit"
  | "punch_item"
  | "warranty"
  | "communication"
  | "document"
  | "portal"
  | "workflow";

export type OrionCommandStatus =
  | "completed"
  | "unsupported"
  | "rejected"
  | "failed";

export type OrionCommandConfirmationLevel = "NONE" | "REVIEW" | "REQUIRED";

export type OrionCommandCoverage = {
  status: "implemented" | "navigation_only" | "unsupported";
  reason?: string;
  missingDependency?: string;
  plannedPhase?: string;
  expectedEvent?: string;
  ownerModule?: string;
};

export type OrionCommandRequest = {
  commandId?: string;
  commandName?: string;
  params?: unknown;
  confirmation?: {
    confirmed: boolean;
    summary?: string;
  } | boolean;
  companyContext: {
    companyId: string;
  };
  userContext: {
    actorProfileId: string | null;
    role: OrionCommandPermission;
  };
  executionContext?: {
    origin?: "user" | "automation";
    automationRuleId?: string | null;
    automationRunId?: string | null;
  };
  correlationId?: string | null;
  idempotencyKey?: string;
};

export type OrionCommandValidationResult = {
  ok: boolean;
  errors: string[];
  normalizedParams?: Record<string, unknown>;
};

export type OrionCommandExecutionOutput = {
  status?: OrionCommandStatus;
  entityType?: OrionCommandEntityType | null;
  entityId?: string | null;
  createdEntityIds?: string[];
  updatedEntityIds?: string[];
  publishedEventIds?: string[];
  href?: string | null;
  userMessage?: string;
  retryable?: boolean;
  requiresConfirmation?: boolean;
  confirmationSummary?: string | null;

  // Legacy fields retained to keep existing handlers compatible.
  entityCreated?: { type: OrionCommandEntityType; id: string } | null;
  entityUpdated?: { type: OrionCommandEntityType; id: string } | null;
  publishedEvent?: string | null;
  deepLink?: string | null;
  warnings?: string[];
  details?: Record<string, unknown>;
};

export type OrionCommandExecutionContext = {
  request: OrionCommandRequest;
  commandId: string;
  commandName: string;
  companyId: string;
  actorProfileId: string | null;
  correlationId: string;
  idempotencyKey: string;
};

export type OrionCommandDependencies = {
  supabase: SupabaseClient<Database>;
};

export type OrionCommandDefinition = {
  id: string;
  name: string;
  description: string;
  requiredPermissions: OrionCommandPermission[];
  entityType: OrionCommandEntityType;
  confirmationLevel: OrionCommandConfirmationLevel;
  coverage: OrionCommandCoverage;
  eventContract?: {
    expectedEvents: string[];
  };
  navigation?: {
    resolvesHref: boolean;
  };
  inputSchema: string;
  undoCapable: boolean;
  validate: (params: unknown) => OrionCommandValidationResult;
  execute: (
    params: Record<string, unknown>,
    context: OrionCommandExecutionContext,
    deps: OrionCommandDependencies,
  ) => Promise<OrionCommandExecutionOutput>;
};

export type OrionCommandExecutionResult = {
  success: boolean;
  status: OrionCommandStatus;
  commandExecutionId: string | null;
  entityType: OrionCommandEntityType | null;
  entityId: string | null;
  createdEntityIds: string[];
  updatedEntityIds: string[];
  publishedEventIds: string[];
  warnings: string[];
  requiresConfirmation: boolean;
  confirmationSummary: string | null;
  href: string | null;
  userMessage: string;
  retryable: boolean;
  idempotentReplay: boolean;

  // Legacy and diagnostic fields retained for compatibility.
  failure: string | null;
  entityCreated: { type: OrionCommandEntityType; id: string } | null;
  entityUpdated: { type: OrionCommandEntityType; id: string } | null;
  publishedEvent: string | null;
  commandHistoryEventId: string | null;
  deepLink: string | null;
  durationMs: number;
  correlationId: string;
  commandId: string;
  commandName: string;
  details: Record<string, unknown>;
  validationErrors: string[];
};

export type OrionCommandHistoryRecord = {
  commandId: string;
  commandName: string;
  referenceId?: string | null;
  companyId: string;
  actorProfileId: string | null;
  occurredAt: string;
  durationMs: number;
  success: boolean;
  failure: string | null;
  validationErrors: string[];
  correlationId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};
